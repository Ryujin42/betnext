import 'reflect-metadata';
import { BetNextQueue, BetNextTopic } from '@betnext/shared-events';
import { BetResolutionProducer } from './bet-resolution.producer';

describe('BetResolutionProducer (T7.1)', () => {
  it('abonne `event.result_set` et enqueue un job bet-resolution déduplicable', () => {
    type Handler<T> = (event: T) => unknown;
    const handlers = new Map<string, Handler<unknown>>();
    const bus = {
      publish: jest.fn(),
      subscribe: jest.fn((topic: string, handler: Handler<unknown>) => {
        handlers.set(topic, handler);
      }),
    };
    const queueAdd = jest.fn().mockResolvedValue(undefined);
    const bullmq = {
      getQueue: jest.fn().mockReturnValue({ add: queueAdd }),
      createWorker: jest.fn(),
      defaultJobOptions: jest.fn().mockReturnValue({}),
    };

    const producer = new BetResolutionProducer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bus as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bullmq as any,
    );
    producer.onModuleInit();

    const handler = handlers.get(BetNextTopic.EventResultSet);
    expect(handler).toBeDefined();
    handler?.({ eSportEventId: 42, occurredAt: '2026-06-17T00:00:00Z' });

    expect(bullmq.getQueue).toHaveBeenCalledWith(BetNextQueue.BetResolution);
    expect(queueAdd).toHaveBeenCalledWith(
      'resolve',
      { eSportEventId: 42 },
      // `jobId: event-42` garantit qu'un rejeu du même évènement ne crée pas
      // deux résolutions concurrentes côté BullMQ.
      { jobId: 'event-42' },
    );
  });
});
