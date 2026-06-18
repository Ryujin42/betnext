import 'reflect-metadata';
import { BetNextTopic } from '@betnext/shared-events';
import { AuditSubscriber } from './audit.subscriber';
import { AUDITED_TOPICS } from './audit-event.mapper';

/**
 * T11.1 — vérifie que le subscriber branche un handler sur chaque topic
 * sensible et qu'un message reçu produit un appel à `AuditService.record`
 * (qui inscrit une ligne append-only).
 */
describe('AuditSubscriber (T11.1)', () => {
  it('abonne tous les topics sensibles et route chaque message vers record()', () => {
    type Handler<T> = (event: T) => unknown;
    const handlers = new Map<string, Handler<unknown>>();
    const bus = {
      publish: jest.fn(),
      subscribe: jest.fn((topic: string, handler: Handler<unknown>) => {
        handlers.set(topic, handler);
      }),
    };
    const audit = { record: jest.fn() };

    const subscriber = new AuditSubscriber(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bus as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audit as any,
    );
    subscriber.onModuleInit();

    // Un abonnement par topic audité, sans oubli ni doublon.
    expect(bus.subscribe).toHaveBeenCalledTimes(AUDITED_TOPICS.length);
    for (const topic of AUDITED_TOPICS) {
      expect(handlers.has(topic)).toBe(true);
    }

    // Un message `user.suspended` est transmis tel quel à l'audit.
    const payload = { userId: 7, adminId: 1, reason: 'fraude', occurredAt: '2026-06-17T10:00:00Z' };
    handlers.get(BetNextTopic.UserSuspended)?.(payload);
    expect(audit.record).toHaveBeenCalledWith(BetNextTopic.UserSuspended, payload);
  });
});
