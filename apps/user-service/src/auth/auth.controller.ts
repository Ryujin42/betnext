import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { IAuthTokens, IUser } from '@betnext/shared-types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import type { SessionContext } from './tokens.service';

/**
 * Routes d'authentification exposées sur le user-service (port interne).
 * Le client passe par l'api-gateway, qui relaie ces routes publiquement.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<IUser> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: FastifyRequest): Promise<IAuthTokens> {
    return this.authService.login(dto, AuthController.extractContext(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto, @Req() req: FastifyRequest): Promise<IAuthTokens> {
    return this.authService.refresh(dto.refreshToken, AuthController.extractContext(req));
  }

  /** Capture ip / user-agent / device pour la traçabilité des sessions. */
  private static extractContext(req: FastifyRequest): SessionContext {
    const ua = req.headers['user-agent'];
    const device = req.headers['x-device'];
    const xff = req.headers['x-forwarded-for'];
    const ip =
      (typeof xff === 'string' ? xff.split(',')[0]?.trim() : Array.isArray(xff) ? xff[0] : null) ??
      req.ip ??
      null;
    return {
      ip: ip ? ip.slice(0, 64) : null,
      userAgent: typeof ua === 'string' ? ua.slice(0, 512) : null,
      device: typeof device === 'string' ? device.slice(0, 128) : null,
    };
  }
}
