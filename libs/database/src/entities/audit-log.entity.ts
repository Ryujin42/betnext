import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { IAuditLog } from '@betnext/shared-types';

/**
 * Trace d'audit réglementaire ARJEL (T11.1), table `audit_logs`.
 *
 * **Append-only** : l'audit-service n'effectue que des `INSERT`. L'immuabilité
 * est garantie au niveau base par un trigger `BEFORE UPDATE OR DELETE` qui lève
 * une exception (cf. migration `InitAuditLogs`) — même le propriétaire de la
 * table ne peut donc ni modifier ni supprimer une ligne. Rétention légale
 * longue (5 ans min), distincte du monitoring technique (Prometheus) qui, lui,
 * est purgeable (cf. CONTEXT §11 : séparation monitoring / audit).
 */
@Entity({ name: 'audit_logs', schema: 'betnext' })
export class AuditLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index('audit_logs_topic_idx')
  @Column({ type: 'varchar', length: 64 })
  topic!: string;

  @Index('audit_logs_user_id_idx')
  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId!: number | null;

  @Column({ name: 'actor_id', type: 'integer', nullable: true })
  actorId!: number | null;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @CreateDateColumn({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;

  toPublic(): IAuditLog {
    return {
      // `bigint` est mappé en `string` par node-postgres ; on expose un number.
      id: Number(this.id),
      topic: this.topic,
      userId: this.userId,
      actorId: this.actorId,
      payload: this.payload,
      occurredAt: this.occurredAt.toISOString(),
      recordedAt: this.recordedAt.toISOString(),
    };
  }
}
