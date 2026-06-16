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

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.userServiceUrl = config.get<string>('USER_SERVICE_URL') ?? 'http://localhost:3001';
  }

  forwardToUserService<T>(method: Method, path: string, options: ForwardOptions = {}): Promise<T> {
    return this.forward<T>(this.userServiceUrl, method, path, options);
  }

  private async forward<T>(
    baseUrl: string,
    method: Method,
    path: string,
    options: ForwardOptions,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    };
    if (options.user) {
      headers['x-user-id'] = String(options.user.id);
      headers['x-user-role'] = options.user.role;
    }

    try {
      const { data } = await firstValueFrom(
        this.http.request<T>({
          method,
          url: `${baseUrl}${path}`,
          data: options.body,
          headers,
          // Le gateway gère son propre filtre — qu'axios remonte tout.
          validateStatus: (status) => status < 500,
        }),
      );
      return data;
    } catch (err) {
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

    // Si validateStatus a laissé passer un 4xx, axios ne throw pas → on
    // gère ici les erreurs métier que le service a déjà formatées.
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
