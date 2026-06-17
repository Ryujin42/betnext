import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BetNextErrorCode } from '@betnext/shared-types';
import { OutcomeEntity } from '@betnext/database';
import { isValidOutcomeCondition } from '@betnext/shared-utils';
import { BetNextException } from '../common/betnext.exception';
import { EventsService } from './events.service';
import type { CreateOutcomeDto } from './dto/create-outcome.dto';

/**
 * Création d'issues pariables typées (T4.3). Le champ `condition` (JSON) est
 * validé selon son discriminant `type` via `isValidOutcomeCondition` — ajouter
 * un type de pari ne demande aucune migration (cf. ADR-007).
 */
@Injectable()
export class OutcomesService {
  constructor(
    @InjectRepository(OutcomeEntity)
    private readonly outcomes: Repository<OutcomeEntity>,
    private readonly events: EventsService,
  ) {}

  async create(eventId: number, dto: CreateOutcomeDto): Promise<OutcomeEntity> {
    await this.events.getOrThrow(eventId);

    if (!isValidOutcomeCondition(dto.condition)) {
      throw new BetNextException(
        BetNextErrorCode.VALIDATION_ERROR,
        HttpStatus.BAD_REQUEST,
        'Structure de `condition` invalide pour son `type`.',
        { condition: dto.condition },
      );
    }

    return this.outcomes.save(
      this.outcomes.create({
        label: dto.label,
        odds: dto.odds.toFixed(2),
        condition: dto.condition,
        eSportEventId: eventId,
        eventPlayerId: dto.eventPlayerId ?? null,
        isWinner: null,
      }),
    );
  }

  listForEvent(eventId: number): Promise<OutcomeEntity[]> {
    return this.outcomes.find({ where: { eSportEventId: eventId }, order: { id: 'ASC' } });
  }
}
