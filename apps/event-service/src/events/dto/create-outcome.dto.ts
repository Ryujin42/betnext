import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateOutcomeDto {
  @IsString()
  @MaxLength(200)
  label!: string;

  /** Cote initiale, bornée [1.10 – 5.00] (cf. §6). */
  @IsNumber()
  @Min(1.1)
  @Max(5)
  odds!: number;

  /**
   * Type de pari (union discriminée `OutcomeCondition`). Validé finement
   * dans le service via `isValidOutcomeCondition` (la structure dépend du
   * discriminant `type`). `@IsObject` le conserve face à la ValidationPipe.
   */
  @IsObject()
  condition!: Record<string, unknown>;

  /** event_team visé (issue liée à une équipe) ou null (issue transverse). */
  @IsOptional()
  @IsInt()
  @Min(1)
  eventPlayerId?: number;
}
