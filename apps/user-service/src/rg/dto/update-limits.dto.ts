import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Mise à jour partielle des limites RG (T7.2). Un champ omis = pas de
 * modification ; `null` explicite = retrait de la limite (toujours immédiat
 * car moins restrictif… non : *retirer* une limite revient à une hausse
 * **infinie** et passe donc en pending 48h elle aussi — géré côté service).
 */
export class UpdateRgLimitsDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  dailyBetLimit?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  weeklyBetLimit?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  dailyDepositLimit?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  weeklyDepositLimit?: number | null;
}
