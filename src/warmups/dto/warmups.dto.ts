import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: any }) => (typeof value === 'string' ? value.trim() : value);
/** '' and null both mean "no value", so a field can be cleared on update. */
const emptyToNull = ({ value }: { value: any }) => (value === '' ? null : value);

export class CreateWarmupDto {
  @ApiProperty({ example: 'Arm circles' })
  @IsString()
  @MinLength(2, { message: 'Warm-up name must be at least 2 characters' })
  @MaxLength(140)
  @Transform(trim)
  name: string;

  @ApiPropertyOptional({ description: 'Workout category; leave empty for a general warm-up' })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsUUID('all', { message: 'Choose a valid category' })
  categoryId?: string | null;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt({ message: 'Duration must be a whole number of seconds' })
  @Min(1)
  durationSeconds?: number | null;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt({ message: 'Reps must be a whole number' })
  @Min(1)
  reps?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(trim)
  description?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Gallery images, in display order' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'A warm-up can have at most 10 images' })
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({ description: 'Banner image. Empty string clears it.' })
  @IsOptional()
  @IsString()
  backgroundImageUrl?: string;

  @ApiPropertyOptional({ description: 'A video link or the URL of an uploaded video. Empty string clears it.' })
  @IsOptional()
  @IsString()
  videoUrl?: string;
}

export class UpdateWarmupDto extends PartialType(CreateWarmupDto) {}

export class QueryWarmupsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "A category id, or 'none' for general warm-ups only",
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
