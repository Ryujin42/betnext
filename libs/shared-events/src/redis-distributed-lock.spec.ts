import 'reflect-metadata';
import { RedisDistributedLock, type RedisLockClient } from './redis-distributed-lock';

describe('RedisDistributedLock', () => {
  it('acquiert avec SET NX EX puis exécute la fonction', async () => {
    const set = jest.fn().mockResolvedValue('OK');
    const evalFn = jest.fn().mockResolvedValue(1);
    const client: RedisLockClient = { set, eval: evalFn };
    const lock = new RedisDistributedLock(client);

    const result = await lock.withLock('event:1', 60, async () => 'recalc');

    expect(result).toBe('recalc');
    // SET key token NX EX 60
    expect(set).toHaveBeenCalledWith('event:1', expect.any(String), 'NX', 'EX', 60);
    // Libération via le script Lua compare-and-delete.
    expect(evalFn).toHaveBeenCalledTimes(1);
  });

  it('ignore le travail si le verrou est déjà détenu (SET renvoie null)', async () => {
    const set = jest.fn().mockResolvedValue(null);
    const evalFn = jest.fn();
    const lock = new RedisDistributedLock({ set, eval: evalFn });

    const fn = jest.fn();
    const result = await lock.withLock('event:1', 60, fn);

    expect(result).toBeNull();
    expect(fn).not.toHaveBeenCalled();
    expect(evalFn).not.toHaveBeenCalled(); // rien à libérer
  });

  it('libère le verrou même si la fonction throw', async () => {
    const set = jest.fn().mockResolvedValue('OK');
    const evalFn = jest.fn().mockResolvedValue(1);
    const lock = new RedisDistributedLock({ set, eval: evalFn });

    await expect(
      lock.withLock('k', 60, async () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(evalFn).toHaveBeenCalledTimes(1);
  });
});
