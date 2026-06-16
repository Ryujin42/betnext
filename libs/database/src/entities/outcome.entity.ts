import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { IOutcome, OutcomeCondition } from '@betnext/shared-types';
import { EsportEventEntity } from './esport-event.entity';
import { EventTeamEntity } from './event-team.entity';

/**
 * Issue pariable d'un événement (table `outcomes`). Le type de pari vit dans
 * `condition` (JSON, cf. ADR-007). `event_player_id` est nullable : renseigné
 * pour une issue liée à une équipe, null pour une issue transverse au match.
 */
@Entity({ name: 'outcomes', schema: 'betnext' })
export class OutcomeEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 200 })
  label!: string;

  @Column({ name: 'is_winner', type: 'boolean', nullable: true })
  isWinner!: boolean | null;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  odds!: string;

  @Column({ type: 'jsonb' })
  condition!: OutcomeCondition;

  @Column({ name: 'e_sport_event_id', type: 'integer' })
  eSportEventId!: number;

  @Column({ name: 'event_player_id', type: 'integer', nullable: true })
  eventPlayerId!: number | null;

  @ManyToOne(() => EsportEventEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'e_sport_event_id' })
  event!: EsportEventEntity;

  @ManyToOne(() => EventTeamEntity, { nullable: true })
  @JoinColumn({ name: 'event_player_id' })
  eventPlayer!: EventTeamEntity | null;

  toPublic(): IOutcome {
    return {
      id: this.id,
      label: this.label,
      isWinner: this.isWinner,
      odds: Number(this.odds),
      condition: this.condition,
      eSportEventId: this.eSportEventId,
      eventPlayerId: this.eventPlayerId,
    };
  }
}
