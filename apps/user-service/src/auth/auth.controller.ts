import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { IUser } from '@betnext/shared-types';
import type { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register.dto';

/**
 * Routes d'authentification exposées sur le user-service (port interne).
 * Le client passe par l'api-gateway, qui relaie ces routes en public.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** T2.2 — Inscription ARJEL (≥ 18 ans, CGU, Argon2id). */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<IUser> {
    return this.authService.register(dto);
  }
}
