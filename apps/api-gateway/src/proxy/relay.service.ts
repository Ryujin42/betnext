import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { firstValueFrom } from 'rxjs';
import { BetNextErrorCode } from '@betnext/shared-types';
import { BetNextException } from '../common/exceptions/betnext.exception';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

export interface ForwardOptions {
  /** Body JSON à transmettre (méthodes mutatives). */
  body?: unknown;
  /** Headers additionnels (ex: x-forwarded-for). */
  headers?: Record<string, string>;
  /**
   * User authentifié — son id et son rôle sont injectés dans les headers
   * internes `x-user-id` / `x-user-role` que le user-service consomme.
   */
  user?: AuthenticatedUser;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Relais HTTP du gateway vers le user-service (cf. T2.4).
 *
 * - Conserve le format d'erreur uniforme : si le service downstream renvoie
 *   déjà un `IErrorResponse`, on re-throw une `BetNextException` avec les
 *   mêmes champs.
 * - Injecte les headers internes `x-user-id` / `x-user-role` lorsqu'un
 *   user authentifié est fourni — c'est ce qui matérialise le « les
 *   services internes font confiance aux headers du gateway » (T2.4).
 */
@Injectable()
export class RelayService {
  private readonly logger = new Logger(RelayService.name);
  private readonly userServiceUrl: string;
  private readonly eventServiceUrl: string;
  private readonly bettingServiceUrl: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.userServiceUrl = config.get<string>('USER_SERVICE_URL') ?? 'http://localhost:3001';
    this.eventServiceUrl = config.get<string>('EVENT_SERVICE_URL') ?? 'http://localhost:3002';
    this.bettingServiceUrl = config.get<string>('BETTING_SERVICE_URL') ?? 'http://localhost:3003';
  }

  forwardToUserService<T>(method: Method, path: string, options: ForwardOptions = {}): Promise<T> {
    return this.forward<T>(this.userServiceUrl, method, path, options);
  }

  forwardToEventService<T>(method: Method, path: string, options: ForwardOptions = {}): Promise<T> {
    return this.forward<T>(this.eventServiceUrl, method, path, options);
  }

  forwardToBettingService<T>(
    method: Method,
    path: string,
    options: ForwardOptions = {},
  ): Promise<T> {
    return this.forward<T>(this.bettingServiceUrl, method, path, options);
  }

  private async forward<T>(
    baseUrl: string,
    method: Method,
    path: string,
    options: ForwardOptions,
  ): Promise<T> {
    const headers: Record<string, string> = { ...(options.headers ?? {}) };
    // N'imposer `content-type: application/json` que s'il y a un corps : sinon
    // Fastify rejette (400) un POST sans corps (ex. publish/close/cancel).
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (options.user) {
      headers['x-user-id'] = String(options.user.id);
      headers['x-user-role'] = options.user.role;
    }

    try {
      const response = await firstValueFrom(
        this.http.request<T>({
          method,
          url: `${baseUrl}${path}`,
          data: options.body,
          headers,
          // On accepte tous les statuts pour gérer nous-mêmes la propagation :
          // un 4xx métier en aval doit conserver son code HTTP et son
          // `errorCode` (et non être renvoyé comme un succès au client).
          validateStatus: () => true,
        }),
      );
      if (response.status >= 400) {
        this.throwDownstream(response.status, response.data);
      }
      return response.data;
    } catch (err) {
      // Erreur métier déjà formatée par throwDownstream : on la laisse passer.
      if (err instanceof HttpException) {
        throw err;
      }
      if (axios.isAxiosError(err) && err.response) {
        this.throwDownstream(err.response.status, err.response.data);
      }
      this.logger.error(`Relais vers ${baseUrl}${path} en échec`, err);
      throw new BetNextException(
        BetNextErrorCode.INTERNAL_ERROR,
        HttpStatus.BAD_GATEWAY,
        'Service interne indisponible.',
      );
    }
  }

  /** Re-projette une réponse d'erreur downstream en BetNextException. */
  private throwDownstream(status: number, raw: unknown): never {
    if (raw && typeof raw === 'object' && 'errorCode' in raw && 'message' in raw) {
      const r = raw as {
        errorCode: BetNextErrorCode;
        message: string;
        details?: Record<string, unknown>;
      };
      throw new BetNextException(r.errorCode, status, r.message, r.details);
    }
    throw new HttpException(raw ?? 'Downstream error', status);
  }
}
