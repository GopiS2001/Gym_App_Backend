import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DateRangeDto } from '../../common/dto/pagination.dto';

export enum SleepQualityDto {
  POOR = 'POOR',
  FAIR = 'FAIR',
  GOOD = 'GOOD',
  EXCELLENT = 'EXCELLENT',
}

export class CreateSleepLogDto {
  @ApiProperty({ example: '2026-11-11T23:00:00.000Z' })
  @IsDateString({}, { message: 'Sleep start must be a valid date-time' })
  sleepStart: string;

  @ApiProperty({ example: '2026-11-12T07:00:00.000Z' })
  @IsDateString({}, { message: 'Wake-up time must be a valid date-time' })
  sleepEnd: string;

  @ApiPropertyOptional({ enum: SleepQualityDto })
  @IsOptional()
  @IsEnum(SleepQualityDto)
  sleepQuality?: SleepQualityDto;

  @ApiPropertyOptional({ description: 'Defaults to the wake-up date' })
  @IsOptional()
  @IsDateString()
  loggedDate?: string;

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

export class UpdateSleepLogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  sleepStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  sleepEnd?: string;

  @ApiPropertyOptional({ enum: SleepQualityDto })
  @IsOptional()
  @IsEnum(SleepQualityDto)
  sleepQuality?: SleepQualityDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  loggedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class QuerySleepDto extends DateRangeDto {
  @ApiPropertyOptional({ enum: SleepQualityDto })
  @IsOptional()
  @IsEnum(SleepQualityDto)
  sleepQuality?: SleepQualityDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;
}
