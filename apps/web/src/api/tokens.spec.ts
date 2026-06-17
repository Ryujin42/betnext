import { afterEach, describe, expect, it } from 'vitest';
import { tokenStore } from './tokens';

describe('tokenStore (web — Lot 9 T9.1)', () => {
  afterEach(() => localStorage.clear());

  it("persiste un user dans le namespace `betnext.web` (isolé de l'admin)", () => {
    tokenStore.set('acc.1', 'refr.1', { id: 1, email: 'a', name: 'a', role: 'ROLE_USER' });
    expect(localStorage.getItem('betnext.web.accessToken')).toBe('acc.1');
    expect(localStorage.getItem('betnext.admin.accessToken')).toBeNull();
  });

  it('retourne null sur des données corrompues sans crash', () => {
    localStorage.setItem('betnext.web.user', '<<not-json>>');
    expect(tokenStore.getUser()).toBeNull();
  });

  it('clear vide les 3 clés', () => {
    tokenStore.set('a', 'r', { id: 1, email: '', name: '', role: '' });
    tokenStore.clear();
    expect(tokenStore.getAccess()).toBeNull();
    expect(tokenStore.getRefresh()).toBeNull();
    expect(tokenStore.getUser()).toBeNull();
  });
});
