import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Table d'audit ARJEL append-only (Lot 11 — T11.1).
 *
 * Chaque action sensible (pari, mouvement de portefeuille, modification RG,
 * suspension...) y est inscrite par l'audit-service via un simple `INSERT`.
 * L'immuabilité est garantie côté base par un trigger `BEFORE UPDATE OR DELETE`
 * qui lève une exception : aucune route, aucun service — pas même le
 * propriétaire de la table — ne peut altérer une ligne (DoD T11.1). C'est la
 * différence avec le monitoring technique, lui purgeable (CONTEXT §11).
 */
export class InitAuditLogs1718400000000 implements MigrationInterface {
  name = 'InitAuditLogs1718400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "betnext"."audit_logs" (
        "id" BIGSERIAL PRIMARY KEY,
        "topic" VARCHAR(64) NOT NULL,
        "user_id" INTEGER,
        "actor_id" INTEGER,
        "payload" JSONB NOT NULL,
        "occurred_at" TIMESTAMPTZ NOT NULL,
        "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "audit_logs_topic_idx" ON "betnext"."audit_logs" ("topic")`,
    );
    await queryRunner.query(
      `CREATE INDEX "audit_logs_user_id_idx" ON "betnext"."audit_logs" ("user_id")`,
    );

    // Trigger d'immuabilité : interdit toute mutation/suppression d'une ligne
    // d'audit, y compris par le propriétaire (les triggers s'appliquent à tous).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "betnext"."audit_logs_prevent_mutation"()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs is append-only: % is forbidden', TG_OP
          USING ERRCODE = 'restrict_violation';
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `);
    // UPDATE / DELETE : trigger ligne à ligne.
    await queryRunner.query(`
      CREATE TRIGGER "audit_logs_no_mutation"
      BEFORE UPDATE OR DELETE ON "betnext"."audit_logs"
      FOR EACH ROW EXECUTE FUNCTION "betnext"."audit_logs_prevent_mutation"()
    `);
    // TRUNCATE : contourne les triggers ligne → trigger niveau instruction dédié.
    await queryRunner.query(`
      CREATE TRIGGER "audit_logs_no_truncate"
      BEFORE TRUNCATE ON "betnext"."audit_logs"
      FOR EACH STATEMENT EXECUTE FUNCTION "betnext"."audit_logs_prevent_mutation"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "audit_logs_no_truncate" ON "betnext"."audit_logs"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "audit_logs_no_mutation" ON "betnext"."audit_logs"`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS "betnext"."audit_logs_prevent_mutation"()`);
    await queryRunner.query(`DROP TABLE IF EXISTS "betnext"."audit_logs"`);
  }
}
