import 'reflect-metadata';
import { BetNextTopic } from '@betnext/shared-events';
import { AUDITED_TOPICS, extractAuditFields } from './audit-event.mapper';

/**
 * T11.1 — extraction générique des champs indexés d'un événement, et garantie
 * que tous les topics sensibles connus sont bien audités.
 */
describe('audit-event.mapper (T11.1)', () => {
  describe('extractAuditFields', () => {
    it('extrait userId et occurredAt depuis un payload de pari', () => {
      const fields = extractAuditFields({
        betId: 42,
        userId: 3,
        amount: 25,
        occurredAt: '2026-06-17T10:00:00.000Z',
      });
      expect(fields.userId).toBe(3);
      expect(fields.actorId).toBeNull();
      expect(fields.occurredAt.toISOString()).toBe('2026-06-17T10:00:00.000Z');
    });

    it('mappe adminId sur actorId (ex. suspension)', () => {
      const fields = extractAuditFields({
        userId: 7,
        adminId: 1,
        reason: 'fraude',
        occurredAt: '2026-06-17T10:00:00.000Z',
      });
      expect(fields.userId).toBe(7);
      expect(fields.actorId).toBe(1);
    });

    it('retombe sur l’instant courant si occurredAt absent ou invalide', () => {
      const before = Date.now();
      const fields = extractAuditFields({ userId: 1, occurredAt: 'pas-une-date' });
      expect(fields.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('met userId/actorId à null si non numériques (payload partiel)', () => {
      const fields = extractAuditFields({ eSportEventId: 10, occurredAt: '2026-06-17T10:00:00Z' });
      expect(fields.userId).toBeNull();
      expect(fields.actorId).toBeNull();
    });
  });

  describe('AUDITED_TOPICS', () => {
    it('couvre toutes les actions sensibles (paris, paiements, RG, suspension, résultat)', () => {
      expect(AUDITED_TOPICS).toEqual(
        expect.arrayContaining([
          BetNextTopic.BetPlaced,
          BetNextTopic.BetWon,
          BetNextTopic.BetLost,
          BetNextTopic.PaymentDeposited,
          BetNextTopic.PaymentWithdrawn,
          BetNextTopic.RgLimitUpdated,
          BetNextTopic.RgSelfExcluded,
          BetNextTopic.UserSuspended,
          BetNextTopic.UserUnsuspended,
          BetNextTopic.EventResultSet,
        ]),
      );
    });

    it('n’audite pas les événements purement techniques (odds.updated relève du monitoring)', () => {
      expect(AUDITED_TOPICS).not.toContain(BetNextTopic.OddsUpdated);
    });
  });
});
