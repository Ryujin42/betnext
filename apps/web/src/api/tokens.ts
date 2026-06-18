import { createTokenStore } from '@betnext/web-shared';

/** Token store de la SPA joueurs — préfixe `betnext.web` (isolé d'`apps/admin`). */
export const tokenStore = createTokenStore('betnext.web');
export type { StoredUser } from '@betnext/web-shared';
