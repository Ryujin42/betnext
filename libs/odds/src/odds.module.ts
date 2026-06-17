import { Module } from '@nestjs/common';
import { OddsRecalculationService } from './odds-recalculation.service';

/**
 * Fournit le moteur de cotes (T5.2). Le module hôte doit exposer une
 * `DataSource` (TypeOrmModule) et la `MessagingModule` (tokens EVENT_BUS /
 * DISTRIBUTED_LOCK). À l'init, le service s'abonne à `bet.placed`.
 */
@Module({
  providers: [OddsRecalculationService],
  exports: [OddsRecalculationService],
})
export class OddsModule {}
