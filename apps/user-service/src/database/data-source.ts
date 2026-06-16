import 'reflect-metadata';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { DataSource } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { SessionEntity } from '../entities/session.entity';

/**
 * DataSource utilisée par la CLI TypeORM (`typeorm-ts-node-commonjs migration:*`).
 * Charge le `.env` racine du monorepo pour récupérer `DATABASE_URL`.
 */
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined — copy .env.example to .env first.');
}

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  schema: 'betnext',
  entities: [UserEntity, SessionEntity],
  migrations: [resolve(__dirname, 'migrations/*.{ts,js}')],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});
