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
import { CreateWarmupDto, QueryWarmupsDto, UpdateWarmupDto } from './dto/warmups.dto';
import { WarmupsService } from './warmups.service';

@ApiTags('Warm-ups')
@Auth()
@Controller('warmups')
export class WarmupsController {
  constructor(private readonly warmupsService: WarmupsService) {}

  @Get()
  @ApiOperation({ summary: 'List warm-ups, optionally for one category' })
  async findAll(@CurrentUser('userId') userId: string, @Query() query: QueryWarmupsDto) {
    const data = await this.warmupsService.findAll(userId, query);
    return { ...data, __message: 'Warm-ups retrieved successfully' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one warm-up' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.warmupsService.findOne(userId, id);
    return { ...data, __message: 'Warm-up retrieved successfully' };
  }

  @Post()
  @ApiOperation({ summary: 'Add a warm-up (category optional)' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateWarmupDto) {
    const data = await this.warmupsService.create(userId, dto);
    return { ...data, __message: 'Warm-up added' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a warm-up' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarmupDto,
  ) {
    const data = await this.warmupsService.update(userId, id, dto);
    return { ...data, __message: 'Warm-up updated' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a warm-up' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.warmupsService.remove(userId, id);
    return { ...data, __message: 'Warm-up deleted' };
  }
}
