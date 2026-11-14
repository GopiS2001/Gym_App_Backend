import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum ThemePreferenceDto {
  SYSTEM = 'SYSTEM',
  LIGHT = 'LIGHT',
  DARK = 'DARK',
}

export enum WeightUnitDto {
  KG = 'KG',
  LB = 'LB',
}

export enum HeightUnitDto {
  CM = 'CM',
  FT = 'FT',
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: ThemePreferenceDto })
  @IsOptional()
  @IsEnum(ThemePreferenceDto)
  theme?: ThemePreferenceDto;

  @ApiPropertyOptional({ enum: WeightUnitDto })
  @IsOptional()
  @IsEnum(WeightUnitDto)
  weightUnit?: WeightUnitDto;

  @ApiPropertyOptional({ enum: HeightUnitDto })
  @IsOptional()
  @IsEnum(HeightUnitDto)
  heightUnit?: HeightUnitDto;

  @ApiPropertyOptional({ example: 3000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500, { message: 'Daily water target must be at least 500 ml' })
  @Max(10000)
  dailyWaterTargetMl?: number;

  @ApiPropertyOptional({ example: 2200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(800)
  @Max(10000)
  dailyCalorieTarget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  dailyProteinTargetG?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  dailyCarbsTargetG?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(400)
  dailyFatTargetG?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  weeklyWorkoutTarget?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600)
  defaultRestSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  notificationEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  workoutReminderEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  waterReminderEnabled?: boolean;
}
