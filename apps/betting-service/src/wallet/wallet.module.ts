import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceEntity, TransactionEntity } from '@betnext/database';
import { LocalWalletService } from './wallet.service';
import { WALLET_SERVICE } from './wallet.interface';

/**
 * Fournit le portefeuille local (Lot 5) sous le token {@link WALLET_SERVICE}.
 * Au Lot 6, remplacer le `useClass` par un client HTTP du wallet-service.
 */
@Module({
  imports: [TypeOrmModule.forFeature([BalanceEntity, TransactionEntity])],
  providers: [{ provide: WALLET_SERVICE, useClass: LocalWalletService }],
  exports: [WALLET_SERVICE],
})
export class WalletModule {}
