import { createAuthProvider, useAuth } from '@betnext/web-shared';
import { api } from '../api/client';
import { tokenStore } from '../api/tokens';

/** Provider d'auth de la SPA joueurs (Lot 9 T9.1). */
export const AuthProvider = createAuthProvider({ api, tokenStore });
export { useAuth };
