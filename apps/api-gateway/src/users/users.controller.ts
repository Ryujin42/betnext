import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import type { IUser } from '@betnext/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { RelayService } from '../proxy/relay.service';

/**
 * Routes protégées « profil utilisateur » — accessibles à n'importe quel
 * utilisateur authentifié. La vérification JWT a lieu **ici** (gateway) ;
 * le user-service reçoit `x-user-id` / `x-user-role` injectés.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly relay: RelayService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  me(@CurrentUser() user: AuthenticatedUser): Promise<IUser> {
    return this.relay.forwardToUserService<IUser>('GET', '/users/me', { user });
  }
}
