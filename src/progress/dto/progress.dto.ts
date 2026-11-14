import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { DateRangeDto } from '../../common/dto/pagination.dto';

export class CreateWeightLogDto {
  @ApiProperty({ example: 72.4 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Weight must be a number' })
  @Min(20, { message: 'Weight must be at least 20 kg' })
  @Max(500, { message: 'Weight must be under 500 kg' })
  weightKg: number;

  @ApiPropertyOptional({ example: '2026-11-12' })
  @IsOptional()
  @IsDateString()
  recordedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateWeightLogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(500)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  recordedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateMeasurementDto {
  @ApiPropertyOptional({ example: '2026-11-12' })
  @IsOptional()
  @IsDateString()
  recordedDate?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(500)
  chestCm?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(500)
  waistCm?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(500)
  hipsCm?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(500)
  leftArmCm?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(500)
  rightArmCm?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(500)
  leftThighCm?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(500)
  rightThighCm?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(500)
  leftCalfCm?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(500)
  rightCalfCm?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(500)
  neckCm?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(500)
  shouldersCm?: number;

  @ApiPropertyOptional({ example: 18.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(70)
  bodyFatPercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMeasurementDto extends CreateMeasurementDto {}

export enum PhotoTypeDto {
  FRONT = 'FRONT',
  SIDE = 'SIDE',
  BACK = 'BACK',
  OTHER = 'OTHER',
}

export class CreateProgressPhotoDto {
  @ApiProperty({ description: 'URL returned by the media upload endpoint' })
  @IsString()
  photoUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  mediaAssetId?: string;

  @ApiPropertyOptional({ enum: PhotoTypeDto, default: PhotoTypeDto.FRONT })
  @IsOptional()
  @IsEnum(PhotoTypeDto)
  photoType?: PhotoTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  capturedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateProgressPhotoDto {
  @ApiPropertyOptional({ enum: PhotoTypeDto })
  @IsOptional()
  @IsEnum(PhotoTypeDto)
  photoType?: PhotoTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  capturedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryProgressDto extends DateRangeDto {}

export class QueryPhotosDto extends DateRangeDto {
  @ApiPropertyOptional({ enum: PhotoTypeDto })
  @IsOptional()
  @IsEnum(PhotoTypeDto)
  photoType?: PhotoTypeDto;
}

export class ComparePhotosDto {
  @ApiProperty()
  @IsUUID('4')
  firstPhotoId: string;

  @ApiProperty()
  @IsUUID('4')
  secondPhotoId: string;
}
