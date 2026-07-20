import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { updateTheme as updateThemeApi } from '../api/users';

type Theme = 'LIGHT' | 'DARK' | 'AURORA' | 'NORD' | 'ROSE';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  persistTheme: (theme: Theme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme');
    // Migrate the legacy 'TELEGRAM' value to its renamed equivalent.
    if (stored === 'TELEGRAM') return 'AURORA';
    return (stored as Theme) || 'AURORA';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark', 'aurora', 'nord', 'rose');
    if (theme === 'LIGHT') {
      root.classList.add('light');
    } else if (theme === 'DARK') {
      root.classList.add('dark');
    } else if (theme === 'NORD') {
      root.classList.add('nord');
    } else if (theme === 'ROSE') {
      root.classList.add('rose');
    } else {
      root.classList.add('aurora');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const persistTheme = useCallback(async (newTheme: Theme) => {
    setTheme(newTheme);
    try {
      await updateThemeApi(newTheme);
    } catch {
      // ignore — theme is still applied locally
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, persistTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
