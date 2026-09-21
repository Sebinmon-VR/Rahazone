import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';
import { setCurrency } from './format';
import type { Settings, User } from './types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  settings: Settings;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

const DEFAULT_SETTINGS: Settings = { currency: 'INR' };
const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(!!getToken());

  const applySettings = useCallback((s: Settings) => { setCurrency(s.currency); setSettingsState(s); }, []);
  const loadSettings = useCallback(() => api<Settings>('/settings').then(applySettings).catch(() => {}), [applySettings]);

  useEffect(() => {
    if (!getToken()) return;
    api<{ user: User }>('/auth/me')
      .then(async r => { await loadSettings(); setUser(r.user); })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, [loadSettings]);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('rz:logout', onLogout);
    return () => window.removeEventListener('rz:logout', onLogout);
  }, []);

  const login = async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/auth/login', { body: { email, password } });
    setToken(r.token);
    await loadSettings();
    setUser(r.user);
  };
  const logout = () => { setToken(null); setUser(null); };
  const updateSettings = async (patch: Partial<Settings>) => {
    applySettings(await api<Settings>('/settings', { method: 'PUT', body: patch }));
  };

  return <Ctx.Provider value={{ user, loading, settings, login, logout, updateSettings }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
