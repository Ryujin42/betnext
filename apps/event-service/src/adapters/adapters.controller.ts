import { Controller, Get, Param } from '@nestjs/common';
import type { IExternalEvent } from '@betnext/shared-types';
import { GameAdapterRegistry } from './game-adapter.registry';

/**
 * Endpoint de diagnostic (lecture seule, données mockées, sans BDD) qui
 * démontre la découverte des adaptateurs via injection.
 */
@Controller('adapters')
export class AdaptersController {
  constructor(private readonly registry: GameAdapterRegistry) {}

  @Get()
  list(): { types: string[] } {
    return { types: this.registry.getTypes() };
  }

  @Get(':type/live')
  live(@Param('type') type: string): Promise<IExternalEvent[]> {
    return this.registry.getAdapter(type).fetchLiveEvents();
  }
}
