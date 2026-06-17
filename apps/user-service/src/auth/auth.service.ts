import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { BetNextErrorCode, type IAuthTokens, type IUser, Role } from '@betnext/shared-types';
import { isAdult } from '@betnext/shared-utils';
import { BetNextException } from '../common/exceptions/betnext.exception';
import { UserEntity } from '@betnext/database';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionContext, TokensService } from './tokens.service';
import { RgProfilesService } from '../rg/rg-profiles.service';

/**
 * Service d'authentification — Lot 2 (T2.2 register, T2.3 login/refresh).
 *
 * Toutes les opérations sensibles passent par ce service : hash Argon2id
 * (cf. ADR-008), vérifications ARJEL (âge ≥ 18, jeu responsable à venir),
 * persistance des sessions rotatives (ADR-009).
 */
@Injectable()
export class AuthService {
  private static readonly ARGON2_OPTIONS: argon2.Options = {
    type: argon2.argon2id,
  };

  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly tokens: TokensService,
    private readonly rg: RgProfilesService,
  ) {}

  /** T2.2 — Inscription ARJEL. */
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

  /**
   * T2.3 — Vérifie les identifiants et émet un couple access + refresh.
   *
   * Sécurité : message d'erreur identique pour email inconnu et mauvais
   * mot de passe (`INVALID_CREDENTIALS`), pour ne pas révéler l'existence
   * d'un compte.
   */
  async login(dto: LoginDto, ctx: SessionContext): Promise<IAuthTokens> {
    const user = await this.users.findOne({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user) {
      throw AuthService.invalidCredentials();
    }

    const passwordOk = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      throw AuthService.invalidCredentials();
    }

    // T8.3 — suspension admin : connexion refusée tant que `suspended_at`
    // n'est pas levé. Vérifié après mot de passe pour ne pas révéler
    // l'existence du compte (OWASP user enumeration).
    if (user.suspendedAt) {
      throw new BetNextException(
        BetNextErrorCode.ACCOUNT_SUSPENDED,
        HttpStatus.FORBIDDEN,
        'Compte suspendu — contactez le support.',
        {
          suspendedAt: user.suspendedAt.toISOString(),
          suspendedReason: user.suspendedReason,
        },
      );
    }

    // T7.2 — auto-exclusion : la connexion est refusée tant que la date de
    // fin n'est pas atteinte, indépendamment des identifiants valides. On
    // **vérifie après** le mot de passe pour ne pas révéler l'existence du
    // compte aux scanners (réponse INVALID_CREDENTIALS générique sinon
    // privilégiée).
    const selfExclusion = await this.rg.isSelfExcluded(user.id);
    if (selfExclusion.excluded) {
      throw new BetNextException(
        BetNextErrorCode.ACCOUNT_SELF_EXCLUDED,
        HttpStatus.FORBIDDEN,
        `Compte auto-exclu jusqu'au ${selfExclusion.until?.toISOString() ?? ''}.`,
        { selfExcludedUntil: selfExclusion.until?.toISOString() ?? null },
      );
    }

    return this.issueTokens(user, undefined, ctx);
  }

  /**
   * T2.3 — Rotation d'un refresh token (cf. ADR-009).
   *
   * - Lookup par hash du token reçu.
   * - Si déjà révoqué → réutilisation suspecte → on révoque **toute** la
   *   `family_id` et on refuse (INVALID_CREDENTIALS).
   * - Sinon : on marque l'ancien révoqué et on émet un nouveau couple
   *   dans la même `family_id`.
   */
  async refresh(refreshToken: string, ctx: SessionContext): Promise<IAuthTokens> {
    const session = await this.tokens.findSessionByToken(refreshToken);
    if (!session) {
      throw AuthService.invalidCredentials();
    }

    if (session.revokedAt) {
      this.logger.warn(
        `Refresh token déjà consommé pour la family ${session.familyId} — révocation complète.`,
      );
      await this.tokens.revokeFamily(session.familyId);
      throw new BetNextException(
        BetNextErrorCode.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
        'Refresh token déjà consommé : session révoquée.',
      );
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw AuthService.invalidCredentials();
    }

    await this.tokens.revokeSession(session);
    return this.issueTokens(session.user, session.familyId, ctx);
  }

  private async issueTokens(
    user: UserEntity,
    familyId: string | undefined,
    ctx: SessionContext,
  ): Promise<IAuthTokens> {
    const { token: accessToken, expiresIn } = this.tokens.signAccessToken(user);
    const { refreshToken, session } = await this.tokens.issueSession({ user, familyId, ctx });
    return {
      accessToken,
      refreshToken,
      expiresIn,
      refreshExpiresAt: session.expiresAt.toISOString(),
      user: user.toPublic(),
    };
  }

  private static invalidCredentials(): BetNextException {
    return new BetNextException(
      BetNextErrorCode.INVALID_CREDENTIALS,
      HttpStatus.UNAUTHORIZED,
      'Identifiants invalides.',
    );
  }
}
