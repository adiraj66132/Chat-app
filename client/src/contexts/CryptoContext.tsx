import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Conversation } from '../types/conversation';
import { updateProfile } from '../api/users';
import { saveConversationKey } from '../api/conversations';
import {
  generateKeyPair,
  loadKeyPair,
  saveKeyPair,
  encryptMessage,
  decryptMessage,
  importWrappedPrivateKey,
  exportWrappedPrivateKey,
  deriveConversationKey,
  deriveConversationKeyRaw,
  type KeyPair,
} from '../crypto/e2ee';

interface CryptoContextType {
  ready: boolean;
  publicKey: string | null;
  isEncrypted: (conversation: Conversation | null | undefined) => boolean;
  ensureCEK: (conversation: Conversation | null | undefined) => Promise<CryptoKey | null>;
  encryptMessage: (
    conversation: Conversation | null | undefined,
    text: string
  ) => Promise<{ content: string; iv?: string }>;
  decryptMessage: (
    conversationId: string,
    content: string | null | undefined,
    iv: string | null | undefined
  ) => Promise<string | null>;
  keyVersion: number;
  keyMismatch: boolean;
  regenerateKeys: () => Promise<void>;
  importPrivateKey: (key: string, passphrase: string) => Promise<void>;
  exportBackup: (passphrase: string) => Promise<string>;
  registerConversation: (conversation: Conversation | null | undefined) => void;
  registerConversations: (conversations: Conversation[] | undefined) => void;
}

const CryptoContext = createContext<CryptoContextType | null>(null);

export function CryptoProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [keyVersion, setKeyVersion] = useState(0);
  const [keyMismatch, setKeyMismatch] = useState(false);
  const keyPairRef = useRef<KeyPair | null>(null);
  // conversationId -> peer public key, resolved from participant data so that
  // messages in non-active conversations can still be decrypted.
  const peerMapRef = useRef<Map<string, string>>(new Map());
  // conversationId -> latest Conversation (so peers can be re-derived on demand).
  const conversationsRef = useRef<Map<string, Conversation>>(new Map());
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let kp = await loadKeyPair();
        if (!kp) {
          kp = await generateKeyPair();
          await saveKeyPair(kp);
        }
        if (cancelled) return;
        keyPairRef.current = kp;
        setPublicKey(kp.publicKey);
        await updateProfile({ publicKey: kp.publicKey }).catch(() => {});
        setReady(true);
        setKeyVersion((v) => v + 1);
      } catch {
        if (!cancelled) setReady(true); // passthrough mode
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep peer map in sync with the cached conversations list so incoming
  // messages in non-active conversations can be decrypted.
  useEffect(() => {
    const sync = () => {
      const list = queryClient.getQueryData<Conversation[]>(['conversations']);
      if (list) for (const c of list) setPeer(c);
    };
    sync();
    const unsub = queryClient.getQueryCache().subscribe(sync);
    return () => unsub();
  }, [queryClient]);

  function peerPublicKey(conversation: Conversation | null | undefined): string | null {
    if (!conversation) return null;
    if (conversation.type === 'DM') {
      const peer = conversation.participants.find((p) => p.publicKey);
      return peer?.publicKey ?? null;
    }
    return null;
  }

  // Resolve a peer key, falling back to any cached conversation participant data.
  async function resolvePeer(conversationId: string): Promise<string | null> {
    const cached = peerMapRef.current.get(conversationId);
    if (cached) return cached;
    const conv = conversationsRef.current.get(conversationId);
    const peer = peerPublicKey(conv ?? null);
    if (peer) peerMapRef.current.set(conversationId, peer);
    return peer;
  }

  function setPeer(conversation: Conversation | null | undefined) {
    if (!conversation) return;
    conversationsRef.current.set(conversation.id, conversation);
    const peer = peerPublicKey(conversation);
    if (peer) peerMapRef.current.set(conversation.id, peer);
  }

  const api: CryptoContextType = {
    ready,
    publicKey,
    isEncrypted: (conversation) =>
      conversation?.type === 'DM' && !!peerPublicKey(conversation),
    ensureCEK: async (conversation) => {
      const kp = keyPairRef.current;
      const peer = await resolvePeer(conversation?.id ?? '');
      if (!kp || !peer) return null;
      return deriveConversationKey(kp.privateKey, peer);
    },
    encryptMessage: async (conversation, text) => {
      const kp = keyPairRef.current;
      const peer = await resolvePeer(conversation?.id ?? '');
      if (!kp || !peer) return { content: text }; // passthrough
      const result = await encryptMessage(kp.privateKey, peer, text);
      if (!result) return { content: text };
      return { content: result.content, iv: result.iv };
    },
    decryptMessage: async (conversationId, content, iv) => {
      const kp = keyPairRef.current;
      if (!kp) return content ?? null;
      const peer = await resolvePeer(conversationId);
      return decryptMessage(kp.privateKey, peer, content, iv);
    },
    keyVersion,
    keyMismatch,
    regenerateKeys: async () => {
      const kp = await generateKeyPair();
      await saveKeyPair(kp);
      keyPairRef.current = kp;
      peerMapRef.current.clear();
      setPublicKey(kp.publicKey);
      await updateProfile({ publicKey: kp.publicKey });

      // Re-derive per-conversation keys from the new identity key + peer public
      // keys and re-share them with existing peers. Set keyMismatch if a peer
      // public key is unavailable (cannot re-derive that conversation's key).
      let mismatch = false;
      for (const conv of conversationsRef.current.values()) {
        const peer = peerPublicKey(conv);
        if (!peer) {
          if (conv.type === 'DM') mismatch = true;
          continue;
        }
        peerMapRef.current.set(conv.id, peer);
        try {
          const wrapped = await deriveConversationKeyRaw(kp.privateKey, peer);
          await saveConversationKey(conv.id, wrapped).catch(() => {});
        } catch {
          if (conv.type === 'DM') mismatch = true;
        }
      }
      setKeyMismatch(mismatch);
      setKeyVersion((v) => v + 1);
    },
    importPrivateKey: async (key, passphrase) => {
      const kp = await importWrappedPrivateKey(key, passphrase);
      await saveKeyPair(kp);
      keyPairRef.current = kp;
      peerMapRef.current.clear();
      setPublicKey(kp.publicKey);
      setKeyVersion((v) => v + 1);
    },
    exportBackup: async (passphrase) => {
      if (!keyPairRef.current) throw new Error('No key available');
      return exportWrappedPrivateKey(keyPairRef.current, passphrase);
    },
    registerConversation: (conversation) => setPeer(conversation),
    registerConversations: (conversations) => {
      if (!conversations) return;
      for (const c of conversations) setPeer(c);
    },
  };

  return <CryptoContext.Provider value={api}>{children}</CryptoContext.Provider>;
}

export function useCrypto() {
  const ctx = useContext(CryptoContext);
  if (!ctx) throw new Error('useCrypto must be used within CryptoProvider');
  return ctx;
}
