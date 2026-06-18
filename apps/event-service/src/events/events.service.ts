import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BetNextErrorCode, EventStatus } from '@betnext/shared-types';
import { EsportEventEntity, EventTeamEntity } from '@betnext/database';
import {
  BetNextTopic,
  EVENT_BUS,
  type EventCancelledEvent,
  type IEventBus,
} from '@betnext/shared-events';
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
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  /** Liste les événements visibles des joueurs (PUBLIE). */
  listPublished(): Promise<EsportEventEntity[]> {
    return this.events.find({ where: { status: EventStatus.PUBLIE }, order: { startDate: 'ASC' } });
  }

  /** Liste tous les évènements (tous statuts) — utilisé par l'admin/manager. */
  listAll(): Promise<EsportEventEntity[]> {
    return this.events.find({ order: { startDate: 'ASC' } });
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

  /**
   * Transition de statut validée par la machine à états. Une annulation
   * (→ ANNULE) publie en plus `event.cancelled` sur le bus, ce qui déclenche
   * côté betting-service l'annulation des paris PENDING et leur remboursement
   * (cf. BETNEXT_CONTEXT §10 : « ANNULE → Paris remboursés »).
   */
  async transition(id: number, target: EventStatus): Promise<EsportEventEntity> {
    const event = await this.getOrThrow(id);
    if (!canTransition(event.status, target)) {
      throw this.lifecycleError(`Transition ${event.status} → ${target} interdite.`);
    }
    event.status = target;
    const saved = await this.events.save(event);

    if (target === EventStatus.ANNULE) {
      await this.bus.publish<EventCancelledEvent>(BetNextTopic.EventCancelled, {
        eSportEventId: saved.id,
        occurredAt: new Date().toISOString(),
      });
    }

    return saved;
  }

  private lifecycleError(message: string): BetNextException {
    return new BetNextException(BetNextErrorCode.VALIDATION_ERROR, HttpStatus.CONFLICT, message);
  }
}
