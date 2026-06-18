import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { BetNextErrorCode, EventStatus, type IExternalEvent } from '@betnext/shared-types';
import {
  EsportEventEntity,
  EventTeamEntity,
  GameEntity,
  OutcomeEntity,
  TeamEntity,
  TournamentEntity,
} from '@betnext/database';
import { GameAdapterRegistry } from '../adapters/game-adapter.registry';
import { BetNextException } from '../common/betnext.exception';

export interface IngestionSummary {
  /** Type d'adapter sollicité (ex: `lol`). */
  type: string;
  /** Nombre d'évènements nouvellement créés en BROUILLON. */
  created: number;
  /** Nombre d'évènements ignorés parce que déjà importés (idempotence). */
  skipped: number;
  /** Identifiants `e_sport_events.id` créés, dans l'ordre. */
  createdIds: number[];
}

/**
 * Ingestion d'évènements externes (adapter → DB).
 *
 * Pour chaque {@link IExternalEvent} retourné par un adapter, crée l'événement
 * en `BROUILLON` (visible par le manager, pas par les joueurs), résout ou crée
 * son jeu, son tournoi, ses équipes, puis matérialise les outcomes.
 *
 * Idempotence : un évènement est considéré déjà importé s'il existe une ligne
 * `e_sport_events` avec le **même nom et la même start_date**. Un ré-import
 * suite à un appel répété de l'adapter ne crée pas de doublon.
 */
@Injectable()
export class EventIngestionService {
  private readonly logger = new Logger(EventIngestionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly registry: GameAdapterRegistry,
  ) {}

  async ingestAll(type: string): Promise<IngestionSummary> {
    const adapter = this.registry.getAdapter(type);
    const externals = await adapter.fetchLiveEvents();
    const createdIds: number[] = [];
    let skipped = 0;
    for (const ext of externals) {
      const id = await this.ingestOne(ext);
      if (id !== null) {
        createdIds.push(id);
      } else {
        skipped += 1;
      }
    }
    this.logger.log(
      `Ingestion '${type}' : ${createdIds.length} créés / ${skipped} ignorés (déjà présents).`,
    );
    return { type, created: createdIds.length, skipped, createdIds };
  }

  /**
   * Importe **un seul** évènement de l'adapter à partir de son `externalId`.
   * Utilisé par le clic individuel "Importer ce match" dans l'UI admin.
   * Renvoie l'id créé, ou `null` si le match était déjà présent.
   */
  async ingestByExternalId(type: string, externalId: string): Promise<number | null> {
    const adapter = this.registry.getAdapter(type);
    const externals = await adapter.fetchLiveEvents();
    const target = externals.find((e) => e.externalId === externalId);
    if (!target) {
      throw new BetNextException(
        BetNextErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        `Match '${externalId}' introuvable chez l'adapter '${type}' (peut-être déjà passé ou retiré du flux upcoming).`,
      );
    }
    return this.ingestOne(target);
  }

  /** Renvoie l'`id` créé ou `null` si l'évènement existait déjà. */
  private async ingestOne(ext: IExternalEvent): Promise<number | null> {
    return this.dataSource.transaction(async (manager) => {
      const eventRepo = manager.getRepository(EsportEventEntity);
      const startDate = new Date(ext.startDate);
      const existing = await eventRepo.findOne({ where: { name: ext.name, startDate } });
      if (existing) {
        return null;
      }

      const gameId = await this.resolveGame(manager, ext.game);
      const tournamentId = await this.resolveTournament(manager, ext.tournament, gameId);
      const event = await eventRepo.save(
        eventRepo.create({
          name: ext.name,
          startDate,
          status: EventStatus.BROUILLON,
          tournamentId,
          gameId,
        }),
      );

      const teamIndexToEventTeamId = await this.persistTeams(manager, event.id, ext);
      await this.persistOutcomes(manager, event.id, ext, teamIndexToEventTeamId);

      return event.id;
    });
  }

  private async resolveGame(manager: EntityManager, name: string): Promise<number> {
    const repo = manager.getRepository(GameEntity);
    const existing = await repo.findOne({ where: { name } });
    if (existing) return existing.id;
    const created = await repo.save(repo.create({ name }));
    return created.id;
  }

  private async resolveTournament(
    manager: EntityManager,
    name: string,
    gameId: number,
  ): Promise<number> {
    const repo = manager.getRepository(TournamentEntity);
    const existing = await repo.findOne({ where: { name, gameId } });
    if (existing) return existing.id;
    const created = await repo.save(repo.create({ name, gameId }));
    return created.id;
  }

  private async persistTeams(
    manager: EntityManager,
    eSportEventId: number,
    ext: IExternalEvent,
  ): Promise<Map<number, number>> {
    const teamRepo = manager.getRepository(TeamEntity);
    const eventTeamRepo = manager.getRepository(EventTeamEntity);
    const indexToEventTeamId = new Map<number, number>();
    for (let i = 0; i < ext.teams.length; i += 1) {
      const t = ext.teams[i];
      let team = await teamRepo.findOne({ where: { name: t.name } });
      if (!team) {
        team = await teamRepo.save(teamRepo.create({ name: t.name }));
      }
      const et = await eventTeamRepo.save(
        eventTeamRepo.create({ eSportEventId, teamId: team.id, finalRank: null }),
      );
      indexToEventTeamId.set(i, et.id);
    }
    return indexToEventTeamId;
  }

  private async persistOutcomes(
    manager: EntityManager,
    eSportEventId: number,
    ext: IExternalEvent,
    teamIndexToEventTeamId: Map<number, number>,
  ): Promise<void> {
    const repo = manager.getRepository(OutcomeEntity);
    for (const o of ext.outcomes) {
      const eventPlayerId =
        o.teamIndex !== null && o.teamIndex !== undefined
          ? (teamIndexToEventTeamId.get(o.teamIndex) ?? null)
          : null;
      await repo.save(
        repo.create({
          label: o.label,
          odds: o.odds.toFixed(2),
          condition: o.condition,
          eSportEventId,
          eventPlayerId,
          isWinner: null,
        }),
      );
    }
  }
}
