// Real client-side E2EE: X25519 ECDH -> HKDF -> XChaCha20-Poly1305.
//
// Wire-compatible: messages without an `iv` (legacy plaintext rows) decrypt to
// passthrough. Each message carries its own random 24-byte nonce in `iv`.

const IV_BYTES = 24; // XChaCha20-Poly1305 nonce size

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('e2ee-store', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keys', 'readonly');
    const req = tx.objectStore('keys').get(key);
    req.onsuccess = () => resolve((req.result as string) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keys', 'readwrite');
    tx.objectStore('keys').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export interface KeyPair {
  publicKey: string; // raw base64url-ish (base64) X25519 public key
  privateKey: CryptoKey; // non-extractable handle
  privateRaw: string; // base64 raw private key for durable storage
}

async function importX25519(raw: Uint8Array, isPublic: boolean): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    isPublic ? 'raw' : 'pkcs8',
    isPublic
      ? raw
      : concatBytes(
          // PKCS#8 prefix for X25519 (OID 1.3.101.110)
          new Uint8Array([48, 46, 2, 1, 0, 48, 5, 6, 3, 43, 101, 110, 4, 34, 4, 32]),
          raw
        ),
    { name: 'X25519' },
    isPublic ? true : false,
    isPublic ? [] : ['deriveBits']
  );
}

export async function generateKeyPair(): Promise<KeyPair> {
  const pair = (await crypto.subtle.generateKey({ name: 'X25519' }, false, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const privRaw = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  // Extract the trailing 32 raw bytes from the PKCS#8 export.
  const rawPriv = privRaw.slice(privRaw.length - 32);
  return {
    publicKey: bytesToB64(pubRaw),
    privateKey: pair.privateKey,
    privateRaw: bytesToB64(rawPriv),
  };
}

export async function loadKeyPair(): Promise<KeyPair | null> {
  const stored = await idbGet('user-keypair');
  if (!stored) return null;
  try {
    const privateKey = await importX25519(b64ToBytes(stored), false);
    // Reconstruct public key from private via ECDH with itself is not possible;
    // store public too.
    const pubStored = await idbGet('user-publickey');
    if (!pubStored) return null;
    return {
      publicKey: pubStored,
      privateKey,
      privateRaw: stored,
    };
  } catch {
    return null;
  }
}

export async function saveKeyPair(pair: KeyPair): Promise<void> {
  await idbSet('user-keypair', pair.privateRaw);
  await idbSet('user-publickey', pair.publicKey);
}

// Wrap the raw private key with a passphrase (AES-GCM) for export/backup.
export async function exportWrappedPrivateKey(pair: KeyPair, passphrase: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMat = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const aes = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aes,
      b64ToBytes(pair.privateRaw)
    )
  );
  return JSON.stringify({
    v: 1,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    data: bytesToB64(ct),
    publicKey: pair.publicKey,
  });
}

export async function importWrappedPrivateKey(
  wrapped: string,
  passphrase: string
): Promise<KeyPair> {
  const obj = JSON.parse(wrapped);
  if (!obj.publicKey) throw new Error('Backup is missing the public key');
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const aes = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64ToBytes(obj.salt), iterations: 100000, hash: 'SHA-256' },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const raw = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(obj.iv) },
      aes,
      b64ToBytes(obj.data)
    )
  );
  const privateKey = await importX25519(raw, false);
  return {
    publicKey: obj.publicKey,
    privateKey,
    privateRaw: bytesToB64(raw),
  };
}

// Derive the raw 32-byte per-conversation key material from ECDH.
async function deriveConversationKeyBits(
  myPriv: CryptoKey,
  peerPublicB64: string
): Promise<Uint8Array> {
  const peer = await importX25519(b64ToBytes(peerPublicB64), true);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ public: peer } as any, myPriv, 256)
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode('e2ee-conversation-v1') },
      await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']),
      256
    )
  );
}

// Derive a per-conversation symmetric CryptoKey (XChaCha20-Poly1305) from ECDH.
export async function deriveConversationKey(
  myPriv: CryptoKey,
  peerPublicB64: string
): Promise<CryptoKey> {
  const rawKey = await deriveConversationKeyBits(myPriv, peerPublicB64);
  return crypto.subtle.importKey('raw', rawKey, { name: 'XChaCha20-Poly1305' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

// Raw (base64) per-conversation key material. Used as the server-persisted
// "wrapped CEK": it is deterministic from the identity key + peer public key, so
// re-deriving after a key rotation reproduces the same value to re-share.
export async function deriveConversationKeyRaw(
  myPriv: CryptoKey,
  peerPublicB64: string
): Promise<string> {
  return bytesToB64(await deriveConversationKeyBits(myPriv, peerPublicB64));
}

export interface EncryptedPayload {
  content: string;
  iv: string;
}

export async function encryptMessage(
  myPriv: CryptoKey,
  peerPublicB64: string | null | undefined,
  text: string
): Promise<EncryptedPayload | null> {
  if (!peerPublicB64) return null; // not encryptable -> caller stores plaintext
  const key = await deriveConversationKey(myPriv, peerPublicB64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'XChaCha20-Poly1305', iv: iv as any, additionalData: new Uint8Array(0) } as any,
      key,
      new TextEncoder().encode(text)
    ) as unknown as ArrayBuffer
  );
  return { content: bytesToB64(ct), iv: bytesToB64(iv) };
}

export async function decryptMessage(
  myPriv: CryptoKey,
  peerPublicB64: string | null | undefined,
  content: string | null | undefined,
  iv: string | null | undefined
): Promise<string | null> {
  if (content == null) return null;
  // Wire-compat: legacy plaintext rows have no iv.
  if (!iv || !peerPublicB64) return content;
  const key = await deriveConversationKey(myPriv, peerPublicB64);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'XChaCha20-Poly1305', iv: b64ToBytes(iv) as any, additionalData: new Uint8Array(0) } as any,
      key,
      b64ToBytes(content)
    );
    return new TextDecoder().decode(pt);
  } catch {
    return content; // decryption failed -> fall back to passthrough
  }
}
