import { motion } from 'motion/react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { fadeUp, containerStagger, easeOut } from '../animations/motion';

const themes = [
  { value: 'LIGHT', label: 'Light', icon: '☀️' },
  { value: 'DARK', label: 'Dark', icon: '🌙' },
  { value: 'TELEGRAM', label: 'Telegram', icon: '💬' },
  { value: 'NORD', label: 'Nord', icon: '❄️' },
] as const;

export default function Settings() {
  const { theme, persistTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerStagger(0.06)}
      className="mx-auto max-w-lg px-4 py-6"
    >
      <motion.div variants={fadeUp} className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-telegram-blue/10 text-telegram-blue">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Settings</h1>
      </motion.div>

      <motion.div variants={fadeUp} className="mb-8">
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Profile
        </h2>
        <div
          className="flex cursor-pointer items-center gap-4 rounded-xl bg-[var(--bg-surface)] p-4 transition-colors hover:bg-[var(--hover-overlay)]"
          onClick={() => navigate('/profile')}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-telegram-blue text-lg font-bold text-white">
            {user?.displayName?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-[var(--text-primary)]">{user?.displayName}</p>
            <p className="truncate text-sm text-[var(--text-secondary)]">@{user?.username}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[var(--text-muted)]"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="mb-8">
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Theme
        </h2>
        <div className="space-y-1">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => persistTheme(t.value)}
              className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition-colors ${
                theme === t.value
                  ? 'bg-telegram-blue/10 text-telegram-blue'
                  : 'bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]'
              }`}
            >
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="text-lg"
              >
                {t.icon}
              </motion.span>
              <span className="font-medium">{t.label}</span>
              {theme === t.value && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={easeOut}
                  className="ml-auto"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </motion.span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.button
        variants={fadeUp}
        onClick={handleLogout}
        whileTap={{ scale: 0.98 }}
        className="w-full rounded-xl bg-red-500/10 px-4 py-3 font-medium text-red-500 transition-colors hover:bg-red-500/20"
      >
        Sign Out
      </motion.button>
    </motion.div>
  );
}
