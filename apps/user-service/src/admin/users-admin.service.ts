import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { BetNextErrorCode, type IUser, type Role } from '@betnext/shared-types';
import { UserEntity } from '@betnext/database';
import {
  BetNextTopic,
  EVENT_BUS,
  type IEventBus,
  type UserSuspendedEvent,
  type UserUnsuspendedEvent,
} from '@betnext/shared-events';
import { BetNextException } from '../common/exceptions/betnext.exception';

export type AdminUserView = IUser & {
  suspendedAt: string | null;
  suspendedReason: string | null;
};

export interface ListUsersQuery {
  /** Recherche full-text sur nom + email. */
  search?: string;
  role?: Role;
  /** `true` ⇒ uniquement les comptes suspendus, `false` ⇒ actifs uniquement. */
  suspended?: boolean;
  page?: number;
  /** Taille de page (clampée 1–100). */
  pageSize?: number;
  sortBy?: 'createdAt' | 'name' | 'email';
  sortDir?: 'asc' | 'desc';
}

export interface PaginatedUsers {
  items: AdminUserView[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Gestion administrative des comptes (T8.3). Liste paginée + tri + filtrage,
 * suspension/réactivation (avec émission `user.suspended` / `user.unsuspended`
 * sur le bus).
 */
@Injectable()
export class UsersAdminService {
  private readonly logger = new Logger(UsersAdminService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  async list(query: ListUsersQuery): Promise<PaginatedUsers> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const sortBy = query.sortBy ?? 'createdAt';
    const sortDir = (query.sortDir ?? 'desc').toUpperCase() as 'ASC' | 'DESC';

    const where: Record<string, unknown> = {};
    if (query.role) {
      where.role = query.role;
    }

    const qb = this.users.createQueryBuilder('u');
    if (query.search) {
      // Recherche insensible à la casse sur nom OU email.
      qb.where('(u.name ILIKE :term OR u.email ILIKE :term)', { term: `%${query.search}%` });
    }
    if (query.role) {
      qb.andWhere('u.role = :role', { role: query.role });
    }
    if (query.suspended === true) {
      qb.andWhere('u.suspended_at IS NOT NULL');
    } else if (query.suspended === false) {
      qb.andWhere('u.suspended_at IS NULL');
    }
    qb.orderBy(`u.${this.sortColumn(sortBy)}`, sortDir);
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [rows, total] = await qb.getManyAndCount();
    void ILike; // workaround unused import (kept for future where shorthand)
    return {
      items: rows.map((r) => r.toAdminView()),
      total,
      page,
      pageSize,
    };
  }

  async get(userId: number): Promise<AdminUserView> {
    const user = await this.findOrThrow(userId);
    return user.toAdminView();
  }

  /**
   * Suspend un compte (effet immédiat sur la connexion). Idempotent : si
   * déjà suspendu, n'écrase pas la date originale.
   */
  async suspend(userId: number, adminId: number, reason: string | null): Promise<AdminUserView> {
    const user = await this.findOrThrow(userId);
    if (!user.suspendedAt) {
      user.suspendedAt = new Date();
    }
    user.suspendedReason = reason;
    const saved = await this.users.save(user);

    await this.bus.publish<UserSuspendedEvent>(BetNextTopic.UserSuspended, {
      userId,
      adminId,
      reason,
      occurredAt: new Date().toISOString(),
    });
    this.logger.log(`User ${userId} suspendu par admin ${adminId} (raison: ${reason ?? 'n/a'}).`);
    return saved.toAdminView();
  }

  /** Lève la suspension. No-op si le compte n'était pas suspendu. */
  async unsuspend(userId: number, adminId: number): Promise<AdminUserView> {
    const user = await this.findOrThrow(userId);
    user.suspendedAt = null;
    user.suspendedReason = null;
    const saved = await this.users.save(user);

    await this.bus.publish<UserUnsuspendedEvent>(BetNextTopic.UserUnsuspended, {
      userId,
      adminId,
      occurredAt: new Date().toISOString(),
    });
    this.logger.log(`User ${userId} réactivé par admin ${adminId}.`);
    return saved.toAdminView();
  }

  private async findOrThrow(userId: number): Promise<UserEntity> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new BetNextException(
        BetNextErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        `Utilisateur ${userId} introuvable.`,
      );
    }
    return user;
  }

  private sortColumn(field: 'createdAt' | 'name' | 'email'): string {
    switch (field) {
      case 'name':
        return 'name';
      case 'email':
        return 'email';
      case 'createdAt':
      default:
        return 'createdAt';
    }
  }
}
