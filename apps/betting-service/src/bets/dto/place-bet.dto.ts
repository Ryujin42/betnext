import { IsInt, IsNumber, IsPositive, Max, Min } from 'class-validator';

/** Corps de `POST /bets` (T5.1). Montant en euros, max 2 décimales côté métier. */
export class PlaceBetDto {
  @IsInt()
  @IsPositive()
  outcomeId!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000)
  amount!: number;
}
