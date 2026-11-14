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

export class CreateGoalTypeDto {
  @ApiProperty({ example: 'Powerlifting Peak' })
  @IsString()
  @MinLength(2, { message: 'Goal type name must be at least 2 characters' })
  @MaxLength(80)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'barbell' })
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

export class UpdateGoalTypeDto extends CreateGoalTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class QueryGoalTypesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Only custom goal types' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isCustom?: boolean;

  @ApiPropertyOptional({ description: 'Include archived types' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;
}
