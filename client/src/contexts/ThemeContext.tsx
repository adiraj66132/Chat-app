import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { updateTheme as updateThemeApi } from '../api/users';

type Theme = 'LIGHT' | 'DARK' | 'TELEGRAM' | 'NORD';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  persistTheme: (theme: Theme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'TELEGRAM';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark', 'telegram', 'nord');
    if (theme === 'LIGHT') {
      root.classList.add('light');
    } else if (theme === 'DARK') {
      root.classList.add('dark');
    } else if (theme === 'NORD') {
      root.classList.add('nord');
    } else {
      root.classList.add('telegram');
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
