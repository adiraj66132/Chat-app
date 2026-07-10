import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthCard from '../components/auth/AuthCard';
import { shake } from '../animations/anime';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
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
      await login({ username, password });
      navigate('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your account"
      error={error}
      errorRef={errorRef}
      onSubmit={handleSubmit}
      footer={
        <>
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-telegram-blue hover:underline">
            Create one
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
      <div className="relative">
        <input
          type={showPw ? 'text' : 'password'}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 pr-10 text-[var(--text-primary)] outline-none transition-shadow focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.15)]"
          required
          autoComplete="current-password"
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
        {submitting ? 'Signing in…' : 'Sign In'}
      </button>
    </AuthCard>
  );
}
