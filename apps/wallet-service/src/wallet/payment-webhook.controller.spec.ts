import 'reflect-metadata';
import { BetNextQueue } from '@betnext/shared-events';
import { MockStripeProvider } from '../payment/mock-stripe.provider';
import { PaymentWebhookController } from './payment-webhook.controller';

describe('PaymentWebhookController (T7.1)', () => {
  it('enqueue le job `payment-webhook` avec jobId = event.id (idempotence rejeu)', async () => {
    const queueAdd = jest.fn().mockResolvedValue(undefined);
    const bullmq = {
      getQueue: jest.fn().mockReturnValue({ add: queueAdd }),
      createWorker: jest.fn(),
      defaultJobOptions: jest.fn().mockReturnValue({}),
    };
    const payment = new MockStripeProvider();
    const controller = new PaymentWebhookController(
      payment,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bullmq as any,
    );

    const event = {
      id: 'evt_1',
      type: 'payment_intent.succeeded' as const,
      paymentIntentId: 'pi_1',
      amount: 50,
      userId: 3,
    };
    const res = await controller.handle(event);

    expect(bullmq.getQueue).toHaveBeenCalledWith(BetNextQueue.PaymentWebhook);
    expect(queueAdd).toHaveBeenCalledWith('apply', event, { jobId: 'evt_1' });
    expect(res).toEqual({ received: true, queued: true });
  });
});
