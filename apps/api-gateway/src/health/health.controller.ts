import { Controller, Get } from '@nestjs/common';
import { Role, type IUser } from '@betnext/shared-types';

@Controller()
export class HealthController {
  /** DoD T1.4 : sonde de vie. */
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * Endpoint de diagnostic qui consomme les types partagés
   * (`@betnext/shared-types`) — prouve l'import inter-paquets côté service
   * (DoD T1.2 : `IUser` importé et utilisé, compile).
   */
  @Get('meta')
  meta(): { service: string; roles: Role[]; userShape: (keyof IUser)[] } {
    const userShape: (keyof IUser)[] = ['id', 'name', 'email', 'roles', 'birthDate', 'createdAt'];
    return { service: 'api-gateway', roles: Object.values(Role), userShape };
  }
}
