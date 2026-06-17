import 'reflect-metadata';
import { InMemoryEventBus } from './in-memory-event-bus';

describe('InMemoryEventBus', () => {
  it('délivre une publication à tous les abonnés du topic', async () => {
    const bus = new InMemoryEventBus();
    const received: number[] = [];
    bus.subscribe<{ n: number }>('demo', (p) => {
      received.push(p.n);
    });
    bus.subscribe<{ n: number }>('demo', (p) => {
      received.push(p.n * 10);
    });

    await bus.publish('demo', { n: 2 });

    expect(received).toEqual([2, 20]);
  });

  it("n'appelle pas les abonnés d'un autre topic", async () => {
    const bus = new InMemoryEventBus();
    const handler = jest.fn();
    bus.subscribe('a', handler);

    await bus.publish('b', {});

    expect(handler).not.toHaveBeenCalled();
  });

  it('isole les erreurs : un handler qui throw ne casse pas les autres', async () => {
    const bus = new InMemoryEventBus();
    const ok = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    bus.subscribe('t', () => {
      throw new Error('boom');
    });
    bus.subscribe('t', ok);

    await expect(bus.publish('t', {})).resolves.toBeUndefined();
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('attend les handlers asynchrones', async () => {
    const bus = new InMemoryEventBus();
    let done = false;
    bus.subscribe('t', async () => {
      await new Promise((r) => setTimeout(r, 5));
      done = true;
    });

    await bus.publish('t', {});

    expect(done).toBe(true);
  });
});
