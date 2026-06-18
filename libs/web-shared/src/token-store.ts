/**
 * Stockage des tokens partagé entre `apps/admin` et `apps/web` (Lot 9).
 * Encapsulé dans une fabrique paramétrée par le préfixe de clé : chaque SPA
 * a son propre espace de stockage (l'admin ne « voit » pas la session joueur
 * et inversement).
 */
export interface StoredUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface TokenStore {
  getAccess: () => string | null;
  getRefresh: () => string | null;
  getUser: () => StoredUser | null;
  set: (access: string, refresh: string, user: StoredUser) => void;
  setAccess: (access: string) => void;
  /**
   * Stocke le nouveau refresh token reçu après rotation. Indispensable pour
   * éviter que le client réutilise l'ancien (déjà révoqué) au prochain
   * refresh — ce qui ferait révoquer toute la `family_id` côté user-service.
   */
  setRefresh: (refresh: string) => void;
  clear: () => void;
}

/**
 * Crée un `TokenStore` adossé à `localStorage`. `prefix` doit être unique par
 * SPA (`betnext.admin` / `betnext.web`).
 */
export function createTokenStore(prefix: string): TokenStore {
  const ACCESS = `${prefix}.accessToken`;
  const REFRESH = `${prefix}.refreshToken`;
  const USER = `${prefix}.user`;
  return {
    getAccess: () => localStorage.getItem(ACCESS),
    getRefresh: () => localStorage.getItem(REFRESH),
    getUser: () => {
      const raw = localStorage.getItem(USER);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StoredUser;
      } catch {
        return null;
      }
    },
    set: (access, refresh, user) => {
      localStorage.setItem(ACCESS, access);
      localStorage.setItem(REFRESH, refresh);
      localStorage.setItem(USER, JSON.stringify(user));
    },
    setAccess: (access) => localStorage.setItem(ACCESS, access),
    setRefresh: (refresh) => localStorage.setItem(REFRESH, refresh),
    clear: () => {
      localStorage.removeItem(ACCESS);
      localStorage.removeItem(REFRESH);
      localStorage.removeItem(USER);
    },
  };
}
