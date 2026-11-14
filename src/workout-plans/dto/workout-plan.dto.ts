import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { DifficultyLevelDto } from '../../exercises/dto/exercise.dto';

export enum WeekDayDto {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export enum PlanStatusDto {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DRAFT = 'DRAFT',
}

export class PlanExerciseDto {
  @ApiPropertyOptional({ description: 'Existing row id when updating' })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty()
  @IsUUID('4', { message: 'Please choose a valid exercise' })
  exerciseId: string;

  @ApiProperty({ enum: WeekDayDto })
  @IsEnum(WeekDayDto, { message: 'Please choose a valid day of the week' })
  scheduledDay: WeekDayDto;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'A set count of at least 1 is required' })
  targetSets?: number;

  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'A rep count of at least 1 is required' })
  targetReps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetWeightKg?: number;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  restSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateWorkoutPlanDto {
  @ApiProperty({ example: 'Push Pull Legs' })
  @IsString()
  @MinLength(2, { message: 'Plan name must be at least 2 characters' })
  @MaxLength(140)
  @Transform(({ value }) => value?.trim())
  planName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: PlanStatusDto })
  @IsOptional()
  @IsEnum(PlanStatusDto)
  status?: PlanStatusDto;

  @ApiPropertyOptional({ enum: DifficultyLevelDto })
  @IsOptional()
  @IsEnum(DifficultyLevelDto)
  difficultyLevel?: DifficultyLevelDto;

  @ApiPropertyOptional({ type: [PlanExerciseDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanExerciseDto)
  exercises?: PlanExerciseDto[];
}

export class UpdateWorkoutPlanDto extends CreateWorkoutPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare planName: string;
}

export class QueryWorkoutPlansDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PlanStatusDto })
  @IsOptional()
  @IsEnum(PlanStatusDto)
  status?: PlanStatusDto;

  @ApiPropertyOptional({ enum: DifficultyLevelDto })
  @IsOptional()
  @IsEnum(DifficultyLevelDto)
  difficultyLevel?: DifficultyLevelDto;
}

export class ReorderPlanExercisesDto {
  @ApiProperty({ type: [String], description: 'Plan-exercise ids in display order' })
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
