/**
 * Stockage des tokens dans `localStorage` (Lot 8 — choix assumé : pas de
 * cookies httpOnly pour simplifier en contexte école). Encapsulé ici pour
 * pouvoir migrer vers un cookie httpOnly plus tard sans toucher aux
 * consommateurs.
 */

const ACCESS_KEY = 'betnext.admin.accessToken';
const REFRESH_KEY = 'betnext.admin.refreshToken';
const USER_KEY = 'betnext.admin.user';

export interface StoredUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

export const tokenStore = {
  getAccess(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  getUser(): StoredUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      return null;
    }
  },
  set(access: string, refresh: string, user: StoredUser): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  setAccess(access: string): void {
    localStorage.setItem(ACCESS_KEY, access);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
