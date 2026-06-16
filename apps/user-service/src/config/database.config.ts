import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UserEntity } from '../entities/user.entity';
import { SessionEntity } from '../entities/session.entity';

/**
 * Configuration TypeORM du user-service.
 *
 * Connexion via DATABASE_URL → user applicatif `betnext_app` (non-superuser)
 * sur le schéma applicatif unique `betnext` (cf. ADR-002).
 * Pas de synchronize en runtime : on passe par des migrations versionnées.
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
    entities: [UserEntity, SessionEntity],
    synchronize: false,
    migrationsRun: false,
    logging: ['error', 'warn'],
  };
}
