import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { InternalAuthGuard, type InternalUser } from '../common/internal-auth.guard';
import { Internal } from '../common/internal-user.decorator';

/**
 * Endpoint de démonstration pour la DoD T2.4 — le contrôle du rôle est
 * effectué au gateway (`@Roles(ROLE_ADMIN)`). Ici on reçoit déjà la
 * requête tamponnée par le gateway.
 */
@Controller('admin')
@UseGuards(InternalAuthGuard)
export class AdminController {
  @Get('ping')
  @HttpCode(HttpStatus.OK)
  ping(@Internal() user: InternalUser): { ok: true; role: string; userId: number } {
    return { ok: true, role: user.role, userId: user.id };
  }
}
