import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import type { IUser } from '@betnext/shared-types';
import { InternalAuthGuard, type InternalUser } from '../common/internal-auth.guard';
import { Internal } from '../common/internal-user.decorator';
import { UsersService } from './users.service';

/**
 * Routes profil — appelées par le gateway une fois le JWT vérifié.
 * Côté user-service, on fait confiance à `x-user-id` (cf. T2.4).
 */
@Controller('users')
@UseGuards(InternalAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  me(@Internal() user: InternalUser): Promise<IUser> {
    return this.usersService.findById(user.id);
  }
}
