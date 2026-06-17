import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BetEntity } from '@betnext/database';
import { BasicResponsibleGamingService } from './responsible-gaming.service';
import { RESPONSIBLE_GAMING } from './responsible-gaming.interface';

/**
 * Fournit le contrôle jeu responsable (Lot 5) sous le token
 * {@link RESPONSIBLE_GAMING}. Au Lot 7 (T7.2), remplacer par l'implémentation
 * complète (limites par user, auto-exclusion) côté user-service.
 */
@Module({
  imports: [TypeOrmModule.forFeature([BetEntity])],
  providers: [{ provide: RESPONSIBLE_GAMING, useClass: BasicResponsibleGamingService }],
  exports: [RESPONSIBLE_GAMING],
})
export class ResponsibleGamingModule {}
