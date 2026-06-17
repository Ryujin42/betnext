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
import type { IRgProfile } from '@betnext/shared-types';
import { InternalAuthGuard, type InternalUser } from '../common/internal-auth.guard';
import { Internal } from '../common/internal-user.decorator';
import { ListUsersDto } from './dto/list-users.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { AdminKpis, KpisService } from './kpis.service';
import { AdminUserView, PaginatedUsers, UsersAdminService } from './users-admin.service';
import { RgProfilesService } from '../rg/rg-profiles.service';

/**
 * Endpoints admin internes (T2.4 + T8.2 + T8.3). Le contrôle du rôle reste
 * fait au gateway (`@Roles(ROLE_ADMIN/MANAGER)`) ; la garde locale vérifie
 * juste les headers internes `x-user-id` / `x-user-role`.
 */
@Controller('admin')
@UseGuards(InternalAuthGuard)
export class AdminController {
  constructor(
    private readonly kpis: KpisService,
    private readonly usersAdmin: UsersAdminService,
    private readonly rg: RgProfilesService,
  ) {}

  @Get('ping')
  @HttpCode(HttpStatus.OK)
  ping(@Internal() user: InternalUser): { ok: true; role: string; userId: number } {
    return { ok: true, role: user.role, userId: user.id };
  }

  @Get('kpis')
  @HttpCode(HttpStatus.OK)
  getKpis(): Promise<AdminKpis> {
    return this.kpis.getKpis();
  }

  @Get('users')
  listUsers(@Query() query: ListUsersDto): Promise<PaginatedUsers> {
    return this.usersAdmin.list(query);
  }

  @Get('users/:id')
  getUser(@Param('id', ParseIntPipe) id: number): Promise<AdminUserView> {
    return this.usersAdmin.get(id);
  }

  @Get('users/:id/rg')
  getUserRg(@Param('id', ParseIntPipe) id: number): Promise<IRgProfile> {
    return this.rg.getProfile(id);
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(
    @Internal() admin: InternalUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SuspendUserDto,
  ): Promise<AdminUserView> {
    return this.usersAdmin.suspend(id, admin.id, dto.reason ?? null);
  }

  @Post('users/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  unsuspend(
    @Internal() admin: InternalUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AdminUserView> {
    return this.usersAdmin.unsuspend(id, admin.id);
  }
}
