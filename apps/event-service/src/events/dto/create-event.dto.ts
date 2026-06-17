import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsInt()
  @Min(1)
  tournamentId!: number;

  @IsInt()
  @Min(1)
  gameId!: number;

  /** Au moins 2 équipes engagées (table pivot `event_teams`). */
  @IsArray()
  @ArrayMinSize(2)
  @IsInt({ each: true })
  teamIds!: number[];
}
