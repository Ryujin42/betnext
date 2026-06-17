import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@betnext/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RelayService } from '../proxy/relay.service';

/**
 * Routes admin — `JwtAuthGuard` + `RolesGuard` + `@Roles(...)`. Relais vers
 * user-service. Les KPIs sont visibles aussi du manager (vue tech) ;
 * les actions sur les utilisateurs (suspendre/réactiver) restent ADMIN-only.
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

  /** T8.2 — KPI dashboard : accessible au manager ET à l'admin. */
  @Get('kpis')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.MANAGER)
  kpis(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.relay.forwardToUserService('GET', '/admin/kpis', { user });
  }

  // ── T8.3 — Gestion des utilisateurs (ADMIN-only) ──────────────────────

  @Get('users')
  @Roles(Role.ADMIN)
  listUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string>,
  ): Promise<unknown> {
    const qs = new URLSearchParams(query).toString();
    return this.relay.forwardToUserService('GET', `/admin/users${qs ? `?${qs}` : ''}`, { user });
  }

  @Get('users/:id')
  @Roles(Role.ADMIN)
  getUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<unknown> {
    return this.relay.forwardToUserService('GET', `/admin/users/${id}`, { user });
  }

  @Get('users/:id/rg')
  @Roles(Role.ADMIN)
  getUserRg(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<unknown> {
    return this.relay.forwardToUserService('GET', `/admin/users/${id}/rg`, { user });
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  suspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.relay.forwardToUserService('POST', `/admin/users/${id}/suspend`, {
      user,
      body: body ?? {},
    });
  }

  @Post('users/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  unsuspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<unknown> {
    return this.relay.forwardToUserService('POST', `/admin/users/${id}/unsuspend`, {
      user,
      body: {},
    });
  }
}
