import 'reflect-metadata';
import { InMemoryLock } from './in-memory-lock';

describe('InMemoryLock', () => {
  it('exécute la fonction sous verrou et renvoie son résultat', async () => {
    const lock = new InMemoryLock();
    const result = await lock.withLock('k', 60, async () => 42);
    expect(result).toBe(42);
  });

  it('libère le verrou après exécution (acquisitions séquentielles OK)', async () => {
    const lock = new InMemoryLock();
    await lock.withLock('k', 60, async () => undefined);
    const second = await lock.withLock('k', 60, async () => 'ok');
    expect(second).toBe('ok');
  });

  it('empêche les exécutions concurrentes : la seconde est ignorée (null)', async () => {
    const lock = new InMemoryLock();
    let running = 0;
    let maxConcurrent = 0;

    const task = (): Promise<string | null> =>
      lock.withLock('event:1', 60, async () => {
        running += 1;
        maxConcurrent = Math.max(maxConcurrent, running);
        await new Promise((r) => setTimeout(r, 20));
        running -= 1;
        return 'done';
      });

    const [a, b] = await Promise.all([task(), task()]);

    expect(maxConcurrent).toBe(1); // jamais deux recalculs en parallèle
    // L'un des deux obtient le verrou, l'autre est ignoré (null).
    expect([a, b].filter((r) => r === 'done')).toHaveLength(1);
    expect([a, b].filter((r) => r === null)).toHaveLength(1);
  });

  it('libère le verrou même si la fonction throw', async () => {
    const lock = new InMemoryLock();
    await expect(
      lock.withLock('k', 60, async () => Promise.reject(new Error('x'))),
    ).rejects.toThrow('x');
    const after = await lock.withLock('k', 60, async () => 'recovered');
    expect(after).toBe('recovered');
  });
});
