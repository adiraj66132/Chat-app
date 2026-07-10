import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthCard from '../components/auth/AuthCard';
import { shake } from '../animations/anime';

export default function Register() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error && errorRef.current) shake(errorRef.current);
  }, [error]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register({
        username,
        password,
        displayName: displayName || undefined,
      });
      navigate('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Join the conversation"
      error={error}
      errorRef={errorRef}
      onSubmit={handleSubmit}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-telegram-blue hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[var(--text-primary)] outline-none transition-shadow focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.15)]"
          required
          autoComplete="username"
        />
      </div>
      <div>
        <input
          type="text"
          placeholder="Display Name (optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[var(--text-primary)] outline-none transition-shadow focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.15)]"
        />
      </div>
      <div className="relative">
        <input
          type={showPw ? 'text' : 'password'}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 pr-10 text-[var(--text-primary)] outline-none transition-shadow focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.15)]"
          required
          minLength={6}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShowPw(!showPw)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          tabIndex={-1}
        >
          {showPw ? 'Hide' : 'Show'}
        </button>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-telegram-blue px-4 py-3 font-medium text-white transition-all hover:bg-[#2499d4] disabled:opacity-50"
      >
        {submitting ? 'Creating account…' : 'Create Account'}
      </button>
    </AuthCard>
  );
}
