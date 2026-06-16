import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { IEventTeam } from '@betnext/shared-types';
import { EsportEventEntity } from './esport-event.entity';
import { TeamEntity } from './team.entity';

/**
 * Pivot N équipes par événement (table `event_teams`). C'est lui qui rend
 * le nombre d'équipes dynamique (duel, bracket, battle royale).
 */
@Entity({ name: 'event_teams', schema: 'betnext' })
export class EventTeamEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'final_rank', type: 'integer', nullable: true })
  finalRank!: number | null;

  @Column({ name: 'e_sport_event_id', type: 'integer' })
  eSportEventId!: number;

  @Column({ name: 'team_id', type: 'integer' })
  teamId!: number;

  @ManyToOne(() => EsportEventEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'e_sport_event_id' })
  event!: EsportEventEntity;

  @ManyToOne(() => TeamEntity)
  @JoinColumn({ name: 'team_id' })
  team!: TeamEntity;

  toPublic(): IEventTeam {
    return {
      id: this.id,
      finalRank: this.finalRank,
      eSportEventId: this.eSportEventId,
      teamId: this.teamId,
    };
  }
}
