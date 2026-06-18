import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BetNextErrorCode } from '@betnext/shared-types';
import { RgProfileEntity, UserEntity } from '@betnext/database';
import { BetNextException } from '../common/betnext.exception';

/**
 * Refuse les opérations wallet (dépôt/retrait) tant que le compte est
 * suspendu (`users.suspended_at`) ou auto-exclu
 * (`rg_profiles.self_excluded_until > now`). Sans ce check, un token JWT
 * encore valide (5 min) permettrait à un compte gelé de bouger des fonds.
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
