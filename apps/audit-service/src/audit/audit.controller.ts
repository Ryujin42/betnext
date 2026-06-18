import { Controller, Get, Query } from '@nestjs/common';
import type { IAuditLog } from '@betnext/shared-types';
import { AuditService } from './audit.service';

/**
 * Consultation de l'audit ARJEL — **lecture seule** (T11.1).
 *
 * Ce contrôleur n'expose volontairement aucune route `POST`/`PUT`/`PATCH`/
 * `DELETE` : une trace d'audit ne se crée que via le bus (consommation
 * d'événements) et ne se modifie ni ne se supprime jamais. C'est la garantie
 * applicative, doublée du trigger d'immuabilité côté PostgreSQL.
 */
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query('userId') userId?: string,
    @Query('topic') topic?: string,
    @Query('limit') limit?: string,
  ): Promise<IAuditLog[]> {
    return this.audit.find({
      userId: parseOptionalInt(userId),
      topic: topic && topic.length > 0 ? topic : undefined,
      limit: parseOptionalInt(limit),
    });
  }
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
