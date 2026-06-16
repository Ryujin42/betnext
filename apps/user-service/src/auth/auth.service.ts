import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { BetNextErrorCode, type IUser, Role } from '@betnext/shared-types';
import { isAdult } from '@betnext/shared-utils';
import { BetNextException } from '../common/exceptions/betnext.exception';
import { UserEntity } from '../entities/user.entity';
import { RegisterDto } from './dto/register.dto';

/**
 * Service d'authentification — Lot 2 (T2.2 register, T2.3 login/refresh).
 *
 * Toutes les opérations sensibles passent par ce service : hash Argon2id
 * (cf. ADR-008), vérifications ARJEL (âge ≥ 18, jeu responsable à venir),
 * persistance des sessions rotatives (ADR-009).
 */
@Injectable()
export class AuthService {
  /** Paramètres Argon2id : valeurs par défaut OWASP du paquet `argon2`. */
  private static readonly ARGON2_OPTIONS: argon2.Options = {
    type: argon2.argon2id,
  };

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  /**
   * Inscription d'un nouvel utilisateur (T2.2).
   *
   * Règles ARJEL : refus si < 18 ans, CGU obligatoires (validé en amont
   * par le DTO), email unique. Le mot de passe est haché en Argon2id.
   */
  async register(dto: RegisterDto): Promise<IUser> {
    if (!isAdult(dto.birthDate)) {
      throw new BetNextException(
        BetNextErrorCode.UNDERAGE,
        HttpStatus.FORBIDDEN,
        'Inscription refusée : âge minimum 18 ans (législation ARJEL).',
      );
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      throw new BetNextException(
        BetNextErrorCode.VALIDATION_ERROR,
        HttpStatus.CONFLICT,
        'Un compte existe déjà avec cet email.',
        { field: 'email' },
      );
    }

    const passwordHash = await argon2.hash(dto.password, AuthService.ARGON2_OPTIONS);

    const user = this.users.create({
      name: dto.name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: Role.USER,
      birthDate: dto.birthDate,
    });
    const saved = await this.users.save(user);
    return saved.toPublic();
  }
}
