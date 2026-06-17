import { Controller, Get } from '@nestjs/common';

/** Sonde de vivacité de l'odds-engine. */
@Controller('health')
export class HealthController {
  @Get()
  health(): { status: 'ok'; service: 'odds-engine' } {
    return { status: 'ok', service: 'odds-engine' };
  }
}
