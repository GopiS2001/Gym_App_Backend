import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateSongDto, QuerySongsDto, UpdateSongDto } from './dto/songs.dto';
import { SongsService } from './songs.service';

@ApiTags('Music')
@Auth()
@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a song' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateSongDto) {
    const data = await this.songsService.create(userId, dto);
    return { ...data, __message: 'Song added successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'List songs with search and pagination' })
  async findAll(@CurrentUser('userId') userId: string, @Query() query: QuerySongsDto) {
    const data = await this.songsService.findAll(userId, query);
    return { ...data, __message: 'Songs retrieved successfully' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one song' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.songsService.findOne(userId, id);
    return { ...data, __message: 'Song retrieved successfully' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a song' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSongDto,
  ) {
    const data = await this.songsService.update(userId, id, dto);
    return { ...data, __message: 'Song updated successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a song' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.songsService.remove(userId, id);
    return { ...data, __message: 'Song deleted successfully' };
  }
}
