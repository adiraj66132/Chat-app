import Sidebar from '../components/chat/Sidebar';
import ChatView from '../components/chat/ChatView';

export default function ChatLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      <Sidebar />
      <ChatView />
    </div>
  );
}
