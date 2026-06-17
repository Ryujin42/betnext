import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BetEntity, BetHistoryEntity, EsportEventEntity, OutcomeEntity } from '@betnext/database';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';
import { BetResolutionService } from './bet-resolution.service';
import { BetResolutionProducer } from './bet-resolution.producer';
import { BetResolutionWorker } from './bet-resolution.worker';
import { WalletModule } from '../wallet/wallet.module';
import { ResponsibleGamingModule } from '../responsible-gaming/responsible-gaming.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BetEntity, BetHistoryEntity, OutcomeEntity, EsportEventEntity]),
    WalletModule,
    ResponsibleGamingModule,
  ],
  controllers: [BetsController],
  providers: [BetsService, BetResolutionService, BetResolutionProducer, BetResolutionWorker],
})
export class BetsModule {}
