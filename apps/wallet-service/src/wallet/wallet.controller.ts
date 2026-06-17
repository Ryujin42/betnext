import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { IBalance, ITransaction } from '@betnext/shared-types';
import { WalletService, DepositResult, WithdrawResult } from './wallet.service';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { InternalAuthGuard, InternalUser } from '../common/internal-auth.guard';
import { Internal } from '../common/internal-user.decorator';

/**
 * Routes portefeuille (Lot 6). Authentification au gateway, qui injecte
 * `x-user-id` / `x-user-role` consommés par {@link InternalAuthGuard}.
 */
@Controller('wallet')
@UseGuards(InternalAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('balance')
  balance(@Internal() user: InternalUser): Promise<IBalance> {
    return this.wallet.getBalance(user.id);
  }

  @Get('transactions')
  transactions(@Internal() user: InternalUser): Promise<ITransaction[]> {
    return this.wallet.listTransactions(user.id);
  }

  @Post('deposit')
  @HttpCode(HttpStatus.OK)
  deposit(@Internal() user: InternalUser, @Body() dto: DepositDto): Promise<DepositResult> {
    return this.wallet.deposit(user.id, dto.amount);
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.OK)
  withdraw(@Internal() user: InternalUser, @Body() dto: WithdrawDto): Promise<WithdrawResult> {
    return this.wallet.withdraw(user.id, dto.amount);
  }
}
