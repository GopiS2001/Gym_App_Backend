import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DateRangeDto } from '../../common/dto/pagination.dto';

export enum MealTypeDto {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  SNACKS = 'SNACKS',
  PRE_WORKOUT = 'PRE_WORKOUT',
  POST_WORKOUT = 'POST_WORKOUT',
}

export class CreateFoodLogDto {
  @ApiProperty({ example: 'Grilled Chicken Salad' })
  @IsString()
  @MinLength(2, { message: 'Food name must be at least 2 characters' })
  @MaxLength(160)
  @Transform(({ value }) => value?.trim())
  foodName: string;

  @ApiProperty({ enum: MealTypeDto })
  @IsEnum(MealTypeDto, { message: 'Please choose a valid meal type' })
  mealType: MealTypeDto;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'Quantity must be greater than zero' })
  quantity?: number;

  @ApiPropertyOptional({ default: 'serving', example: 'g' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  quantityUnit?: string;

  @ApiProperty({ example: 550 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Calories must be a number' })
  @Min(0)
  calories: number;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  proteinG?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  carbsG?: number;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fatG?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'ISO date-time; defaults to now' })
  @IsOptional()
  @IsDateString()
  consumedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Idempotency key for offline sync' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientOpId?: string;
}

export class UpdateFoodLogDto extends CreateFoodLogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare foodName: string;

  @ApiPropertyOptional({ enum: MealTypeDto })
  @IsOptional()
  @IsEnum(MealTypeDto)
  declare mealType: MealTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declare calories: number;
}

export class QueryFoodLogsDto extends DateRangeDto {
  @ApiPropertyOptional({ enum: MealTypeDto })
  @IsOptional()
  @IsEnum(MealTypeDto)
  mealType?: MealTypeDto;

  @ApiPropertyOptional({ description: 'Single day (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Minimum calories' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minCalories?: number;

  @ApiPropertyOptional({ description: 'Maximum calories' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxCalories?: number;
}
