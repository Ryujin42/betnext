import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { Role } from '@betnext/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RelayService } from '../proxy/relay.service';

/**
 * Routes internes admin — démontre la chaîne `JwtAuthGuard` + `RolesGuard`
 * + `@Roles(...)` (DoD T2.4 : un `ROLE_USER` reçoit 403 ici).
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly relay: RelayService) {}

  @Get('ping')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  ping(@CurrentUser() user: AuthenticatedUser): Promise<{ ok: boolean; role: string }> {
    return this.relay.forwardToUserService('GET', '/admin/ping', { user });
  }
}
