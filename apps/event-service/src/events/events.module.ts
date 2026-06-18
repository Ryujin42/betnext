import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EsportEventEntity,
  EventTeamEntity,
  GameEntity,
  OutcomeEntity,
  TeamEntity,
  TournamentEntity,
} from '@betnext/database';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { OutcomesService } from './outcomes.service';
import { ResolutionService } from './resolution.service';
import { EventIngestionService } from './event-ingestion.service';
import { AdaptersModule } from '../adapters/adapters.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EsportEventEntity,
      EventTeamEntity,
      OutcomeEntity,
      TeamEntity,
      TournamentEntity,
      GameEntity,
    ]),
    AdaptersModule,
  ],
  controllers: [EventsController],
  providers: [EventsService, OutcomesService, ResolutionService, EventIngestionService],
})
export class EventsModule {}
