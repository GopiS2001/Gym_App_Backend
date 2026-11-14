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
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  QueryCategoriesDto,
  UpdateCategoryDto,
} from './dto/category.dto';

@ApiTags('Workout Categories')
@Auth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a custom workout category' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateCategoryDto) {
    const data = await this.categoriesService.create(userId, dto);
    return { ...data, __message: 'Category created successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'List categories with search and pagination' })
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: QueryCategoriesDto,
  ) {
    const data = await this.categoriesService.findAll(userId, query);
    return { ...data, __message: 'Categories retrieved successfully' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one category' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.categoriesService.findOne(userId, id);
    return { ...data, __message: 'Category retrieved successfully' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const data = await this.categoriesService.update(userId, id, dto);
    return { ...data, __message: 'Category updated successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an empty category' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.categoriesService.remove(userId, id);
    return { ...data, __message: 'Category deleted successfully' };
  }
}
