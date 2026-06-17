import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BetNextErrorCode, EventStatus } from '@betnext/shared-types';
import { EsportEventEntity, EventTeamEntity, OutcomeEntity } from '@betnext/database';
import {
  BetNextTopic,
  EVENT_BUS,
  type EventResultSetEvent,
  type IEventBus,
} from '@betnext/shared-events';
import { BetNextException } from '../common/betnext.exception';
import { canTransition } from './event-lifecycle';
import { decideOutcomeWinner, type ResolutionContext } from './resolve-outcome';
import type { SetResultDto } from './dto/set-result.dto';

/**
 * Saisie du résultat d'un événement (T4.4) : applique le classement aux
 * `event_teams`, résout chaque outcome (`is_winner`) via la logique pure
 * `decideOutcomeWinner`, et fait passer l'événement en TERMINE — le tout
 * dans une transaction. Après commit, émet `event.result_set` sur le bus, ce
 * qui déclenche la résolution des paris (T5.3). Au Lot 7, le bus in-memory
 * devient Redis/BullMQ : la résolution se fera alors inter-services.
 */
@Injectable()
export class ResolutionService {
  private readonly logger = new Logger(ResolutionService.name);

  constructor(
    @InjectRepository(EsportEventEntity)
    private readonly events: Repository<EsportEventEntity>,
    private readonly dataSource: DataSource,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  async setResult(eventId: number, dto: SetResultDto): Promise<EsportEventEntity> {
    const event = await this.events.findOne({ where: { id: eventId } });
    if (!event) {
      throw new BetNextException(
        BetNextErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        `Événement ${eventId} introuvable.`,
      );
    }
    if (!canTransition(event.status, EventStatus.TERMINE)) {
      throw new BetNextException(
        BetNextErrorCode.VALIDATION_ERROR,
        HttpStatus.CONFLICT,
        `Saisie de résultat impossible : l'événement doit être FERME (statut ${event.status}).`,
      );
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const eventTeams = await manager.find(EventTeamEntity, { where: { eSportEventId: eventId } });
      const validIds = new Set(eventTeams.map((et) => et.id));

      const rankByEventTeamId = new Map<number, number>();
      for (const row of dto.ranking) {
        if (!validIds.has(row.eventTeamId)) {
          throw new BetNextException(
            BetNextErrorCode.VALIDATION_ERROR,
            HttpStatus.BAD_REQUEST,
            `event_team ${row.eventTeamId} n'appartient pas à l'événement ${eventId}.`,
          );
        }
        rankByEventTeamId.set(row.eventTeamId, row.rank);
      }
      for (const et of eventTeams) {
        const rank = rankByEventTeamId.get(et.id);
        if (rank !== undefined) {
          et.finalRank = rank;
        }
      }
      await manager.save(eventTeams);

      const ctx: ResolutionContext = {
        rankByEventTeamId,
        matchDurationMinutes: dto.facts?.matchDurationMinutes,
        totalKills: dto.facts?.totalKills,
        firstBloodEventTeamId: dto.facts?.firstBloodEventTeamId,
      };
      const outcomes = await manager.find(OutcomeEntity, { where: { eSportEventId: eventId } });
      for (const outcome of outcomes) {
        outcome.isWinner = decideOutcomeWinner(outcome.condition, outcome.eventPlayerId, ctx);
      }
      await manager.save(outcomes);

      event.status = EventStatus.TERMINE;
      const persisted = await manager.save(event);

      const winners = outcomes.filter((o) => o.isWinner).length;
      this.logger.log(
        `Résultat saisi pour l'événement ${eventId} : ${winners}/${outcomes.length} issues gagnantes.`,
      );
      return persisted;
    });

    // Après commit : déclenche la résolution des paris (T5.3) via le bus.
    await this.bus.publish<EventResultSetEvent>(BetNextTopic.EventResultSet, {
      eSportEventId: eventId,
      occurredAt: new Date().toISOString(),
    });

    return saved;
  }
}
