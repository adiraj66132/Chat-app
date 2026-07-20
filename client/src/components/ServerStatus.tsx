import { useEffect, useRef, useState } from 'react';

type Status = 'connecting' | 'online' | 'offline';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

function useServerStatus(): Status {
  const [status, setStatus] = useState<Status>('connecting');
  // Once we've connected at least once, transient failures should degrade to a
  // non-blocking banner rather than tearing down the whole app.
  const everConnected = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error();
        if (!cancelled) {
          everConnected.current = true;
          setStatus('online');
        }
      } catch {
        if (!cancelled) setStatus('offline');
      }
    };

    check();
    // Poll faster while we're not connected so recovery feels snappy, slower
    // once healthy to avoid needless traffic.
    const interval = setInterval(check, status === 'online' ? 8000 : 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [status]);

  return status;
}

function FullScreen({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
      fontFamily: 'system-ui, sans-serif', gap: 16,
    }}>
      <div style={{ fontSize: 48, opacity: 0.6 }}>🔌</div>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h1>
      <p style={{ margin: 0, fontSize: 14 }}>{sub}</p>
      <div style={{ width: 24, height: 24, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent, #2AABEE)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

export default function ServerStatus({ children }: { children: React.ReactNode }) {
  const status = useServerStatus();
  // Track whether we've ever been online so we know which offline UX to show.
  const [hasConnected, setHasConnected] = useState(false);
  useEffect(() => { if (status === 'online') setHasConnected(true); }, [status]);

  // First contact still pending — nothing to show yet.
  if (status === 'connecting' && !hasConnected) {
    return <FullScreen title="Connecting…" sub="Reaching the server" />;
  }

  // Never connected and the server is down — full-screen (app can't work yet).
  if (status === 'offline' && !hasConnected) {
    return <FullScreen title="Server Offline" sub="The server is not responding. Retrying…" />;
  }

  // We were connected before: keep the app usable, show a slim reconnect banner.
  return (
    <>
      {status === 'offline' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '8px 12px', background: '#c0392b', color: '#fff',
          fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: 500,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          <span style={{
            width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)',
            borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite',
          }} />
          Connection lost — reconnecting…
          <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
        </div>
      )}
      {children}
    </>
  );
}
