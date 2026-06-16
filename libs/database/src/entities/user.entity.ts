import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role, type IUser } from '@betnext/shared-types';
import { SessionEntity } from './session.entity';

/**
 * Compte utilisateur (cf. BETNEXT_CONTEXT §4 — domaine users).
 *
 * Un seul rôle par utilisateur (jamais un tableau), `ROLE_USER` par défaut.
 * Le mot de passe est haché avec Argon2id (cf. ADR-008).
 */
@Entity({ name: 'users', schema: 'betnext' })
export class UserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Index('users_email_uq', { unique: true })
  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 32, default: Role.USER })
  role!: Role;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => SessionEntity, (session) => session.user)
  sessions!: SessionEntity[];

  /** Projection publique (sans `password_hash`) vers l'interface partagée. */
  toPublic(): IUser {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      birthDate: this.birthDate,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
