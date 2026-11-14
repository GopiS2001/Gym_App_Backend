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
import { CreateSleepLogDto, QuerySleepDto, UpdateSleepLogDto } from './dto/sleep.dto';
import { SleepService } from './sleep.service';

@ApiTags('Sleep')
@Auth()
@Controller('sleep')
export class SleepController {
  constructor(private readonly sleepService: SleepService) {}

  @Post()
  @ApiOperation({ summary: 'Record a night of sleep' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateSleepLogDto) {
    const data = await this.sleepService.create(userId, dto);
    return { ...data, __message: 'Sleep recorded successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'Sleep history with quality and date filters' })
  async findAll(@CurrentUser('userId') userId: string, @Query() query: QuerySleepDto) {
    const data = await this.sleepService.findAll(userId, query);
    return { ...data, __message: 'Sleep history retrieved successfully' };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Sleep averages and nightly series' })
  async summary(@CurrentUser('userId') userId: string, @Query('days') days?: string) {
    const data = await this.sleepService.summary(userId, days ? parseInt(days, 10) : 7);
    return { ...data, __message: 'Sleep summary retrieved successfully' };
  }

  @Get('quality-options')
  @ApiOperation({ summary: 'List the sleep quality values' })
  qualityOptions() {
    return {
      items: this.sleepService.getQualityOptions(),
      __message: 'Sleep quality options retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one sleep entry' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.sleepService.findOne(userId, id);
    return { ...data, __message: 'Sleep entry retrieved successfully' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a sleep entry' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSleepLogDto,
  ) {
    const data = await this.sleepService.update(userId, id, dto);
    return { ...data, __message: 'Sleep entry updated successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a sleep entry' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.sleepService.remove(userId, id);
    return { ...data, __message: 'Sleep entry deleted successfully' };
  }
}
