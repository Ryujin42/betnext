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
import { IBet, IBetView } from '@betnext/shared-types';
import { BetsService } from './bets.service';
import { BetResolutionService, ResolutionSummary } from './bet-resolution.service';
import { PlaceBetDto } from './dto/place-bet.dto';
import { InternalAuthGuard, InternalUser } from '../common/internal-auth.guard';
import { Internal } from '../common/internal-user.decorator';
import { ManagerGuard } from '../common/manager.guard';

/**
 * Routes internes du betting-service. L'authentification a lieu au gateway, qui
 * injecte `x-user-id` / `x-user-role` consommés par {@link InternalAuthGuard}.
 */
@Controller()
@UseGuards(InternalAuthGuard)
export class BetsController {
  constructor(
    private readonly bets: BetsService,
    private readonly resolution: BetResolutionService,
  ) {}

  /** T5.1 — placer un pari (tout utilisateur authentifié). */
  @Post('bets')
  @HttpCode(HttpStatus.CREATED)
  place(@Internal() user: InternalUser, @Body() dto: PlaceBetDto): Promise<IBet> {
    return this.bets.placeBet(user.id, dto);
  }

  /** T5.4 — historique des paris de l'utilisateur courant. */
  @Get('bets/me')
  listMine(@Internal() user: InternalUser): Promise<IBetView[]> {
    return this.bets.listForUser(user.id);
  }

  @Get('bets/:id')
  getOne(@Internal() user: InternalUser, @Param('id', ParseIntPipe) id: number): Promise<IBetView> {
    return this.bets.getForUser(user.id, id);
  }

  /**
   * T5.3 — déclenchement de la résolution des paris d'un événement. Réservé au
   * système / gestionnaire ; au Lot 7 ce sera l'événement `event.result_set` du
   * bus Redis qui déclenchera la résolution inter-services.
   */
  @Post('internal/events/:eventId/resolve')
  @UseGuards(ManagerGuard)
  resolve(@Param('eventId', ParseIntPipe) eventId: number): Promise<ResolutionSummary> {
    return this.resolution.resolveForEvent(eventId);
  }
}
