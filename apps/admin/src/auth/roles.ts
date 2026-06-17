/** Rôles autorisés sur l'app admin (T8.1 DoD). */
export const ADMIN_ROLES = ['ROLE_ADMIN', 'ROLE_MANAGER'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(role: string | undefined | null): role is AdminRole {
  return role !== null && role !== undefined && (ADMIN_ROLES as readonly string[]).includes(role);
}
