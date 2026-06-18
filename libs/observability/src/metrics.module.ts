import { type DynamicModule, Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { BetNextMetrics } from './metrics.service';

export interface MetricsModuleOptions {
  /** Nom du service, appliqué en label `service` à toutes les séries. */
  service: string;
}

/**
 * Module de monitoring partagé (T11.2). `MetricsModule.forRoot({ service })`
 * instancie un {@link BetNextMetrics} dédié au service, expose `GET /metrics`
 * et le rend injectable partout (`@Global`) pour incrémenter les compteurs
 * métier depuis n'importe quel provider (y compris les libs comme `@betnext/odds`).
 */
@Global()
@Module({})
export class MetricsModule {
  static forRoot(options: MetricsModuleOptions): DynamicModule {
    const metrics = new BetNextMetrics(options.service);
    return {
      module: MetricsModule,
      global: true,
      controllers: [MetricsController],
      providers: [{ provide: BetNextMetrics, useValue: metrics }],
      exports: [BetNextMetrics],
    };
  }
}
