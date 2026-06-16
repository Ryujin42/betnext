import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { type IAccessTokenPayload, Role } from '@betnext/shared-types';

export interface AuthenticatedUser {
  id: number;
  role: Role;
}

/**
 * Stratégie Passport JWT — vérifie la signature de l'access token sur
 * chaque requête protégée. Le payload validé est attaché à `req.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  validate(payload: IAccessTokenPayload): AuthenticatedUser {
    return { id: payload.sub, role: payload.role as Role };
  }
}
