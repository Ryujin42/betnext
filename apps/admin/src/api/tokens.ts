import { createTokenStore } from '@betnext/web-shared';

/** Token store de l'admin SPA — préfixe `betnext.admin` (isolé d'`apps/web`). */
export const tokenStore = createTokenStore('betnext.admin');
export type { StoredUser } from '@betnext/web-shared';
