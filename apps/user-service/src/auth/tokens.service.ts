import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { IAccessTokenPayload } from '@betnext/shared-types';
import { SessionEntity, UserEntity } from '@betnext/database';

export interface SessionContext {
  ip: string | null;
  userAgent: string | null;
  device: string | null;
}

/**
 * Service responsable de la cryptographie / persistance des tokens.
 *
 * - **Access token** : JWT HS256 signé avec `JWT_SECRET`, court (5 min,
 *   cf. ADR-009). Pas stocké en base.
 * - **Refresh token** : 32 bytes aléatoires encodés base64url. Stocké
 *   **uniquement haché** (SHA-256) dans `sessions.refresh_token_hash`.
 *   Rotatif : chaque utilisation invalide l'ancien et en émet un nouveau,
 *   dans la même `family_id` pour pouvoir détecter une réutilisation.
 */
@Injectable()
export class TokensService {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(user: Pick<UserEntity, 'id' | 'role'>): { token: string; expiresIn: number } {
    const expiresIn = TokensService.parseDurationSeconds(
      this.config.get<string>('JWT_ACCESS_EXPIRY') ?? '5m',
    );
    const payload: Omit<IAccessTokenPayload, 'iat' | 'exp'> = {
      sub: user.id,
      role: user.role,
      type: 'access',
    };
    return { token: this.jwt.sign(payload, { expiresIn }), expiresIn };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Émet un nouveau refresh token, persiste la session associée et
   * retourne le token en clair (à envoyer au client une seule fois).
   *
   * Si `familyId` est fourni, on prolonge la chaîne de rotation
   * existante ; sinon une nouvelle famille est créée (premier login).
   */
  async issueSession(params: {
    user: UserEntity;
    familyId?: string;
    ctx: SessionContext;
  }): Promise<{ refreshToken: string; session: SessionEntity }> {
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const expiry = this.config.get<string>('JWT_REFRESH_EXPIRY') ?? '7d';
    const expiresAt = new Date(Date.now() + TokensService.parseDurationSeconds(expiry) * 1000);

    const session = this.sessions.create({
      userId: params.user.id,
      refreshTokenHash,
      familyId: params.familyId ?? randomUUID(),
      expiresAt,
      ip: params.ctx.ip,
      userAgent: params.ctx.userAgent,
      device: params.ctx.device,
    });
    const saved = await this.sessions.save(session);
    return { refreshToken, session: saved };
  }

  /** Cherche une session par le token reçu (qu'on hache avant lookup). */
  findSessionByToken(refreshToken: string): Promise<SessionEntity | null> {
    return this.sessions.findOne({
      where: { refreshTokenHash: this.hashRefreshToken(refreshToken) },
      relations: { user: true },
    });
  }

  /** Marque une session précise comme révoquée (rotation normale). */
  async revokeSession(session: SessionEntity): Promise<void> {
    session.revokedAt = new Date();
    session.lastUsedAt = new Date();
    await this.sessions.save(session);
  }

  /**
   * Révoque **toute** une famille de sessions (toutes celles encore actives).
   * Déclenché lorsqu'un refresh déjà consommé est rejoué — signal probable
   * de vol de token (cf. ADR-009).
   */
  async revokeFamily(familyId: string): Promise<void> {
    await this.sessions.update({ familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  /** Parse `5m`, `7d`, `3600s`, `2h` → secondes. */
  static parseDurationSeconds(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) {
      throw new Error(`Invalid duration: ${value}`);
    }
    const n = parseInt(match[1], 10);
    switch (match[2]) {
      case 's':
        return n;
      case 'm':
        return n * 60;
      case 'h':
        return n * 3600;
      case 'd':
        return n * 86400;
      default:
        throw new Error(`Invalid duration unit: ${match[2]}`);
    }
  }
}
