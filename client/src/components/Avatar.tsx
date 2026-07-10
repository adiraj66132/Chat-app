import { assetUrl } from '../api/client';

interface Props {
  name?: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

export default function Avatar({ name, avatarUrl, size = 40, className = '' }: Props) {
  const src = avatarUrl ? assetUrl(avatarUrl) : undefined;
  const initial = (name?.charAt(0) || '?').toUpperCase();

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-telegram-blue text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-bold">{initial}</span>
      )}
    </div>
  );
}
