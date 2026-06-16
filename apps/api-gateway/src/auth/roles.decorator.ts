import { SetMetadata } from '@nestjs/common';
import type { Role } from '@betnext/shared-types';

export const ROLES_METADATA = 'betnext:roles';

/**
 * Marque une route comme accessible uniquement à un ou plusieurs rôles.
 * Lu par {@link RolesGuard}. Doit être combiné avec {@link JwtAuthGuard}.
 */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_METADATA, roles);
