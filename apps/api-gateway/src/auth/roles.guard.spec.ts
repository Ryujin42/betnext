import { Reflector } from '@nestjs/core';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { BetNextErrorCode, Role } from '@betnext/shared-types';
import { BetNextException } from '../common/exceptions/betnext.exception';
import { ROLES_METADATA } from './roles.decorator';
import { RolesGuard } from './roles.guard';

function makeCtx(user: { id: number; role: Role } | null): ExecutionContext {
  const req = user ? { user } : {};
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function makeReflector(roles: Role[] | undefined): Reflector {
  return {
    getAllAndOverride: jest
      .fn()
      .mockImplementation((key) => (key === ROLES_METADATA ? roles : undefined)),
  } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it("laisse passer quand aucun @Roles n'est posé", () => {
    const guard = new RolesGuard(makeReflector(undefined));
    expect(guard.canActivate(makeCtx({ id: 1, role: Role.USER }))).toBe(true);
  });

  it('laisse passer un user dont le rôle est dans la liste requise', () => {
    const guard = new RolesGuard(makeReflector([Role.ADMIN, Role.MANAGER]));
    expect(guard.canActivate(makeCtx({ id: 1, role: Role.ADMIN }))).toBe(true);
  });

  it('refuse 403 quand le rôle ne matche pas, en exposant les rôles attendus', () => {
    const guard = new RolesGuard(makeReflector([Role.ADMIN]));
    try {
      guard.canActivate(makeCtx({ id: 1, role: Role.USER }));
      fail('attendu un throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BetNextException);
      const e = err as BetNextException;
      expect(e.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(e.errorCode).toBe(BetNextErrorCode.INVALID_CREDENTIALS);
      expect(e.details).toEqual({
        requiredRoles: [Role.ADMIN],
        actualRole: Role.USER,
      });
    }
  });

  it("refuse quand aucun user n'est attaché à la requête (guard JWT non passée)", () => {
    const guard = new RolesGuard(makeReflector([Role.USER]));
    expect(() => guard.canActivate(makeCtx(null))).toThrow(BetNextException);
  });
});
