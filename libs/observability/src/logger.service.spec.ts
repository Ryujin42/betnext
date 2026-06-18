import 'reflect-metadata';
import { Writable } from 'node:stream';
import winston from 'winston';
import { BetNextLoggerService } from './logger.service';

/** Construit un logger dont les sorties JSON sont capturées en mémoire. */
function loggerWithCapture(service: string): {
  service: BetNextLoggerService;
  read: () => Array<Record<string, unknown>>;
} {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb): void {
      chunks.push(chunk.toString());
      cb();
    },
  });
  const winstonLogger = winston.createLogger({
    level: 'debug',
    defaultMeta: { service },
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [new winston.transports.Stream({ stream })],
  });
  return {
    service: new BetNextLoggerService(service, winstonLogger),
    read: () =>
      chunks
        .join('')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l)),
  };
}

/**
 * T11.3 — vérifie que les logs sont structurés JSON avec le contexte complet
 * (service, traceId, userId, errorCode...) et que le message objet du filtre
 * d'exception est correctement aplati.
 */
describe('BetNextLoggerService (T11.3)', () => {
  it('émet un log JSON avec service, level et message', () => {
    const { service, read } = loggerWithCapture('betting-service');
    service.log('pari placé', 'BetsService');
    const [entry] = read();
    expect(entry.service).toBe('betting-service');
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('pari placé');
    expect(entry.context).toBe('BetsService');
    expect(entry.timestamp).toBeDefined();
  });

  it('aplatit un message objet (filtre d’exception) avec traceId/userId/errorCode', () => {
    const { service, read } = loggerWithCapture('api-gateway');
    service.error(
      { traceId: 't-123', userId: 42, errorCode: 'GEN_500', path: '/bets', message: 'boom' },
      'stack-trace-serveur',
      'BetNextExceptionFilter',
    );
    const [entry] = read();
    expect(entry.level).toBe('error');
    expect(entry.service).toBe('api-gateway');
    expect(entry.traceId).toBe('t-123');
    expect(entry.userId).toBe(42);
    expect(entry.errorCode).toBe('GEN_500');
    expect(entry.message).toBe('boom');
    expect(entry.context).toBe('BetNextExceptionFilter');
    // La stack est journalisée côté serveur (details), jamais renvoyée au client.
    expect(JSON.stringify(entry.details)).toContain('stack-trace-serveur');
  });
});
