import { tokenStore } from './tokens';

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

type RefreshResult = { accessToken: string; refreshToken: string } | null;

/**
 * État partagé du refresh : un seul `POST /auth/refresh` en vol, toutes les
 * requêtes 401 concurrentes attendent ce même résultat. Évite un orage de
 * refresh quand une page charge 4 endpoints en parallèle.
 */
let refreshInFlight: Promise<RefreshResult> | null = null;

async function refreshTokens(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;
  refreshInFlight = (async (): Promise<RefreshResult> => {
    try {
      const res = await fetch('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      tokenStore.setAccess(data.accessToken);
      // On garde le user existant ; le refresh ne le renvoie pas forcément.
      return data;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Désactive le retry 401 (utilisé par /auth/login lui-même). */
  skipAuth?: boolean;
  signal?: AbortSignal;
}

/**
 * Fetch typé du gateway BetNext. Garantit :
 * - injection automatique de `Authorization: Bearer <access>`,
 * - retry transparent en cas de 401 (un seul refresh concurrent),
 * - propagation d'une `ApiException` typée en cas d'erreur métier
 *   (`IErrorResponse` du gateway).
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
}
