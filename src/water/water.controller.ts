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
import { CreateWaterLogDto, QueryWaterDto, UpdateWaterLogDto } from './dto/water.dto';
import { WaterService } from './water.service';

@ApiTags('Water')
@Auth()
@Controller('water')
export class WaterController {
  constructor(private readonly waterService: WaterService) {}

  @Post()
  @ApiOperation({ summary: 'Add a water intake entry' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateWaterLogDto) {
    const data = await this.waterService.create(userId, dto);
    return { ...data, __message: 'Water intake recorded successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'List water entries with date filters' })
  async findAll(@CurrentUser('userId') userId: string, @Query() query: QueryWaterDto) {
    const data = await this.waterService.findAll(userId, query);
    return { ...data, __message: 'Water entries retrieved successfully' };
  }

  @Get('daily')
  @ApiOperation({ summary: 'Daily water total and target progress' })
  async daily(@CurrentUser('userId') userId: string, @Query('date') date?: string) {
    const data = await this.waterService.dailySummary(userId, date);
    return { ...data, __message: 'Daily water intake retrieved successfully' };
  }

  @Get('history')
  @ApiOperation({ summary: 'Daily water totals over a range' })
  async history(@CurrentUser('userId') userId: string, @Query('days') days?: string) {
    const data = await this.waterService.history(userId, days ? parseInt(days, 10) : 7);
    return { ...data, __message: 'Water history retrieved successfully' };
  }

  @Delete('undo')
  @ApiOperation({ summary: 'Remove the most recent entry of a day' })
  async undo(@CurrentUser('userId') userId: string, @Query('date') date?: string) {
    const data = await this.waterService.removeLast(userId, date);
    return { ...data, __message: 'Last water entry removed' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a water entry' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWaterLogDto,
  ) {
    const data = await this.waterService.update(userId, id, dto);
    return { ...data, __message: 'Water entry updated successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a water entry' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.waterService.remove(userId, id);
    return { ...data, __message: 'Water entry deleted successfully' };
  }
}
