import { createContext, useContext, type ReactNode } from 'react';
import type { Conversation } from '../types/conversation';

interface CryptoContextType {
  ready: boolean;
  isEncrypted: (conversation: Conversation | null | undefined) => boolean;
  ensureCEK: (conversation: Conversation | null | undefined) => Promise<CryptoKey | null>;
  encryptMessage: (conversation: Conversation | null | undefined, text: string) => Promise<{ content: string; iv?: string }>;
  decryptMessage: (conversationId: string, content: string | null | undefined, iv: string | null | undefined) => Promise<string | null>;
  keyVersion: number;
  keyMismatch: boolean;
  rewrapCEK: (conversationId: string, newUserIds: string[]) => Promise<void>;
  regenerateKeys: () => Promise<void>;
  importPrivateKey: (key: string) => void;
}

const CryptoContext = createContext<CryptoContextType | null>(null);

export function CryptoProvider({ children }: { children: ReactNode }) {
  const value: CryptoContextType = {
    ready: true,
    isEncrypted: () => false,
    ensureCEK: async () => null,
    encryptMessage: async (_conv, text) => ({ content: text }),
    decryptMessage: async (_id, content) => content ?? null,
    keyVersion: 0,
    keyMismatch: false,
    rewrapCEK: async () => {},
    regenerateKeys: async () => {},
    importPrivateKey: () => {},
  };

  return (
    <CryptoContext.Provider value={value}>
      {children}
    </CryptoContext.Provider>
  );
}

export function useCrypto() {
  const ctx = useContext(CryptoContext);
  if (!ctx) throw new Error('useCrypto must be used within CryptoProvider');
  return ctx;
}
