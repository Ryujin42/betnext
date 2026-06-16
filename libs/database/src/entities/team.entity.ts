import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { ITeam } from '@betnext/shared-types';

/** Équipe e-sport — domaine events. */
@Entity({ name: 'teams', schema: 'betnext' })
export class TeamEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @CreateDateColumn({ name: 'enrolled_at', type: 'timestamptz' })
  enrolledAt!: Date;

  toPublic(): ITeam {
    return { id: this.id, name: this.name, enrolledAt: this.enrolledAt.toISOString() };
  }
}
