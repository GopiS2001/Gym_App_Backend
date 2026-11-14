import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateFoodLogDto,
  QueryFoodLogsDto,
  UpdateFoodLogDto,
} from './dto/nutrition.dto';
import { NutritionService } from './nutrition.service';

@ApiTags('Nutrition')
@Auth()
@Controller('nutrition')
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Post('food')
  @ApiOperation({ summary: 'Log a food item' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateFoodLogDto) {
    const data = await this.nutritionService.create(userId, dto);
    return { ...data, __message: 'Food logged successfully' };
  }

  @Get('food')
  @ApiOperation({ summary: 'List food entries with meal, date and calorie filters' })
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: QueryFoodLogsDto,
  ) {
    const data = await this.nutritionService.findAll(userId, query);
    return { ...data, __message: 'Food entries retrieved successfully' };
  }

  @Get('meal-types')
  @ApiOperation({ summary: 'List the supported meal types' })
  mealTypes() {
    return {
      items: this.nutritionService.getMealTypes(),
      __message: 'Meal types retrieved successfully',
    };
  }

  @Get('daily')
  @ApiOperation({ summary: 'Daily totals, per-meal breakdown and target progress' })
  async daily(@CurrentUser('userId') userId: string, @Query('date') date?: string) {
    const data = await this.nutritionService.dailySummary(userId, date);
    return { ...data, __message: 'Daily nutrition retrieved successfully' };
  }

  @Get('history')
  @ApiOperation({ summary: 'Daily nutrition totals over a range' })
  async history(@CurrentUser('userId') userId: string, @Query('days') days?: string) {
    const data = await this.nutritionService.history(
      userId,
      days ? parseInt(days, 10) : 7,
    );
    return { ...data, __message: 'Nutrition history retrieved successfully' };
  }

  @Get('frequent')
  @ApiOperation({ summary: 'Previously logged foods for quick re-entry' })
  async frequent(
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const items = await this.nutritionService.frequentFoods(
      userId,
      limit ? parseInt(limit, 10) : 20,
      search,
    );
    return { items, __message: 'Frequent foods retrieved successfully' };
  }

  @Get('food/:id')
  @ApiOperation({ summary: 'Get one food entry' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.nutritionService.findOne(userId, id);
    return { ...data, __message: 'Food entry retrieved successfully' };
  }

  @Put('food/:id')
  @ApiOperation({ summary: 'Update a food entry' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFoodLogDto,
  ) {
    const data = await this.nutritionService.update(userId, id, dto);
    return { ...data, __message: 'Food entry updated successfully' };
  }

  @Delete('food/:id')
  @ApiOperation({ summary: 'Delete a food entry' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.nutritionService.remove(userId, id);
    return { ...data, __message: 'Food entry deleted successfully' };
  }
}
