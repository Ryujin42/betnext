import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { type IBet, type IBetView } from '@betnext/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { RelayService } from '../proxy/relay.service';

/**
 * Proxy des routes paris (Lot 5) vers le betting-service. La vérification JWT a
 * lieu ici ; tout utilisateur authentifié peut placer un pari et consulter son
 * historique. Le gateway injecte `x-user-id` / `x-user-role` consommés en aval.
 */
@Controller('bets')
@UseGuards(JwtAuthGuard)
export class BetsController {
  constructor(private readonly relay: RelayService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  place(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser): Promise<IBet> {
    return this.relay.forwardToBettingService('POST', '/bets', { user, body });
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<IBetView[]> {
    return this.relay.forwardToBettingService('GET', '/bets/me', { user });
  }

  @Get(':id')
  getOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IBetView> {
    return this.relay.forwardToBettingService('GET', `/bets/${id}`, { user });
  }
}
