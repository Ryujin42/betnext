import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ApiFn } from './api-client';
import type { StoredUser, TokenStore } from './token-store';

interface AuthState {
  user: StoredUser | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<StoredUser>;
  register: (input: RegisterInput) => Promise<StoredUser>;
  logout: () => void;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  birthDate: string;
  acceptTos: boolean;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: StoredUser;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provider d'auth réutilisable (Lot 9). `apps/admin` et `apps/web` injectent
 * leurs propres `tokenStore` et `api` (préfixe localStorage différent).
 */
export function createAuthProvider(deps: { api: ApiFn; tokenStore: TokenStore }) {
  return function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<StoredUser | null>(() => deps.tokenStore.getUser());
    const [loading, setLoading] = useState(false);

    const login = useCallback(async (email: string, password: string): Promise<StoredUser> => {
      setLoading(true);
      try {
        const res = await deps.api<LoginResponse>('/auth/login', {
          method: 'POST',
          body: { email, password },
          skipAuth: true,
        });
        deps.tokenStore.set(res.accessToken, res.refreshToken, res.user);
        setUser(res.user);
        return res.user;
      } finally {
        setLoading(false);
      }
    }, []);

    const register = useCallback(async (input: RegisterInput): Promise<StoredUser> => {
      setLoading(true);
      try {
        await deps.api<StoredUser>('/auth/register', {
          method: 'POST',
          body: input,
          skipAuth: true,
        });
        // Inscription réussie → on enchaîne avec un login pour récupérer les tokens.
        const res = await deps.api<LoginResponse>('/auth/login', {
          method: 'POST',
          body: { email: input.email, password: input.password },
          skipAuth: true,
        });
        deps.tokenStore.set(res.accessToken, res.refreshToken, res.user);
        setUser(res.user);
        return res.user;
      } finally {
        setLoading(false);
      }
    }, []);

    const logout = useCallback(() => {
      deps.tokenStore.clear();
      setUser(null);
    }, []);

    const value = useMemo<AuthContextValue>(
      () => ({ user, loading, login, register, logout }),
      [user, loading, login, register, logout],
    );
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  };
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé sous un <AuthProvider>.');
  return ctx;
}
