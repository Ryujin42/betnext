import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Suspension administrative d'un compte (Lot 8 — T8.3). `suspended_at` est
 * NULL par défaut ; quand non NULL, l'AuthService refuse la connexion.
 * Différent de l'auto-exclusion (Lot 7) : c'est l'admin qui suspend, pas
 * l'utilisateur, et il peut réactiver.
 */
export class AddUserSuspension1718300000000 implements MigrationInterface {
  name = 'AddUserSuspension1718300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "betnext"."users" ADD COLUMN "suspended_at" TIMESTAMPTZ`);
    await queryRunner.query(
      `ALTER TABLE "betnext"."users" ADD COLUMN "suspended_reason" VARCHAR(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "betnext"."users" DROP COLUMN "suspended_reason"`);
    await queryRunner.query(`ALTER TABLE "betnext"."users" DROP COLUMN "suspended_at"`);
  }
}
