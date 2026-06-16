import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';

export class TeamRankDto {
  @IsInt()
  @Min(1)
  eventTeamId!: number;

  @IsInt()
  @Min(1)
  rank!: number;
}

export class ResultFactsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  matchDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalKills?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  firstBloodEventTeamId?: number;
}

export class SetResultDto {
  /** Classement final des équipes engagées (rang 1 = vainqueur). */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamRankDto)
  ranking!: TeamRankDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ResultFactsDto)
  facts?: ResultFactsDto;
}
