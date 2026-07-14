import { useEffect, useState } from 'react';

function useServerStatus() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/health', { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error();
        if (!cancelled) setOffline(false);
      } catch {
        if (!cancelled) setOffline(true);
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return offline;
}

export default function ServerStatus({ children }: { children: React.ReactNode }) {
  const offline = useServerStatus();

  if (!offline) return <>{children}</>;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
      fontFamily: 'system-ui, sans-serif', gap: 16,
    }}>
      <div style={{ fontSize: 48, opacity: 0.6 }}>🔌</div>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
        Server Offline
      </h1>
      <p style={{ margin: 0, fontSize: 14 }}>
        The server is not responding. Reconnecting…
      </p>
      <div style={{ width: 24, height: 24, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}
