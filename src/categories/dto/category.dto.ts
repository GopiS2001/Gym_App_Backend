import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Chest' })
  @IsString()
  @MinLength(2, { message: 'Category name must be at least 2 characters' })
  @MaxLength(80)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'dumbbell' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  iconName?: string;

  @ApiPropertyOptional({ example: '#34D399' })
  @IsOptional()
  @IsString()
  @MaxLength(9)
  colorHex?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;
}

export class UpdateCategoryDto extends CreateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare name: string;
}

export class QueryCategoriesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Only return custom categories' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isCustom?: boolean;

  @ApiPropertyOptional({ description: 'Include the exercise count per category' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  withCounts?: boolean;
}
