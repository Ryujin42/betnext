import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { ITournament } from '@betnext/shared-types';
import { GameEntity } from './game.entity';

/** Tournoi rattaché à un jeu (1 jeu → N tournois) — domaine events. */
@Entity({ name: 'tournaments', schema: 'betnext' })
export class TournamentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ name: 'game_id', type: 'integer' })
  gameId!: number;

  @ManyToOne(() => GameEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'game_id' })
  game!: GameEntity;

  toPublic(): ITournament {
    return { id: this.id, name: this.name, gameId: this.gameId };
  }
}
