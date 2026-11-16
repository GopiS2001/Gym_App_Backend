import {
  BadRequestException,
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
import { CreateFoodDto, QueryFoodsDto, UpdateFoodDto } from './dto/foods.dto';
import { FoodsService } from './foods.service';

@ApiTags('Food Library')
@Auth()
@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Get()
  @ApiOperation({ summary: 'Search and list foods in the Food Library' })
  async findAll(@CurrentUser('userId') userId: string, @Query() query: QueryFoodsDto) {
    const data = await this.foodsService.findAll(userId, query);
    return { ...data, __message: 'Foods retrieved successfully' };
  }

  @Get('categories')
  @ApiOperation({ summary: 'Food categories with how many foods each has' })
  async categories(@CurrentUser('userId') userId: string) {
    const items = await this.foodsService.categories(userId);
    return { items, __message: 'Food categories retrieved successfully' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one food with its nutrition per serving' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.foodsService.findOne(userId, id);
    return { ...data, __message: 'Food retrieved successfully' };
  }

  @Get(':id/calculate')
  @ApiOperation({ summary: 'Nutrition for a quantity of this food (preview only)' })
  async calculate(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('quantity') quantity?: string,
  ) {
    const q = Number(quantity ?? 1);
    if (!Number.isFinite(q) || q <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }
    const data = await this.foodsService.calculate(userId, id, q);
    return { ...data, __message: 'Nutrition calculated successfully' };
  }

  @Post()
  @ApiOperation({ summary: 'Add a food to the library' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateFoodDto) {
    const data = await this.foodsService.create(userId, dto);
    return { ...data, __message: 'Food added to the library' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a food (past food entries keep their values)' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFoodDto,
  ) {
    const data = await this.foodsService.update(userId, id, dto);
    return { ...data, __message: 'Food updated successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a food from the library (history is kept)' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.foodsService.remove(userId, id);
    return { ...data, __message: 'Food removed from the library' };
  }
}
