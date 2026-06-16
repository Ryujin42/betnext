import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { IGame } from '@betnext/shared-types';

/** Jeu e-sport (`lol`, `cs2`, `valorant`...) — domaine events. */
@Entity({ name: 'games', schema: 'betnext' })
export class GameEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  toPublic(): IGame {
    return { id: this.id, name: this.name };
  }
}
