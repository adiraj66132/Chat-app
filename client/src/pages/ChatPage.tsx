import { ChatProvider } from '../contexts/ChatContext';
import { SocketProvider } from '../contexts/SocketContext';
import { CryptoProvider } from '../contexts/CryptoContext';
import ChatLayout from '../layouts/ChatLayout';

export default function ChatPage() {
  return (
    <SocketProvider>
      <ChatProvider>
        <CryptoProvider>
          <ChatLayout />
        </CryptoProvider>
      </ChatProvider>
    </SocketProvider>
  );
}
