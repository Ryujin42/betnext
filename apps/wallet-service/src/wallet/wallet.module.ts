import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceEntity, TransactionEntity } from '@betnext/database';
import { WalletController } from './wallet.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentWebhookWorker } from './payment-webhook.worker';
import { WalletService } from './wallet.service';
import { DepositLimitsService } from './deposit-limits.service';
import { BetEventsSubscriber } from './bet-events.subscriber';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [TypeOrmModule.forFeature([BalanceEntity, TransactionEntity]), PaymentModule],
  controllers: [WalletController, PaymentWebhookController],
  providers: [WalletService, DepositLimitsService, BetEventsSubscriber, PaymentWebhookWorker],
})
export class WalletModule {}
