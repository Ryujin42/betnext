import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EsportEventEntity, EventTeamEntity, OutcomeEntity } from '@betnext/database';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { OutcomesService } from './outcomes.service';
import { ResolutionService } from './resolution.service';

@Module({
  imports: [TypeOrmModule.forFeature([EsportEventEntity, EventTeamEntity, OutcomeEntity])],
  controllers: [EventsController],
  providers: [EventsService, OutcomesService, ResolutionService],
})
export class EventsModule {}
