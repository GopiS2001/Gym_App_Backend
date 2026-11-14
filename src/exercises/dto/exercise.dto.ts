import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum DifficultyLevelDto {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

export class CreateExerciseDto {
  @ApiProperty({ example: 'Barbell Bench Press' })
  @IsString()
  @MinLength(2, { message: 'Exercise name must be at least 2 characters' })
  @MaxLength(140)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty()
  @IsUUID('4', { message: 'Please choose a valid category' })
  categoryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ example: 'Pectoralis Major' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetMuscle?: string;

  @ApiPropertyOptional({ type: [String], example: ['Triceps', 'Front Delts'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secondaryMuscles?: string[];

  @ApiPropertyOptional({ example: 'Barbell' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  equipment?: string;

  @ApiPropertyOptional({ enum: DifficultyLevelDto })
  @IsOptional()
  @IsEnum(DifficultyLevelDto)
  difficultyLevel?: DifficultyLevelDto;

  @ApiPropertyOptional({ description: 'Cover image. Defaults to the first of imageUrls.' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ type: [String], description: 'Gallery images, in display order' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'An exercise can have at most 10 images' })
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({
    description: 'Banner image behind the title. Empty string clears it.',
  })
  @IsOptional()
  @IsString()
  backgroundImageUrl?: string;

  @ApiPropertyOptional({ description: 'A video link or the URL of an uploaded video' })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({ example: 8.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  caloriesPerMin?: number;
}

export class UpdateExerciseDto extends CreateExerciseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  declare categoryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class QueryExercisesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by category id' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by category slug, e.g. "chest"' })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({ enum: DifficultyLevelDto })
  @IsOptional()
  @IsEnum(DifficultyLevelDto)
  difficultyLevel?: DifficultyLevelDto;

  @ApiPropertyOptional({ example: 'Barbell' })
  @IsOptional()
  @IsString()
  equipment?: string;

  @ApiPropertyOptional({ example: 'Chest' })
  @IsOptional()
  @IsString()
  targetMuscle?: string;

  @ApiPropertyOptional({ description: 'Only custom exercises' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isCustom?: boolean;

  @ApiPropertyOptional({ description: 'Only favourites' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  favouritesOnly?: boolean;
}
