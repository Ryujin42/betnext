import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@betnext/shared-events';
import { AuditService } from './audit.service';
import { AUDITED_TOPICS } from './audit-event.mapper';

/**
 * Branche l'audit-service sur **tous** les topics sensibles du bus (T11.1).
 * Chaque message reçu produit une ligne d'audit append-only. L'abonnement est
 * générique (un seul handler par topic), ce qui rend la couverture exhaustive
 * et facile à étendre : ajouter un topic dans {@link AUDITED_TOPICS} suffit.
 *
 * Nécessite le bus Redis Pub/Sub inter-services (`EVENT_BUS_DRIVER=redis`) pour
 * recevoir les événements émis par les autres services (Lot 7).
 */
@Injectable()
export class AuditSubscriber implements OnModuleInit {
  private readonly logger = new Logger(AuditSubscriber.name);

  constructor(
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    for (const topic of AUDITED_TOPICS) {
      this.bus.subscribe<Record<string, unknown>>(topic, (payload) =>
        this.audit.record(topic, payload),
      );
    }
    this.logger.log(`Audit branché sur ${AUDITED_TOPICS.length} topics sensibles.`);
  }
}
