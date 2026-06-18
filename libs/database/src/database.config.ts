import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { SessionEntity } from './entities/session.entity';
import { RgProfileEntity } from './entities/rg-profile.entity';
import { GameEntity } from './entities/game.entity';
import { TournamentEntity } from './entities/tournament.entity';
import { EsportEventEntity } from './entities/esport-event.entity';
import { TeamEntity } from './entities/team.entity';
import { EventTeamEntity } from './entities/event-team.entity';
import { OutcomeEntity } from './entities/outcome.entity';
import { BetEntity } from './entities/bet.entity';
import { BetHistoryEntity } from './entities/bet-history.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { BalanceEntity } from './entities/balance.entity';
import { AuditLogEntity } from './entities/audit-log.entity';

/**
 * Liste de toutes les entités du schéma `betnext`. Centralisée ici pour que
 * chaque service partage exactement le même modèle relationnel.
 */
export const ENTITIES = [
  UserEntity,
  SessionEntity,
  RgProfileEntity,
  GameEntity,
  TournamentEntity,
  EsportEventEntity,
  TeamEntity,
  EventTeamEntity,
  OutcomeEntity,
  BetEntity,
  BetHistoryEntity,
  TransactionEntity,
  BalanceEntity,
  AuditLogEntity,
];

/**
 * Configuration TypeORM partagée (cf. ADR-002).
 *
 * Connexion via DATABASE_URL → user applicatif `betnext_app` (non-superuser)
 * sur le schéma applicatif unique `betnext`. Pas de `synchronize` : on passe
 * exclusivement par des migrations versionnées (centralisées dans cette lib).
 */
export function databaseConfigFactory(): TypeOrmModuleOptions {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined — copy .env.example to .env first.');
  }
  return {
    type: 'postgres',
    url: databaseUrl,
    schema: 'betnext',
    entities: ENTITIES,
    synchronize: false,
    migrationsRun: false,
    logging: ['error', 'warn'],
  };
}
