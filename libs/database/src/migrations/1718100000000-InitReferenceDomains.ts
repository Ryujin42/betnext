import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration des domaines events, betting et wallet (Lot 3 — T3.1).
 *
 * Toutes les tables vivent dans le schéma unique `betnext` (cf. ADR-002), avec
 * de vraies clés étrangères inter-domaines (bets → outcomes/users, etc.).
 * Ordre de création conforme aux dépendances de FK.
 */
export class InitReferenceDomains1718100000000 implements MigrationInterface {
  name = 'InitReferenceDomains1718100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Domaine events ──
    await queryRunner.query(`
      CREATE TABLE "betnext"."games" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(64) NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "betnext"."teams" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(120) NOT NULL,
        "enrolled_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "betnext"."tournaments" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(160) NOT NULL,
        "game_id" INTEGER NOT NULL REFERENCES "betnext"."games"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "betnext"."e_sport_events" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(200) NOT NULL,
        "start_date" TIMESTAMPTZ NOT NULL,
        "status" VARCHAR(32) NOT NULL DEFAULT 'BROUILLON',
        "tournament_id" INTEGER NOT NULL REFERENCES "betnext"."tournaments"("id") ON DELETE CASCADE,
        "game_id" INTEGER NOT NULL REFERENCES "betnext"."games"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "betnext"."event_teams" (
        "id" SERIAL PRIMARY KEY,
        "final_rank" INTEGER,
        "e_sport_event_id" INTEGER NOT NULL REFERENCES "betnext"."e_sport_events"("id") ON DELETE CASCADE,
        "team_id" INTEGER NOT NULL REFERENCES "betnext"."teams"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "betnext"."outcomes" (
        "id" SERIAL PRIMARY KEY,
        "label" VARCHAR(200) NOT NULL,
        "is_winner" BOOLEAN,
        "odds" NUMERIC(5, 2) NOT NULL,
        "condition" JSONB NOT NULL,
        "e_sport_event_id" INTEGER NOT NULL REFERENCES "betnext"."e_sport_events"("id") ON DELETE CASCADE,
        "event_player_id" INTEGER REFERENCES "betnext"."event_teams"("id")
      )
    `);

    // ── Domaine betting ──
    await queryRunner.query(`
      CREATE TABLE "betnext"."bets" (
        "id" SERIAL PRIMARY KEY,
        "title" VARCHAR(200) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "close_date" TIMESTAMPTZ NOT NULL,
        "amount" NUMERIC(12, 2) NOT NULL,
        "locked_odds" NUMERIC(5, 2) NOT NULL,
        "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
        "outcome_id" INTEGER NOT NULL REFERENCES "betnext"."outcomes"("id"),
        "user_id" INTEGER NOT NULL REFERENCES "betnext"."users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "betnext"."bets_history" (
        "id" SERIAL PRIMARY KEY,
        "old_status" VARCHAR(16),
        "new_status" VARCHAR(16) NOT NULL,
        "reason" VARCHAR(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "bet_id" INTEGER NOT NULL REFERENCES "betnext"."bets"("id") ON DELETE CASCADE
      )
    `);

    // ── Domaine wallet ──
    await queryRunner.query(`
      CREATE TABLE "betnext"."transactions" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "betnext"."users"("id"),
        "type" VARCHAR(16) NOT NULL,
        "status" VARCHAR(16) NOT NULL DEFAULT 'COMPLETED',
        "amount" NUMERIC(12, 2) NOT NULL,
        "description" VARCHAR(255),
        "stripe_id" VARCHAR(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "transactions_stripe_id_uq" ON "betnext"."transactions" ("stripe_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "betnext"."balances" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "betnext"."users"("id"),
        "amount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "balances_user_id_uq" ON "betnext"."balances" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "betnext"."balances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "betnext"."transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "betnext"."bets_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "betnext"."bets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "betnext"."outcomes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "betnext"."event_teams"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "betnext"."e_sport_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "betnext"."tournaments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "betnext"."teams"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "betnext"."games"`);
  }
}
