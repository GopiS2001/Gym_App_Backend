import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DateRangeDto } from '../../common/dto/pagination.dto';

export class CreateWaterLogDto {
  @ApiProperty({ example: 250, description: 'Amount in millilitres' })
  @Type(() => Number)
  @IsInt({ message: 'Amount must be a whole number of millilitres' })
  @Min(1, { message: 'Amount must be greater than zero' })
  @Max(5000, { message: 'A single entry cannot exceed 5000 ml' })
  amountMl: number;

  @ApiPropertyOptional({ description: 'ISO date-time; defaults to now' })
  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @ApiPropertyOptional({ description: 'Idempotency key for offline sync' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientOpId?: string;
}

export class UpdateWaterLogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  amountMl?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}

export class QueryWaterDto extends DateRangeDto {
  @ApiPropertyOptional({ description: 'Single day (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
