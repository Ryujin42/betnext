import { IsInt, Max, Min } from 'class-validator';

/**
 * Auto-exclusion (T7.2). Durée minimum 7 jours (ARJEL recommande 24h mais on
 * fixe une valeur plus sûre en école), maximum 365 jours. Non annulable
 * avant la fin.
 */
export class SelfExcludeDto {
  @IsInt()
  @Min(7)
  @Max(365)
  durationDays!: number;
}
