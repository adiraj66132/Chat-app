import { useState, useRef, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile, updateAvatar, changePassword } from '../api/users';
import { useNavigate } from 'react-router-dom';
import { fadeUp, containerStagger, easeOut } from '../animations/motion';
import { pop } from '../animations/anime';
import { assetUrl } from '../api/client';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);

  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const updated = await updateProfile({ username, displayName, bio });
      updateUser(updated);
      setMessage('Profile updated');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const updated = await updateAvatar(file);
      updateUser(updated);
      if (avatarRef.current) pop(avatarRef.current);
      setMessage('Avatar updated');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update avatar');
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPwMessage('');
    if (newPassword.length < 8) {
      setPwMessage('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage('New passwords do not match');
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwMessage('Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    } catch (err) {
      setPwMessage(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
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
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Edit Profile</h1>
      </motion.div>

      <motion.div variants={fadeUp} className="mb-8 flex flex-col items-center">
        <motion.button
          ref={avatarRef}
          onClick={() => fileInput.current?.click()}
          whileTap={{ scale: 0.95 }}
          className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-telegram-blue text-3xl font-bold text-white transition-opacity hover:opacity-90"
        >
          {user?.avatarUrl ? (
            <img src={assetUrl(user.avatarUrl)} alt="" className="h-full w-full object-cover" />
          ) : (
            user?.displayName?.charAt(0).toUpperCase()
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-normal transition-colors group-hover:bg-black/30 group-hover:backdrop-blur-sm">
            <span className="hidden group-hover:block">Change</span>
          </div>
        </motion.button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Tap to change photo</p>
      </motion.div>

      <motion.form variants={fadeUp} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-[var(--text-muted)]">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[var(--text-primary)] outline-none transition-shadow placeholder:text-[var(--text-muted)] focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.15)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-[var(--text-muted)]">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[var(--text-primary)] outline-none transition-shadow placeholder:text-[var(--text-muted)] focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.15)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-[var(--text-muted)]">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[var(--text-primary)] outline-none transition-shadow placeholder:text-[var(--text-muted)] focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.15)]"
            placeholder="Tell us about yourself…"
          />
        </div>

        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={easeOut}
              className="rounded-xl bg-telegram-blue/10 px-4 py-3 text-sm text-telegram-blue"
            >
              {message}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-telegram-blue px-4 py-3 font-medium text-white transition-all hover:bg-[#2499d4] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </motion.form>

      <motion.div variants={fadeUp} className="mt-8">
        <button
          onClick={() => setShowPassword((s) => !s)}
          className="flex w-full items-center justify-between rounded-xl bg-[var(--bg-surface)] px-4 py-3 text-left font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-overlay)]"
        >
          <span>Change Password</span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-[var(--text-muted)] transition-transform ${showPassword ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <AnimatePresence>
          {showPassword && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={easeOut}
              onSubmit={handlePasswordChange}
              className="overflow-hidden"
            >
              <div className="space-y-4 pt-4">
                <div>
                  <label className="mb-1 block text-sm text-[var(--text-muted)]">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[var(--text-primary)] outline-none transition-shadow focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.15)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[var(--text-muted)]">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[var(--text-primary)] outline-none transition-shadow focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.15)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[var(--text-muted)]">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[var(--text-primary)] outline-none transition-shadow focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.15)]"
                  />
                </div>

                <AnimatePresence>
                  {pwMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={easeOut}
                      className={`rounded-xl px-4 py-3 text-sm ${
                        pwMessage.includes('changed')
                          ? 'bg-telegram-blue/10 text-telegram-blue'
                          : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {pwMessage}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={pwSaving}
                  className="w-full rounded-xl bg-telegram-blue px-4 py-3 font-medium text-white transition-all hover:bg-[#2499d4] disabled:opacity-50"
                >
                  {pwSaving ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
