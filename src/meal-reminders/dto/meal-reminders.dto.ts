import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const WEEK_DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;
export type WeekDayName = (typeof WEEK_DAYS)[number];

export enum ReminderTypeDto {
  PRE_WORKOUT = 'PRE_WORKOUT',
  BREAKFAST = 'BREAKFAST',
  POST_WORKOUT = 'POST_WORKOUT',
  LUNCH = 'LUNCH',
  SNACK = 'SNACK',
  DINNER = 'DINNER',
  BEFORE_BED = 'BEFORE_BED',
  WATER = 'WATER',
  CUSTOM = 'CUSTOM',
}

export enum WorkoutLinkDto {
  NONE = 'NONE',
  BEFORE = 'BEFORE',
  AFTER = 'AFTER',
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_MESSAGE = 'Time must be HH:mm in 24-hour format, e.g. 07:30';
const trim = ({ value }: { value: any }) => (typeof value === 'string' ? value.trim() : value);

export class CreateMealReminderDto {
  @ApiProperty({ example: 'Breakfast' })
  @IsString()
  @MinLength(1, { message: 'Give the reminder a title' })
  @MaxLength(80)
  @Transform(trim)
  title: string;

  @ApiProperty({ enum: ReminderTypeDto })
  @IsEnum(ReminderTypeDto, { message: 'Please choose a valid reminder type' })
  reminderType: ReminderTypeDto;

  @ApiProperty({ example: '07:30', description: 'Local time, 24-hour HH:mm' })
  @Matches(TIME_PATTERN, { message: TIME_MESSAGE })
  reminderTime: string;

  @ApiPropertyOptional({
    example: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    description: 'Days to repeat on; empty or omitted means every day',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(WEEK_DAYS as unknown as string[], { each: true, message: 'Invalid repeat day' })
  repeatDays?: WeekDayName[];

  @ApiPropertyOptional({ example: 'Breakfast time. Remember to log your meal.' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  @Transform(trim)
  message?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    enum: WorkoutLinkDto,
    description: 'BEFORE / AFTER follow the workout schedule instead of the time above',
  })
  @IsOptional()
  @IsEnum(WorkoutLinkDto)
  workoutLink?: WorkoutLinkDto;

  @ApiPropertyOptional({ default: 10, description: 'Snooze length in minutes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  snoozeMinutes?: number;
}

export class UpdateMealReminderDto extends PartialType(CreateMealReminderDto) {}

export class ToggleMealReminderDto {
  @ApiPropertyOptional({ description: 'Omit to flip the current state' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateWorkoutScheduleDto {
  @ApiPropertyOptional({ example: '18:00', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.workoutTime !== null)
  @Matches(TIME_PATTERN, { message: TIME_MESSAGE })
  workoutTime?: string | null;

  @ApiPropertyOptional({
    example: ['MONDAY', 'TUESDAY', 'THURSDAY', 'FRIDAY'],
    nullable: true,
    description: 'null = use the days of the active workout plan',
  })
  @IsOptional()
  @ValidateIf((o) => o.workoutDays !== null)
  @IsArray()
  @ArrayUnique()
  @IsIn(WEEK_DAYS as unknown as string[], { each: true, message: 'Invalid workout day' })
  workoutDays?: WeekDayName[] | null;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(300)
  workoutDurationMin?: number;

  @ApiPropertyOptional({ example: 60, description: 'Minutes before the workout' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  preWorkoutLeadMin?: number;

  @ApiPropertyOptional({ example: 30, description: 'Minutes after the workout ends' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  postWorkoutDelayMin?: number;
}
