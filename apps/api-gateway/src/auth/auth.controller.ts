import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { IAuthTokens, IUser } from '@betnext/shared-types';
import { RelayService } from '../proxy/relay.service';

/**
 * Routes publiques d'authentification — relayées vers le user-service.
 * Aucun guard JWT ici : ce sont les endpoints qui PRODUISENT les tokens.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly relay: RelayService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() body: unknown, @Req() req: FastifyRequest): Promise<IUser> {
    return this.relay.forwardToUserService('POST', '/auth/register', {
      body,
      headers: AuthController.contextHeaders(req),
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: unknown, @Req() req: FastifyRequest): Promise<IAuthTokens> {
    return this.relay.forwardToUserService('POST', '/auth/login', {
      body,
      headers: AuthController.contextHeaders(req),
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: unknown, @Req() req: FastifyRequest): Promise<IAuthTokens> {
    return this.relay.forwardToUserService('POST', '/auth/refresh', {
      body,
      headers: AuthController.contextHeaders(req),
    });
  }

  /** Re-transmet ip / user-agent pour que les sessions soient horodatées correctement côté user-service. */
  private static contextHeaders(req: FastifyRequest): Record<string, string> {
    const ua = req.headers['user-agent'];
    const out: Record<string, string> = {};
    if (typeof ua === 'string') out['user-agent'] = ua;
    const ip = (req.headers['x-forwarded-for'] as string | undefined) ?? req.ip ?? null;
    if (ip) out['x-forwarded-for'] = String(ip);
    const device = req.headers['x-device'];
    if (typeof device === 'string') out['x-device'] = device;
    return out;
  }
}
