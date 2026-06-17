import { IsNumber, Max, Min } from 'class-validator';

/** Corps de `POST /wallet/withdraw` (T6.3). Montant en euros, max 2 décimales. */
export class WithdrawDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000)
  amount!: number;
}
