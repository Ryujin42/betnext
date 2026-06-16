import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EventStatus, type IEvent } from '@betnext/shared-types';
import { GameEntity } from './game.entity';
import { TournamentEntity } from './tournament.entity';

/** Événement e-sport (table `e_sport_events`) — domaine events. */
@Entity({ name: 'e_sport_events', schema: 'betnext' })
export class EsportEventEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate!: Date;

  @Column({ type: 'varchar', length: 32, default: EventStatus.BROUILLON })
  status!: EventStatus;

  @Column({ name: 'tournament_id', type: 'integer' })
  tournamentId!: number;

  // Dénormalisé pour un accès direct au jeu (cf. modèle §4).
  @Column({ name: 'game_id', type: 'integer' })
  gameId!: number;

  @ManyToOne(() => TournamentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournament_id' })
  tournament!: TournamentEntity;

  @ManyToOne(() => GameEntity)
  @JoinColumn({ name: 'game_id' })
  game!: GameEntity;

  toPublic(): IEvent {
    return {
      id: this.id,
      name: this.name,
      startDate: this.startDate.toISOString(),
      status: this.status,
      tournamentId: this.tournamentId,
      gameId: this.gameId,
    };
  }
}
