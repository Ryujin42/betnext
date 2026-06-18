import type { LoggerService } from '@nestjs/common';
import winston from 'winston';
import LokiTransport from 'winston-loki';

/**
 * Crée un logger Winston **structuré JSON** (T11.3). Chaque entrée porte
 * `timestamp`, `level`, `service` (+ `traceId`, `userId`, `context`... fournis
 * par l'appelant). Transport console toujours actif ; transport **Loki** activé
 * uniquement si `LOKI_URL` est défini (agrégation centralisée des logs).
 */
export function createWinstonLogger(service: string): winston.Logger {
  const transports: winston.transport[] = [new winston.transports.Console()];

  const lokiUrl = process.env.LOKI_URL;
  if (lokiUrl) {
    transports.push(
      new LokiTransport({
        host: lokiUrl,
        labels: { service },
        json: true,
        batching: true,
        replaceTimestamp: true,
        // Best-effort : une panne de Loki ne doit jamais casser le service.
        onConnectionError: (err: unknown) =>
          console.error(`[loki] ${service} connection error`, err),
      }),
    );
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    defaultMeta: { service },
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports,
  });
}

/**
 * Adaptateur {@link LoggerService} NestJS branché sur Winston. Posé via
 * `app.useLogger(new BetNextLoggerService('<service>'))` dans le `main.ts`,
 * il rend **tous** les logs (Nest + applicatifs + filtre d'exception) JSON
 * structurés et expédiables vers Loki.
 *
 * Conventions Nest : le dernier paramètre string est le `context` (nom de la
 * classe émettrice) ; un message **objet** (utilisé par le filtre d'exception)
 * est fusionné dans les métadonnées — d'où un log d'erreur complet et
 * recherchable (`traceId`, `userId`, `errorCode`, `path`...).
 */
export class BetNextLoggerService implements LoggerService {
  private readonly logger: winston.Logger;

  /** `logger` injectable pour les tests ; sinon construit le logger Winston du service. */
  constructor(service: string, logger: winston.Logger = createWinstonLogger(service)) {
    this.logger = logger;
  }

  log(message: unknown, ...rest: unknown[]): void {
    this.emit('info', message, rest);
  }
  error(message: unknown, ...rest: unknown[]): void {
    this.emit('error', message, rest);
  }
  warn(message: unknown, ...rest: unknown[]): void {
    this.emit('warn', message, rest);
  }
  debug(message: unknown, ...rest: unknown[]): void {
    this.emit('debug', message, rest);
  }
  verbose(message: unknown, ...rest: unknown[]): void {
    this.emit('verbose', message, rest);
  }

  private emit(level: string, message: unknown, rest: unknown[]): void {
    const params = [...rest];
    const meta: Record<string, unknown> = {};

    // Dernier param string = contexte Nest (nom de la classe émettrice).
    if (params.length > 0 && typeof params[params.length - 1] === 'string') {
      meta.context = params.pop();
    }
    // Reste (ex. stack trace transmise par le filtre) → métadonnée serveur.
    // Jamais renvoyée au client (cf. filtre d'exception), seulement journalisée.
    if (params.length > 0) {
      meta.details = params;
    }

    if (message !== null && typeof message === 'object') {
      // On extrait `message` pour le texte du log ; le reste devient métadonnée
      // (sans réinjecter `message`, sinon Winston le concatène au texte).
      const { message: text, ...restMeta } = message as Record<string, unknown>;
      Object.assign(meta, restMeta);
      this.logger.log(level, typeof text === 'string' ? text : level, meta);
      return;
    }
    this.logger.log(level, typeof message === 'string' ? message : JSON.stringify(message), meta);
  }
}
