import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration initiale du domaine users (Lot 2 — T2.1).
 *
 * Crée les tables `users` et `sessions` dans le schéma applicatif unique
 * `betnext` (cf. ADR-002). Toutes les FK pointent vers ce même schéma : les
 * JOIN inter-domaines seront possibles dès l'arrivée des autres domaines.
 */
export class InitUsersDomain1718000000000 implements MigrationInterface {
  name = 'InitUsersDomain1718000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "betnext"."users" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(120) NOT NULL,
        "email" VARCHAR(254) NOT NULL,
        "password_hash" VARCHAR(255) NOT NULL,
        "role" VARCHAR(32) NOT NULL DEFAULT 'ROLE_USER',
        "birth_date" DATE NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "users_email_uq" ON "betnext"."users" ("email")`);

    await queryRunner.query(`
      CREATE TABLE "betnext"."sessions" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "betnext"."users"("id") ON DELETE CASCADE,
        "refresh_token_hash" VARCHAR(255) NOT NULL,
        "family_id" UUID NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "ip" VARCHAR(64),
        "user_agent" VARCHAR(512),
        "device" VARCHAR(128),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "last_used_at" TIMESTAMPTZ,
        "revoked_at" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "sessions_refresh_token_hash_uq" ON "betnext"."sessions" ("refresh_token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "sessions_family_id_idx" ON "betnext"."sessions" ("family_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "betnext"."sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "betnext"."users"`);
  }
}
