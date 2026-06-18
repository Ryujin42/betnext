import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BetNextErrorCode } from '@betnext/shared-types';
import { RgProfileEntity, UserEntity } from '@betnext/database';
import { BetNextException } from '../common/betnext.exception';

/**
 * Vérifie qu'un utilisateur peut encore agir (parier, déposer, retirer) malgré
 * un access token JWT toujours valide :
 * - `users.suspended_at` non null → `AUTH_003` (suspension admin).
 * - `rg_profiles.self_excluded_until > now` → `AUTH_004` (auto-exclusion).
 *
 * Le JWT vit ~5 min : sans ce check, un compte suspendu/auto-exclu peut encore
 * placer un pari ou retirer de l'argent pendant la fenêtre. Schéma unique
 * `betnext` → lecture directe, pas de RPC vers le user-service.
 */
@Injectable()
export class AccountStatusService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(RgProfileEntity)
    private readonly rgProfiles: Repository<RgProfileEntity>,
  ) {}

  async assertCanAct(userId: number): Promise<void> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: ['id', 'suspendedAt'],
    });
    if (user?.suspendedAt) {
      throw new BetNextException(
        BetNextErrorCode.ACCOUNT_SUSPENDED,
        HttpStatus.FORBIDDEN,
        'Compte suspendu — action refusée.',
      );
    }

    const profile = await this.rgProfiles.findOne({
      where: { userId },
      select: ['id', 'selfExcludedUntil'],
    });
    if (profile?.selfExcludedUntil && profile.selfExcludedUntil.getTime() > Date.now()) {
      throw new BetNextException(
        BetNextErrorCode.ACCOUNT_SELF_EXCLUDED,
        HttpStatus.FORBIDDEN,
        `Compte auto-exclu jusqu'au ${profile.selfExcludedUntil.toISOString()}.`,
        { selfExcludedUntil: profile.selfExcludedUntil.toISOString() },
      );
    }
  }
}
