import { ChatProvider } from '../contexts/ChatContext';
import { SocketProvider } from '../contexts/SocketContext';
import ChatLayout from '../layouts/ChatLayout';

export default function ChatPage() {
  return (
    <SocketProvider>
      <ChatProvider>
        <ChatLayout />
      </ChatProvider>
    </SocketProvider>
  );
}
