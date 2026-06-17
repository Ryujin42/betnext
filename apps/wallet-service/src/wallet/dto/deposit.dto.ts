import { IsNumber, Max, Min } from 'class-validator';

/** Corps de `POST /wallet/deposit` (T6.3). Montant en euros, max 2 décimales. */
export class DepositDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000)
  amount!: number;
}
