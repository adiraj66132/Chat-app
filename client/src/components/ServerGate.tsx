import { useState, useEffect, type ReactNode } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ServerGate({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function check() {
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (res.ok && !cancelled) {
          setOnline(true);
          return;
        }
      } catch {
        // server not reachable
      }
      if (!cancelled) {
        timer = setTimeout(check, 2000);
      }
    }

    check();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (online) return <>{children}</>;

  return (
    <>
      <style>{`
        .offline-page {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #0c0c0c;
          color: #fff;
          font-family: 'Press Start 2P', monospace;
          text-align: center;
          padding: 20px;
        }
        .offline-page img { max-width: 300px; width: 100%; margin-bottom: 24px; image-rendering: pixelated; }
        .offline-page h1 { font-size: clamp(2rem, 8vw, 4rem); margin: 0 0 16px; }
        .offline-page p { font-size: clamp(0.7rem, 3vw, 1rem); margin: 0 0 32px; opacity: 0.8; }
      `}</style>
      <div className="offline-page">
        <img src="https://i.suar.me/Bj6v2/m" alt="offline" />
        <h1>404</h1>
        <p>Server unreachable</p>
        <p style={{ fontSize: '0.65rem', opacity: 0.5 }}>
          retrying connection<span style={{ animation: 'pulse 1.5s infinite' }}>...</span>
        </p>
        <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
      </div>
    </>
  );
}
