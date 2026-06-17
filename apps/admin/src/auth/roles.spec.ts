import { describe, expect, it } from 'vitest';
import { isAdminRole } from './roles';

describe('isAdminRole (T8.1)', () => {
  it('autorise ROLE_ADMIN et ROLE_MANAGER', () => {
    expect(isAdminRole('ROLE_ADMIN')).toBe(true);
    expect(isAdminRole('ROLE_MANAGER')).toBe(true);
  });

  it('refuse ROLE_USER (DoD — bloqué hors admin)', () => {
    expect(isAdminRole('ROLE_USER')).toBe(false);
  });

  it('refuse null / undefined / valeurs inconnues', () => {
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole('ROLE_BOSS')).toBe(false);
  });
});
