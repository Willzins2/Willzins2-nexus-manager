import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setUnauthorizedHandler } from '../lib/api';
import type { Role, User } from '../lib/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { companyName: string; name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  can: (...roles: Role[]) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    api
      .get<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    // Sessão expirou durante o uso: volta para o login.
    setUnauthorizedHandler(() => {
      setUser(null);
      qc.clear();
    });
  }, [qc]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.post<{ user: User }>('/auth/login', { email, password });
    setUser(r.user);
  }, []);

  const register = useCallback(async (data: { companyName: string; name: string; email: string; password: string }) => {
    const r = await api.post<{ user: User }>('/auth/register', data);
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setUser(null);
    qc.clear();
  }, [qc]);

  const can = useCallback((...roles: Role[]) => !!user && roles.includes(user.role), [user]);

  const value = useMemo(() => ({ user, loading, login, register, logout, setUser, can }), [user, loading, login, register, logout, can]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
