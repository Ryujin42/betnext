import { randomUUID } from 'node:crypto';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { BetNextErrorCode, type IErrorResponse } from '@betnext/shared-types';
import { BetNextException } from './betnext.exception';

/**
 * Filtre global qui formate **toutes** les exceptions en réponse uniforme
 * `IErrorResponse` (cf. BETNEXT_CONTEXT §13).
 *
 * - `BetNextException` → on récupère son `errorCode` et son contexte.
 * - `BadRequestException` (class-validator) → mappé sur `VALIDATION_ERROR`
 *   avec la liste des contraintes dans `details.issues`.
 * - Tout le reste (Http ou non) → `INTERNAL_ERROR` 500, jamais de stack
 *   trace exposée au client. La stack est loggée côté serveur.
 *
 * Un `traceId` (header `x-trace-id` ou UUID généré) est inclus dans
 * chaque réponse et dans les logs d'erreur pour corrélation.
 */
@Catch()
export class BetNextExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(BetNextExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<FastifyRequest>();
    const headerTraceId = req.headers['x-trace-id'];
    const traceId = typeof headerTraceId === 'string' ? headerTraceId : randomUUID();

    const body = this.buildBody(exception, traceId);

    if (body.statusCode >= 500) {
      this.logger.error(
        {
          traceId,
          path: req.url,
          method: req.method,
          errorCode: body.errorCode,
          message: body.message,
        },
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    void res.status(body.statusCode).send(body);
  }

  private buildBody(exception: unknown, traceId: string): IErrorResponse {
    if (exception instanceof BetNextException) {
      const raw = exception.getResponse() as {
        errorCode: BetNextErrorCode;
        message: string;
        details?: Record<string, unknown>;
      };
      return {
        statusCode: exception.getStatus(),
        errorCode: raw.errorCode,
        message: raw.message,
        details: raw.details,
        traceId,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      let message = exception.message;
      let details: Record<string, unknown> | undefined;
      let errorCode =
        status >= 500 ? BetNextErrorCode.INTERNAL_ERROR : BetNextErrorCode.VALIDATION_ERROR;

      if (typeof raw === 'object' && raw !== null) {
        const r = raw as { message?: string | string[]; error?: string };
        if (Array.isArray(r.message)) {
          message = 'Validation failed';
          details = { issues: r.message };
        } else if (typeof r.message === 'string') {
          message = r.message;
        }
      }

      if (status === HttpStatus.NOT_FOUND) {
        errorCode = BetNextErrorCode.NOT_FOUND;
      }

      return { statusCode: status, errorCode, message, details, traceId };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: BetNextErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
      traceId,
    };
  }
}
