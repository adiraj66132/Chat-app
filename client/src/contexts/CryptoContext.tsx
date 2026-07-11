import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { setPublicKey } from '../api/users';
import { getConversationKeys, putConversationKeys, deleteConversationKey } from '../api/conversations';
import {
  generateKeyPair,
  generateCEK,
  wrapCEK,
  unwrapCEK,
  encryptText,
  decryptText,
  isEncryptedConversation,
} from '../crypto/e2ee';
import type { Conversation } from '../types/conversation';

interface CryptoContextType {
  ready: boolean;
  isEncrypted: (conversation: Conversation | null | undefined) => boolean;
  ensureCEK: (conversation: Conversation | null | undefined) => Promise<CryptoKey | null>;
  encryptMessage: (
    conversation: Conversation | null | undefined,
    text: string
  ) => Promise<{ content: string; iv?: string }>;
  // Returns decrypted plaintext, '' for empty, or null when the message is
  // encrypted but the conversation key is not yet available (caller should
  // retry once the key arrives).
  decryptMessage: (
    conversationId: string,
    content: string | null | undefined,
    iv: string | null | undefined
  ) => Promise<string | null>;
  // Bumped whenever a conversation key is established, so consumers can
  // re-attempt decryption.
  keyVersion: number;
}

const CryptoContext = createContext<CryptoContextType | null>(null);

const privKeyStorage = (userId: string) => `e2ee:priv:${userId}`;

export function CryptoProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const [ready, setReady] = useState(false);
  const [keyVersion, setKeyVersion] = useState(0);
  const privateKeyRef = useRef<string | null>(null);
  const ceksRef = useRef<Map<string, CryptoKey>>(new Map());

  const bumpKey = useCallback(() => setKeyVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!user) {
        privateKeyRef.current = null;
        setReady(false);
        return;
      }
      const stored = localStorage.getItem(privKeyStorage(user.id));
      if (stored) {
        privateKeyRef.current = stored;
        setReady(true);
        return;
      }
      try {
        const { publicJwk, privateJwk } = await generateKeyPair();
        await setPublicKey(publicJwk);
        updateUser({ publicKey: publicJwk });
        localStorage.setItem(privKeyStorage(user.id), privateJwk);
        privateKeyRef.current = privateJwk;
      } catch {
        privateKeyRef.current = null;
      }
      if (!cancelled) setReady(true);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const ensureCEK = useCallback(
    async (conversation: Conversation | null | undefined): Promise<CryptoKey | null> => {
      if (!conversation || !isEncryptedConversation(conversation.type)) return null;
      if (!ready || !privateKeyRef.current) return null;

      const id = conversation.id;
      const cached = ceksRef.current.get(id);
      if (cached) return cached;

      // 1) Try to recover an existing CEK via our wrapped key.
      try {
        const { wrappedKey } = await getConversationKeys(id);
        if (wrappedKey) {
          const cek = await unwrapCEK(wrappedKey, privateKeyRef.current);
          ceksRef.current.set(id, cek);
          bumpKey();
          return cek;
        }
      } catch {
        // Stale wrapped key (e.g. user regenerated key pair on another device).
        // Remove it so the next cycle can establish a fresh CEK.
        await deleteConversationKey(id).catch(() => {});
      }

      // 2) Create a fresh CEK. To avoid two participants generating divergent
      //    CEKs (which would make cross-decryption impossible), only the
      //    participant with the lexicographically smallest id is allowed to
      //    create; the other simply waits and recovers the creator's key.
      const participantIds = (conversation.participants ?? []).map((p) => p.id);
      const creatorId = participantIds.slice().sort()[0];
      if (user?.id !== creatorId) return null;

      const recipients = new Map<string, string>();
      for (const p of conversation.participants ?? []) {
        if (p.publicKey && p.id !== user?.id) recipients.set(p.id, p.publicKey);
      }
      if (user?.publicKey) {
        recipients.set(user.id, user.publicKey);
      }
      if (recipients.size === 0) return null; // can't establish E2EE yet

      const cek = await generateCEK();
      const keys = await Promise.all(
        Array.from(recipients.entries()).map(async ([userId, publicKey]) => ({
          userId,
          wrappedKey: await wrapCEK(cek, publicKey),
        }))
      );
      await putConversationKeys(id, keys);
      ceksRef.current.set(id, cek);
      bumpKey();
      return cek;
    },
    [ready, user?.id, user?.publicKey, bumpKey]
  );

  const encryptMessage = useCallback(
    async (
      conversation: Conversation | null | undefined,
      text: string
    ): Promise<{ content: string; iv?: string }> => {
      if (!conversation || !isEncryptedConversation(conversation.type)) {
        return { content: text };
      }
      const cek = await ensureCEK(conversation);
      if (!cek) return { content: text }; // E2EE unavailable -> plaintext fallback
      return encryptText(cek, text);
    },
    [ensureCEK]
  );

  const decryptMessage = useCallback(
    async (
      conversationId: string,
      content: string | null | undefined,
      iv: string | null | undefined
    ): Promise<string | null> => {
      if (!content) return '';
      if (!iv) return content; // plaintext (e.g. GLOBAL chat)
      const cek = ceksRef.current.get(conversationId);
      if (!cek) return null; // encrypted but key not available yet
      try {
        return await decryptText(cek, content, iv);
      } catch {
        return null;
      }
    },
    []
  );

  const isEncrypted = useCallback(
    (conversation: Conversation | null | undefined) =>
      !!conversation && isEncryptedConversation(conversation.type),
    []
  );

  return (
    <CryptoContext.Provider
      value={{ ready, isEncrypted, ensureCEK, encryptMessage, decryptMessage, keyVersion }}
    >
      {children}
    </CryptoContext.Provider>
  );
}

export function useCrypto() {
  const ctx = useContext(CryptoContext);
  if (!ctx) throw new Error('useCrypto must be used within CryptoProvider');
  return ctx;
}
