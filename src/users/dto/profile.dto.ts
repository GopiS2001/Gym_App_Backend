import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum GenderDto {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  UNSPECIFIED = 'UNSPECIFIED',
}

export enum ExperienceLevelDto {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  ATHLETE = 'ATHLETE',
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Gopi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  fullName?: string;

  @ApiPropertyOptional({ example: '1998-06-15' })
  @IsOptional()
  @IsDateString({}, { message: 'Date of birth must be a valid date' })
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: GenderDto })
  @IsOptional()
  @IsEnum(GenderDto)
  gender?: GenderDto;

  @ApiPropertyOptional({ example: 175.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Height must be a number' })
  @Min(50, { message: 'Height must be at least 50 cm' })
  @Max(300, { message: 'Height must be under 300 cm' })
  heightCm?: number;

  @ApiPropertyOptional({ example: 72.4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(500)
  currentWeightKg?: number;

  @ApiPropertyOptional({ example: '2024-01-10' })
  @IsOptional()
  @IsDateString()
  gymJoiningDate?: string;

  @ApiPropertyOptional({ enum: ExperienceLevelDto })
  @IsOptional()
  @IsEnum(ExperienceLevelDto)
  experienceLevel?: ExperienceLevelDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;
}
