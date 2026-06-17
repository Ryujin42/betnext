import 'reflect-metadata';

jest.mock('bullmq', () => {
  type QueueOptions = { connection: unknown; defaultJobOptions: unknown };
  type WorkerOptions = { connection: unknown };
  const Queue = jest.fn().mockImplementation(function (
    this: Record<string, unknown>,
    name: string,
    options: QueueOptions,
  ) {
    this.name = name;
    this.options = options;
    this.close = jest.fn(async () => undefined);
  });
  const Worker = jest.fn().mockImplementation(function (
    this: Record<string, unknown>,
    name: string,
    processor: (job: { data: unknown }) => Promise<void>,
    options: WorkerOptions,
  ) {
    this.name = name;
    this.processor = processor;
    this.options = options;
    this.events = new Map<string, (...args: unknown[]) => void>();
    this.on = jest.fn((event: string, listener: (...args: unknown[]) => void) => {
      (this.events as Map<string, (...args: unknown[]) => void>).set(event, listener);
      return this;
    });
    this.close = jest.fn(async () => undefined);
  });
  return { Queue, Worker };
});

import { Queue, Worker } from 'bullmq';
import { BullMqFactory } from './bullmq.module';

describe('BullMqFactory (T7.1)', () => {
  beforeEach(() => {
    (Queue as unknown as jest.Mock).mockClear();
    (Worker as unknown as jest.Mock).mockClear();
  });

  it('default job options : retry exponentiel (5 tentatives, backoff 1s) — DoD T7.1', () => {
    const factory = new BullMqFactory({ url: 'redis://x' });
    expect(factory.defaultJobOptions()).toMatchObject({
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
    });
  });

  it("getQueue partage l'instance par nom (une seule Queue ioredis par nom)", () => {
    const factory = new BullMqFactory({ url: 'redis://x' });
    const q1 = factory.getQueue('bet-resolution');
    const q2 = factory.getQueue('bet-resolution');
    expect(q1).toBe(q2);
    expect(Queue).toHaveBeenCalledTimes(1);
  });

  it('createWorker câble le processor et propage la connexion', async () => {
    const factory = new BullMqFactory({ url: 'redis://x' });
    const processor = jest.fn().mockResolvedValue(undefined);
    const worker = factory.createWorker<{ id: number }>('bet-resolution', processor);

    expect(Worker).toHaveBeenCalledTimes(1);
    const ctor = (Worker as unknown as jest.Mock).mock.calls[0];
    expect(ctor[0]).toBe('bet-resolution');
    expect(ctor[2]).toMatchObject({ connection: { url: 'redis://x' } });

    // Le processor BullMQ reçoit le `job` et extrait `data` pour notre processor.
    const internalProcessor = ctor[1] as (job: { data: unknown }) => Promise<void>;
    await internalProcessor({ data: { id: 42 } });
    expect(processor).toHaveBeenCalledWith({ id: 42 });

    // `on('failed', …)` est branché pour journaliser.
    type EventBag = { events: Map<string, (...args: unknown[]) => void> };
    expect((worker as unknown as EventBag).events.has('failed')).toBe(true);
  });

  it('onApplicationShutdown ferme queues et workers', async () => {
    const factory = new BullMqFactory({ url: 'redis://x' });
    const queue = factory.getQueue('q1') as unknown as { close: jest.Mock };
    const worker = factory.createWorker('q1', jest.fn()) as unknown as { close: jest.Mock };
    await factory.onApplicationShutdown();
    expect(queue.close).toHaveBeenCalled();
    expect(worker.close).toHaveBeenCalled();
  });
});
