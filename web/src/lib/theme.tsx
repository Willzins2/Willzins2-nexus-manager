import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
const KEY = 'nexus-theme';

interface ThemeState {
  mode: ThemeMode;
  dark: boolean;
  setMode: (m: ThemeMode) => void;
}

const Ctx = createContext<ThemeState>({ mode: 'system', dark: false, setMode: () => undefined });

const read = (): ThemeMode => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
};

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(read);
  const [dark, setDark] = useState(() => mode === 'dark' || (mode === 'system' && systemDark()));

  useEffect(() => {
    const apply = () => {
      const d = mode === 'dark' || (mode === 'system' && systemDark());
      setDark(d);
      document.documentElement.classList.toggle('dark', d);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', d ? '#0b1120' : '#2552eb');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* armazenamento indisponível: vale só nesta sessão */
    }
  };

  return <Ctx.Provider value={{ mode, dark, setMode }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
