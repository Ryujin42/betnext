import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException, api } from './client';
import { tokenStore } from './tokens';

describe('api() — intercepteur fetch-and-retry (T8.1)', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    localStorage.clear();
    fetchSpy.mockReset();
  });
  afterEach(() => {
    fetchSpy.mockReset();
  });

  it('injecte Authorization Bearer si access token présent', async () => {
    tokenStore.set('acc.1', 'refr.1', { id: 1, email: 'a', name: 'a', role: 'ROLE_ADMIN' });
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }) as Response,
    );
    await api<{ ok: true }>('/me');
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer acc.1');
  });

  it('sur 401 : tente un refresh transparent et rejoue la requête initiale', async () => {
    tokenStore.set('acc.expired', 'refr.ok', {
      id: 1,
      email: 'a',
      name: 'a',
      role: 'ROLE_ADMIN',
    });
    // 1er appel /me → 401 (access expiré)
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 401 }) as Response);
    // refresh → 200 avec nouveau token
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ accessToken: 'acc.new', refreshToken: 'refr.new' }), {
        status: 200,
      }) as Response,
    );
    // rejeu /me → 200
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }) as Response,
    );

    const result = await api<{ ok: true }>('/me');

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(tokenStore.getAccess()).toBe('acc.new');
    // Le nouveau refresh doit être stocké pour la prochaine rotation ; sinon
    // le client réutilise l'ancien (déjà révoqué) → révocation famille → 401.
    expect(tokenStore.getRefresh()).toBe('refr.new');

    // Le rejeu utilise le nouvel access token.
    const finalCall = fetchSpy.mock.calls[2][1] as RequestInit;
    expect((finalCall.headers as Record<string, string>).Authorization).toBe('Bearer acc.new');
  });

  it('si le refresh échoue, propage 401 en ApiException', async () => {
    tokenStore.set('acc.expired', 'refr.expired', {
      id: 1,
      email: 'a',
      name: 'a',
      role: 'ROLE_ADMIN',
    });
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 401 }) as Response);
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 401 }) as Response);

    await expect(api('/me')).rejects.toBeInstanceOf(ApiException);
  });

  it("skipAuth=true n'envoie pas l'Authorization (utile pour /auth/login)", async () => {
    tokenStore.set('acc.1', 'refr.1', { id: 1, email: 'a', name: 'a', role: 'ROLE_ADMIN' });
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }) as Response,
    );
    await api('/auth/login', { method: 'POST', body: {}, skipAuth: true });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
