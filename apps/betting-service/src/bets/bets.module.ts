import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BetEntity, BetHistoryEntity, EsportEventEntity, OutcomeEntity } from '@betnext/database';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';
import { BetNotifier } from './bet-notifier';
import { BetResolutionService } from './bet-resolution.service';
import { BetResolutionProducer } from './bet-resolution.producer';
import { BetResolutionWorker } from './bet-resolution.worker';
import { BetCancellationService } from './bet-cancellation.service';
import { BetCancellationProducer } from './bet-cancellation.producer';
import { BetCancellationWorker } from './bet-cancellation.worker';
import { WalletModule } from '../wallet/wallet.module';
import { ResponsibleGamingModule } from '../responsible-gaming/responsible-gaming.module';
import { AccountStatusModule } from '../account-status/account-status.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BetEntity, BetHistoryEntity, OutcomeEntity, EsportEventEntity]),
    WalletModule,
    ResponsibleGamingModule,
    AccountStatusModule,
  ],
  controllers: [BetsController],
  providers: [
    BetsService,
    BetNotifier,
    BetResolutionService,
    BetResolutionProducer,
    BetResolutionWorker,
    BetCancellationService,
    BetCancellationProducer,
    BetCancellationWorker,
  ],
})
export class BetsModule {}
