import type { IUser } from './entities';

/**
 * Réponse standard des endpoints d'authentification (login + refresh).
 *
 * - `accessToken` : JWT signé, courte durée de vie (5 min, cf. ADR-009).
 *   À envoyer dans `Authorization: Bearer …` sur chaque appel protégé.
 * - `refreshToken` : token opaque haché en BDD, longue durée (7 j),
 *   **rotatif** : chaque `POST /auth/refresh` invalide l'ancien et renvoie
 *   un nouveau couple. Stocker côté client en httpOnly / Secure storage.
 */
export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Durée de vie de l'access token, en secondes. */
  expiresIn: number;
  /** Date ISO d'expiration du refresh token. */
  refreshExpiresAt: string;
  user: IUser;
}

/**
 * Payload du JWT d'access (signé HS256 par le user-service, vérifié par
 * l'api-gateway en T2.4). `sub` = identifiant utilisateur ; `role` est le
 * rôle unique (cf. BETNEXT_CONTEXT §7).
 */
export interface IAccessTokenPayload {
  sub: number;
  role: string;
  /** Discriminateur — toujours `access` pour éviter de confondre avec un refresh. */
  type: 'access';
  /** Issued at (epoch seconds). Ajouté automatiquement par jsonwebtoken. */
  iat?: number;
  /** Expiration (epoch seconds). Ajoutée automatiquement par jsonwebtoken. */
  exp?: number;
}
