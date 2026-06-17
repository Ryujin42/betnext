import 'reflect-metadata';
import { MockStripeProvider } from './mock-stripe.provider';
import { BetNextException } from '../common/betnext.exception';

describe('MockStripeProvider (T6.2)', () => {
  it('crée un PaymentIntent en requires_confirmation, sans réseau', async () => {
    const provider = new MockStripeProvider();
    const intent = await provider.createPaymentIntent({ amount: 50, userId: 3 });
    expect(intent.id).toMatch(/^pi_mock_/);
    expect(intent.amount).toBe(50);
    expect(intent.userId).toBe(3);
    expect(intent.status).toBe('requires_confirmation');
    expect(intent.clientSecret).toContain(intent.id);
  });

  it('confirmPayment renvoie un événement payment_intent.succeeded cohérent', async () => {
    const provider = new MockStripeProvider();
    const intent = await provider.createPaymentIntent({ amount: 50, userId: 3 });
    const event = await provider.confirmPayment(intent.id);
    expect(event.type).toBe('payment_intent.succeeded');
    expect(event.paymentIntentId).toBe(intent.id);
    expect(event.amount).toBe(50);
    expect(event.userId).toBe(3);
  });

  it('confirmPayment rejette un intent inconnu', async () => {
    const provider = new MockStripeProvider();
    await expect(provider.confirmPayment('pi_inconnu')).rejects.toBeInstanceOf(BetNextException);
  });

  it('parseWebhook valide la forme du payload', () => {
    const provider = new MockStripeProvider();
    const event = {
      id: 'evt_1',
      type: 'payment_intent.succeeded',
      paymentIntentId: 'pi_1',
      amount: 20,
      userId: 3,
    };
    expect(provider.parseWebhook(event)).toEqual(event);
    expect(() => provider.parseWebhook({ foo: 'bar' })).toThrow(BetNextException);
  });
});
