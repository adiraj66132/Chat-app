import { useRef, useEffect } from 'react';

const EMOJI = [
  '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗',
  '😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐',
  '😯','😪','😫','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲',
  '☹️','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱',
  '🥵','🥶','😳','🤪','😵','😡','😠','🤬','👍','👎','👊','✊','🤛','🤜','👏','🙌',
  '👐','🤲','🤝','🙏','✌️','🤟','🤘','👌','💪','❤️','🧡','💛','💚','💙','💜','🖤',
  '💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','😁','🎉','🎊','✨','🔥','💯',
];

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-50 mb-1 w-[280px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-2 shadow-xl"
    >
      <div className="flex flex-wrap gap-1">
        {EMOJI.map((e) => (
          <button
            key={e}
            onClick={() => { onSelect(e); onClose(); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-[var(--hover-overlay)]"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
