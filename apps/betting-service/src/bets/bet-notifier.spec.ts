import 'reflect-metadata';
import { BetNextQueue } from '@betnext/shared-events';
import { BetNotifier } from './bet-notifier';

describe('BetNotifier (T7.3 — best-effort)', () => {
  it('enqueue un job notification avec le bon template', async () => {
    const queueAdd = jest.fn().mockResolvedValue(undefined);
    const bullmq = {
      getQueue: jest.fn().mockReturnValue({ add: queueAdd }),
      createWorker: jest.fn(),
      defaultJobOptions: jest.fn().mockReturnValue({}),
    };
    const notifier = new BetNotifier(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bullmq as any,
    );
    await notifier.notifyBetPlaced(5, 42, 25);
    expect(bullmq.getQueue).toHaveBeenCalledWith(BetNextQueue.Notification);
    expect(queueAdd).toHaveBeenCalledWith('send', {
      template: 'bet.placed',
      userId: 5,
      data: { betId: 42, amount: 25 },
    });
  });

  // DoD T7.3 — couper le notification-service ne bloque pas le pari.
  it("n'échoue jamais : si la queue throw (Redis/worker down), on log et on rend la main", async () => {
    const bullmq = {
      getQueue: jest.fn().mockReturnValue({
        add: jest.fn().mockRejectedValue(new Error('ECONNREFUSED redis:6379')),
      }),
      createWorker: jest.fn(),
      defaultJobOptions: jest.fn().mockReturnValue({}),
    };
    const notifier = new BetNotifier(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bullmq as any,
    );
    await expect(notifier.notifyBetPlaced(5, 42, 25)).resolves.toBeUndefined();
  });

  it('même si getQueue elle-même throw (factory cassée), pas de propagation', async () => {
    const bullmq = {
      getQueue: jest.fn().mockImplementation(() => {
        throw new Error('factory down');
      }),
      createWorker: jest.fn(),
      defaultJobOptions: jest.fn().mockReturnValue({}),
    };
    const notifier = new BetNotifier(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bullmq as any,
    );
    await expect(notifier.notifyBetPlaced(5, 42, 25)).resolves.toBeUndefined();
  });
});
