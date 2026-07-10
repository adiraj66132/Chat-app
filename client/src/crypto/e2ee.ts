// Client-side end-to-end encryption for DMs.
//
// Scheme:
//   - Each user has an RSA-OAEP (2048-bit) key pair used only for wrapping
//     conversation keys. The public key lives on the server; the private key
//     never leaves the browser (stored in localStorage).
//   - Each DM has a random AES-GCM 256-bit content-encryption key (CEK).
//     The CEK is wrapped (RSA-OAEP) with every participant's public key and
//     the wrapped blobs are stored server-side in `conversation_keys`.
//   - Message bodies are encrypted with the CEK (AES-GCM). The server only
//     ever stores ciphertext + IV and cannot read them.
//   - The GLOBAL chat is intentionally excluded from E2EE (see isEncrypted).

const RSA_PARAMS: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const RSA_USAGES: KeyUsage[] = ['wrapKey', 'unwrapKey'];

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const E2EE_ENABLED = true;

export function isEncryptedConversation(type: 'DM' | 'GROUP' | 'GLOBAL'): boolean {
  return type === 'DM';
}

export async function generateKeyPair(): Promise<{ publicJwk: string; privateJwk: string }> {
  const pair = await crypto.subtle.generateKey(RSA_PARAMS, true, RSA_USAGES);
  const publicJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.publicKey));
  const privateJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey));
  return { publicJwk, privateJwk };
}

export async function importPublicKey(jwk: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    JSON.parse(jwk) as JsonWebKey,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['wrapKey']
  );
}

export async function importPrivateKey(jwk: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    JSON.parse(jwk) as JsonWebKey,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['unwrapKey']
  );
}

export async function generateCEK(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

// Wrap a CEK with a participant's RSA public key -> base64 string.
// Uses the dedicated RSA-OAEP wrapKey operation (no raw CEK export needed).
export async function wrapCEK(cek: CryptoKey, publicKeyJwk: string): Promise<string> {
  const publicKey = await importPublicKey(publicKeyJwk);
  const wrapped = await crypto.subtle.wrapKey('raw', cek, publicKey, { name: 'RSA-OAEP' });
  return arrayBufferToBase64(wrapped);
}

// Unwrap a CEK using our private key -> AES-GCM CryptoKey.
export async function unwrapCEK(wrappedKeyB64: string, privateKeyJwk: string): Promise<CryptoKey> {
  const privateKey = await importPrivateKey(privateKeyJwk);
  const wrapped = base64ToArrayBuffer(wrappedKeyB64);
  return crypto.subtle.unwrapKey(
    'raw',
    wrapped,
    privateKey,
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedPayload {
  content: string;
  iv: string;
}

export async function encryptText(cek: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cek, encoder.encode(plaintext));
  return { content: arrayBufferToBase64(ciphertext), iv: arrayBufferToBase64(iv.buffer) };
}

export async function decryptText(cek: CryptoKey, contentB64: string, ivB64: string): Promise<string> {
  const iv = new Uint8Array(base64ToArrayBuffer(ivB64));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cek,
    base64ToArrayBuffer(contentB64)
  );
  return decoder.decode(plaintext);
}
