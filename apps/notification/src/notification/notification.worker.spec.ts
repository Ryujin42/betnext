import 'reflect-metadata';
import { BetNextQueue } from '@betnext/shared-events';
import { NotificationWorker } from './notification.worker';

describe('NotificationWorker (T7.1)', () => {
  it('démarre un worker BullMQ sur la queue `notification`', () => {
    const createWorker = jest.fn();
    const bullmq = {
      createWorker,
      getQueue: jest.fn(),
      defaultJobOptions: jest.fn().mockReturnValue({}),
    };

    const worker = new NotificationWorker(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bullmq as any,
    );
    worker.onModuleInit();

    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(createWorker.mock.calls[0][0]).toBe(BetNextQueue.Notification);
  });

  it('le processor (mock) journalise sans lever : pas de blocage du flux principal', async () => {
    const createWorker = jest.fn();
    const bullmq = {
      createWorker,
      getQueue: jest.fn(),
      defaultJobOptions: jest.fn().mockReturnValue({}),
    };
    new NotificationWorker(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bullmq as any,
    ).onModuleInit();

    const processor = createWorker.mock.calls[0][1] as (data: unknown) => Promise<void>;
    await expect(
      processor({ template: 'bet.placed', userId: 7, data: { amount: 25 } }),
    ).resolves.toBeUndefined();
  });
});
