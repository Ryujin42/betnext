import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration jeu responsable (Lot 7 — T7.2). Crée `betnext.rg_profiles` :
 * limites courantes (mise/dépôt × jour/semaine), copie « pending » pour la
 * règle des 48h sur les augmentations, et `self_excluded_until` pour
 * l'auto-exclusion bloquante.
 */
export class InitRgProfiles1718200000000 implements MigrationInterface {
  name = 'InitRgProfiles1718200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "betnext"."rg_profiles" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "betnext"."users"("id") ON DELETE CASCADE,
        "daily_bet_limit" NUMERIC(12, 2),
        "weekly_bet_limit" NUMERIC(12, 2),
        "daily_deposit_limit" NUMERIC(12, 2),
        "weekly_deposit_limit" NUMERIC(12, 2),
        "pending_daily_bet_limit" NUMERIC(12, 2),
        "pending_weekly_bet_limit" NUMERIC(12, 2),
        "pending_daily_deposit_limit" NUMERIC(12, 2),
        "pending_weekly_deposit_limit" NUMERIC(12, 2),
        "pending_effective_at" TIMESTAMPTZ,
        "self_excluded_until" TIMESTAMPTZ,
        "limit_updated_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "rg_profiles_user_id_uq" ON "betnext"."rg_profiles" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "betnext"."rg_profiles"`);
  }
}
