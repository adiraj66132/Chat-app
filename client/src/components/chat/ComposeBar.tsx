import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent, type ChangeEvent } from 'react';
import { motion } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../contexts/SocketContext';
import { tapBounce } from '../../animations/anime';
import { uploadFile, MAX_UPLOAD_BYTES, type UploadResult } from '../../api/uploads';
import EmojiPicker from '../EmojiPicker';

interface Props {
  conversationId: string;
}

export default function ComposeBar({ conversationId }: Props) {
  const [content, setContent] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const sendBtnRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isTypingRef = useRef(false);

  async function send(attachment?: UploadResult) {
    const caption = content.trim();
    if ((!caption && !attachment) || sending || !socket) return;

    if (sendBtnRef.current) tapBounce(sendBtnRef.current);
    setSending(true);
    setContent('');

    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit('chat:stop_typing', { conversationId });
    }

    socket.emit(
      'chat:send',
      {
        conversationId,
        content: caption || undefined,
        type: attachment
          ? attachment.mimeType.startsWith('image/')
            ? 'IMAGE'
            : 'FILE'
          : 'TEXT',
        fileUrl: attachment?.fileUrl,
        fileName: attachment?.fileName,
        fileSize: attachment?.fileSize,
        mimeType: attachment?.mimeType,
      },
      (ack: { ok: boolean; message?: any; error?: string }) => {
        if (ack.ok) {
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
        setSending(false);
        inputRef.current?.focus();
      }
    );
  }

  function insertEmoji(e: string) {
    setContent((prev) => prev + e);
    inputRef.current?.focus();
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      console.warn('File exceeds the 100MB limit');
      return;
    }
    setUploading(true);
    try {
      const res = await uploadFile(file);
      send(res);
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // Emit typing events
  useEffect(() => {
    if (!socket) return;
    if (content.length > 0 && !isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('chat:typing', { conversationId });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        socket.emit('chat:stop_typing', { conversationId });
      }
    }, 2000);

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [content, socket, conversationId]);

  return (
    <form onSubmit={handleSubmit} className="border-t border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
      <div className="relative flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-overlay)]"
            title="Emoji"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>
          {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!connected || uploading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-overlay)] disabled:opacity-30"
          title="Attach file"
        >
          {uploading ? (
            <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={connected ? 'Type a message...' : 'Reconnecting...'}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[var(--text-primary)] outline-none transition-shadow placeholder:text-[var(--text-muted)] focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.12)]"
          disabled={sending || !connected}
        />
        <motion.button
          ref={sendBtnRef}
          type="submit"
          disabled={!content.trim() || sending || !connected}
          whileTap={{ scale: 0.9 }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-telegram-blue text-white transition-all hover:bg-[#2499d4] disabled:opacity-30"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </motion.button>
      </div>
    </form>
  );
}
