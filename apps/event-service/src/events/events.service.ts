import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BetNextErrorCode, EventStatus } from '@betnext/shared-types';
import { EsportEventEntity, EventTeamEntity } from '@betnext/database';
import { BetNextException } from '../common/betnext.exception';
import { canDelete, canModify, canTransition } from './event-lifecycle';
import type { CreateEventDto } from './dto/create-event.dto';
import type { UpdateEventDto } from './dto/update-event.dto';

/**
 * Gestion des événements e-sport (T4.2) : CRUD + transitions de cycle de vie.
 * Les règles non négociables (modif/suppression en BROUILLON uniquement,
 * transitions autorisées) sont déléguées à `event-lifecycle`.
 */
@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(EsportEventEntity)
    private readonly events: Repository<EsportEventEntity>,
    @InjectRepository(EventTeamEntity)
    private readonly eventTeams: Repository<EventTeamEntity>,
  ) {}

  /** Liste les événements visibles des joueurs (PUBLIE). */
  listPublished(): Promise<EsportEventEntity[]> {
    return this.events.find({ where: { status: EventStatus.PUBLIE }, order: { startDate: 'ASC' } });
  }

  async getOrThrow(id: number): Promise<EsportEventEntity> {
    const event = await this.events.findOne({ where: { id } });
    if (!event) {
      throw new BetNextException(
        BetNextErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        `Événement ${id} introuvable.`,
      );
    }
    return event;
  }

  async create(dto: CreateEventDto): Promise<EsportEventEntity> {
    const event = await this.events.save(
      this.events.create({
        name: dto.name,
        startDate: new Date(dto.startDate),
        status: EventStatus.BROUILLON,
        tournamentId: dto.tournamentId,
        gameId: dto.gameId,
      }),
    );
    await this.eventTeams.save(
      dto.teamIds.map((teamId) =>
        this.eventTeams.create({ eSportEventId: event.id, teamId, finalRank: null }),
      ),
    );
    return event;
  }

  async update(id: number, dto: UpdateEventDto): Promise<EsportEventEntity> {
    const event = await this.getOrThrow(id);
    if (!canModify(event.status)) {
      throw this.lifecycleError(`Modification interdite (statut ${event.status}).`);
    }
    if (dto.name !== undefined) {
      event.name = dto.name;
    }
    if (dto.startDate !== undefined) {
      event.startDate = new Date(dto.startDate);
    }
    return this.events.save(event);
  }

  async remove(id: number): Promise<void> {
    const event = await this.getOrThrow(id);
    if (!canDelete(event.status)) {
      throw this.lifecycleError(`Suppression interdite hors BROUILLON (statut ${event.status}).`);
    }
    await this.events.remove(event);
  }

  /** Transition de statut validée par la machine à états. */
  async transition(id: number, target: EventStatus): Promise<EsportEventEntity> {
    const event = await this.getOrThrow(id);
    if (!canTransition(event.status, target)) {
      throw this.lifecycleError(`Transition ${event.status} → ${target} interdite.`);
    }
    event.status = target;
    return this.events.save(event);
  }

  private lifecycleError(message: string): BetNextException {
    return new BetNextException(BetNextErrorCode.VALIDATION_ERROR, HttpStatus.CONFLICT, message);
  }
}
