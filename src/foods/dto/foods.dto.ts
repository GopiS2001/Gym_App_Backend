import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: any }) => (typeof value === 'string' ? value.trim() : value);

export class CreateFoodDto {
  @ApiProperty({ example: 'Boiled Egg' })
  @IsString()
  @MinLength(2, { message: 'Food name must be at least 2 characters' })
  @MaxLength(160)
  @Transform(trim)
  name: string;

  @ApiPropertyOptional({ example: 'Protein' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trim)
  category?: string;

  @ApiPropertyOptional({ example: 1, description: 'Base serving the values below are for' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Serving size must be a number' })
  @Min(0.01, { message: 'Serving size must be greater than zero' })
  servingSize?: number;

  @ApiPropertyOptional({ example: 'piece' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Transform(trim)
  servingUnit?: string;

  @ApiProperty({ example: 70 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Calories must be a number' })
  @Min(0)
  calories: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  proteinG?: number;

  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  carbsG?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fatG?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fibreG?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFoodDto extends PartialType(CreateFoodDto) {}

export class QueryFoodsDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'Protein' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Include foods that were removed from the library' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}
