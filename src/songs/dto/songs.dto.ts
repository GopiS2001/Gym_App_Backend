import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: any }) => (typeof value === 'string' ? value.trim() : value);

export class CreateSongDto {
  @ApiProperty({ example: 'Rocky' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Enter the movie title' })
  @MaxLength(160)
  movieTitle: string;

  @ApiProperty({ example: 'Gonna Fly Now' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Enter the song name' })
  @MaxLength(160)
  songName: string;

  @ApiPropertyOptional({ description: 'Cover image URL; empty string or null clears it' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  imageUrl?: string | null;
}

export class UpdateSongDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Enter the movie title' })
  @MaxLength(160)
  movieTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Enter the song name' })
  @MaxLength(160)
  songName?: string;

  @ApiPropertyOptional({ description: 'Cover image URL; empty string or null clears it' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  imageUrl?: string | null;
}

export class QuerySongsDto extends PaginationDto {}
