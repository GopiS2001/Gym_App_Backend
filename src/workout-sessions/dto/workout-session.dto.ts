import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { DateRangeDto } from '../../common/dto/pagination.dto';

export enum SessionStatusDto {
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class StartSessionDto {
  @ApiPropertyOptional({ description: 'Start from a plan; omit for a free workout' })
  @IsOptional()
  @IsUUID('4')
  workoutPlanId?: string;

  @ApiPropertyOptional({ description: 'Weekday of the plan to load, e.g. MONDAY' })
  @IsOptional()
  @IsString()
  scheduledDay?: string;

  @ApiPropertyOptional({ example: 'Chest + Triceps' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ example: '2026-11-12' })
  @IsOptional()
  @IsDateString()
  sessionDate?: string;

  @ApiPropertyOptional({ type: [String], description: 'Exercise ids for a free workout' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  exerciseIds?: string[];

  @ApiPropertyOptional({ description: 'Idempotency key for offline sync' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientOpId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddSessionExerciseDto {
  @ApiProperty()
  @IsUUID('4', { message: 'Please choose a valid exercise' })
  exerciseId: string;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetSets?: number;

  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetReps?: number;

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

export class RecordSetDto {
  @ApiProperty()
  @IsUUID('4', { message: 'A valid session exercise is required' })
  sessionExerciseId: string;

  @ApiPropertyOptional({ description: 'Omit to append the next set number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  setNumber?: number;

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt({ message: 'Reps must be a whole number' })
  @Min(0)
  reps: number;

  @ApiProperty({ example: 40 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Weight must be a number' })
  @Min(0)
  weightKg: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  restSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class UpdateSetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  restSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class CompleteSessionDto {
  @ApiPropertyOptional({ description: 'Elapsed seconds measured by the client' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: SessionStatusDto })
  @IsOptional()
  @IsEnum(SessionStatusDto)
  status?: SessionStatusDto;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}

export class QuerySessionsDto extends DateRangeDto {
  @ApiPropertyOptional({ enum: SessionStatusDto })
  @IsOptional()
  @IsEnum(SessionStatusDto)
  status?: SessionStatusDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  workoutPlanId?: string;

  @ApiPropertyOptional({ description: 'Filter to sessions containing this exercise' })
  @IsOptional()
  @IsUUID('4')
  exerciseId?: string;
}

export class ReorderSessionExercisesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
