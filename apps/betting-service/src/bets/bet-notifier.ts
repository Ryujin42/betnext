import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  BetNextQueue,
  BULLMQ_FACTORY,
  type IBullMqFactory,
  type NotificationJob,
} from '@betnext/shared-events';

/**
 * Notification best-effort d'un pari placé (T7.3). Pousse un job
 * `notification` mais **n'échoue jamais** : si Redis / la queue / le worker
 * sont down, on logue et on rend la main. Le pari reste valide même si la
 * notification ne part pas.
 *
 * DoD T7.3 : « couper le notification-service ne bloque pas le placement
 * d'un pari ». Le découplage par queue + ce wrapper garantit que le flux
 * principal n'est jamais en cascade d'une dépendance non critique.
 */
@Injectable()
export class BetNotifier {
  private readonly logger = new Logger(BetNotifier.name);

  constructor(@Inject(BULLMQ_FACTORY) private readonly bullmq: IBullMqFactory) {}

  async notifyBetPlaced(userId: number, betId: number, amount: number): Promise<void> {
    const job: NotificationJob = {
      template: 'bet.placed',
      userId,
      data: { betId, amount },
    };
    try {
      const queue = this.bullmq.getQueue(BetNextQueue.Notification);
      await queue.add('send', job);
    } catch (err) {
      // Volontairement non-bloquant : on capture toute exception réseau /
      // file / Redis. Le pari est déjà committé, la notification est
      // best-effort.
      this.logger.warn(
        `Notification "bet.placed" non envoyée pour le pari #${betId} : ${(err as Error).message}`,
      );
    }
  }
}
