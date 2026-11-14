import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum GoalStatusDto {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
  ABANDONED = 'ABANDONED',
}

export class CreateGoalDto {
  @ApiProperty({ description: 'Goal type id from GET /goal-types' })
  @IsUUID('4', { message: 'Please choose a goal type' })
  goalTypeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ example: 72 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  startingWeightKg?: number;

  @ApiPropertyOptional({ example: 78 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  targetWeightKg?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  targetBodyFatPercentage?: number;

  @ApiProperty({ example: '2026-11-12' })
  @IsDateString({}, { message: 'Start date must be a valid date' })
  startDate: string;

  @ApiPropertyOptional({ example: '2027-02-12' })
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiPropertyOptional({ enum: GoalStatusDto })
  @IsOptional()
  @IsEnum(GoalStatusDto)
  status?: GoalStatusDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateGoalDto extends CreateGoalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  declare goalTypeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  declare startDate: string;
}

export class QueryGoalsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: GoalStatusDto })
  @IsOptional()
  @IsEnum(GoalStatusDto)
  status?: GoalStatusDto;

  @ApiPropertyOptional({ description: 'Filter by goal type id' })
  @IsOptional()
  @IsUUID('4')
  goalTypeId?: string;
}
