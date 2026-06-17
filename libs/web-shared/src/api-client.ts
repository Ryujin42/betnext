import type { TokenStore } from './token-store';

export interface ApiError {
  statusCode: number;
  errorCode: string;
  message: string;
  details?: Record<string, unknown>;
  traceId: string;
}

export class ApiException extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | null,
  ) {
    super(body?.message ?? `HTTP ${status}`);
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Désactive l'injection du Bearer + le retry 401 (utile pour `/auth/login`). */
  skipAuth?: boolean;
  signal?: AbortSignal;
}

export type ApiFn = <T>(path: string, options?: RequestOptions) => Promise<T>;

/**
 * Crée un client HTTP avec :
 * - injection automatique de `Authorization: Bearer <access>`,
 * - retry transparent en cas de 401 (un seul `/auth/refresh` concurrent
 *   partagé : pas d'orage de refresh sur une page qui charge 4 endpoints),
 * - `ApiException` typée avec l'`IErrorResponse` du gateway en cas d'erreur.
 */
export function createApiClient(tokenStore: TokenStore): ApiFn {
  let refreshInFlight: Promise<{ accessToken: string; refreshToken: string } | null> | null = null;

  const refreshTokens = async (): Promise<{ accessToken: string; refreshToken: string } | null> => {
    if (refreshInFlight) return refreshInFlight;
    const refresh = tokenStore.getRefresh();
    if (!refresh) return null;
    refreshInFlight = (async () => {
      try {
        const res = await fetch('/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: refresh }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        tokenStore.setAccess(data.accessToken);
        return data;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  };

  return async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const { method = 'GET', body, skipAuth = false, signal } = options;

    const send = async (token: string | null): Promise<Response> => {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return fetch(path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      });
    };

    let response = await send(skipAuth ? null : tokenStore.getAccess());

    if (response.status === 401 && !skipAuth) {
      const refreshed = await refreshTokens();
      if (refreshed) {
        response = await send(refreshed.accessToken);
      }
    }

    if (!response.ok) {
      let parsed: ApiError | null = null;
      try {
        parsed = (await response.json()) as ApiError;
      } catch {
        parsed = null;
      }
      throw new ApiException(response.status, parsed);
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  };
}
