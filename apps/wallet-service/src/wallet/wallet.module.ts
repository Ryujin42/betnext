import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceEntity, RgProfileEntity, TransactionEntity } from '@betnext/database';
import { WalletController } from './wallet.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentWebhookWorker } from './payment-webhook.worker';
import { WalletService } from './wallet.service';
import { DepositLimitsService } from './deposit-limits.service';
import { PaymentModule } from '../payment/payment.module';
import { AccountStatusModule } from '../account-status/account-status.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BalanceEntity, TransactionEntity, RgProfileEntity]),
    PaymentModule,
    AccountStatusModule,
  ],
  controllers: [WalletController, PaymentWebhookController],
  providers: [WalletService, DepositLimitsService, PaymentWebhookWorker],
})
export class WalletModule {}
