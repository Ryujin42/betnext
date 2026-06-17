import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { type IBalance, type ITransaction } from '@betnext/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { RelayService } from '../proxy/relay.service';

/**
 * Proxy des routes portefeuille (Lot 6) vers le wallet-service. JWT vérifié ici ;
 * tout utilisateur authentifié peut consulter son solde, déposer et retirer.
 */
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly relay: RelayService) {}

  @Get('balance')
  balance(@CurrentUser() user: AuthenticatedUser): Promise<IBalance> {
    return this.relay.forwardToWalletService('GET', '/wallet/balance', { user });
  }

  @Get('transactions')
  transactions(@CurrentUser() user: AuthenticatedUser): Promise<ITransaction[]> {
    return this.relay.forwardToWalletService('GET', '/wallet/transactions', { user });
  }

  @Post('deposit')
  @HttpCode(HttpStatus.OK)
  deposit(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.relay.forwardToWalletService('POST', '/wallet/deposit', { user, body });
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.OK)
  withdraw(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.relay.forwardToWalletService('POST', '/wallet/withdraw', { user, body });
  }
}
