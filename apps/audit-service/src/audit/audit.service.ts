import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AuditLogEntity } from '@betnext/database';
import type { IAuditLog } from '@betnext/shared-types';
import { extractAuditFields } from './audit-event.mapper';

/** Critères de consultation (lecture seule) de l'audit. */
export interface AuditQuery {
  userId?: number;
  topic?: string;
  limit?: number;
}

/**
 * Service d'audit ARJEL (T11.1). N'expose que deux opérations : **inscrire**
 * (INSERT only) et **consulter**. Aucune méthode de mise à jour ou de
 * suppression — l'immuabilité est en plus verrouillée par un trigger PostgreSQL.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private static readonly DEFAULT_LIMIT = 100;
  private static readonly MAX_LIMIT = 500;

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  /**
   * Inscrit une action sensible reçue sur le bus. Le payload complet est
   * conservé tel quel ; `userId`/`actorId`/`occurredAt` sont extraits pour
   * l'indexation et la recherche.
   */
  async record(topic: string, payload: Record<string, unknown>): Promise<void> {
    const { userId, actorId, occurredAt } = extractAuditFields(payload);
    const entry = this.repo.create({ topic, userId, actorId, payload, occurredAt });
    await this.repo.save(entry);
    this.logger.log(`audit topic=${topic} userId=${userId ?? '-'} actorId=${actorId ?? '-'}`);
  }

  /** Consultation en lecture seule (ordre antéchronologique). */
  async find(query: AuditQuery = {}): Promise<IAuditLog[]> {
    const take = Math.min(query.limit ?? AuditService.DEFAULT_LIMIT, AuditService.MAX_LIMIT);
    const qb = this.repo.createQueryBuilder('a').orderBy('a.recorded_at', 'DESC').take(take);
    if (query.userId !== undefined) {
      qb.andWhere('a.user_id = :userId', { userId: query.userId });
    }
    if (query.topic !== undefined) {
      qb.andWhere('a.topic = :topic', { topic: query.topic });
    }
    const rows = await qb.getMany();
    return rows.map((row) => row.toPublic());
  }
}
