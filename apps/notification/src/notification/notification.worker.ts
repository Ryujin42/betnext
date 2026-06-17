import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  BetNextQueue,
  BULLMQ_FACTORY,
  IBullMqFactory,
  NotificationJob,
} from '@betnext/shared-events';

/**
 * Worker BullMQ qui consomme la queue `notification` (T7.1). En contexte
 * scolaire, l'envoi de mails/push est mocké — on journalise le template et
 * la cible. Le job profite du retry exponentiel par défaut ; si tous les
 * essais échouent, il finit en DLQ (`removeOnFail: 24h`) sans impact sur le
 * flux principal (DoD T7.3 : « notification down → pari quand même placé »).
 */
@Injectable()
export class NotificationWorker implements OnModuleInit {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(@Inject(BULLMQ_FACTORY) private readonly bullmq: IBullMqFactory) {}

  onModuleInit(): void {
    this.bullmq.createWorker<NotificationJob>(BetNextQueue.Notification, async (data) => {
      this.logger.log(
        `[mock] envoi notification user=${data.userId} template=${data.template} data=${JSON.stringify(data.data)}`,
      );
    });
    this.logger.log(`Worker BullMQ ${BetNextQueue.Notification} démarré.`);
  }
}
