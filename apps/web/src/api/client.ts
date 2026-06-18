import { createApiClient } from '@betnext/web-shared';
import { tokenStore } from './tokens';

export const api = createApiClient(tokenStore);
export { ApiException } from '@betnext/web-shared';
export type { ApiError } from '@betnext/web-shared';
