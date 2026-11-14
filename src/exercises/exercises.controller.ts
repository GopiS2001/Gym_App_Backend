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
import {
  CreateExerciseDto,
  QueryExercisesDto,
  UpdateExerciseDto,
} from './dto/exercise.dto';
import { ExercisesService } from './exercises.service';

@ApiTags('Exercises')
@Auth()
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a custom exercise' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateExerciseDto) {
    const data = await this.exercisesService.create(userId, dto);
    return { ...data, __message: 'Exercise created successfully' };
  }

  @Get()
  @ApiOperation({
    summary: 'Search exercises with category, muscle, equipment and difficulty filters',
  })
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: QueryExercisesDto,
  ) {
    const data = await this.exercisesService.findAll(userId, query);
    return { ...data, __message: 'Exercises retrieved successfully' };
  }

  @Get('filters')
  @ApiOperation({ summary: 'Get the available filter values' })
  async filters(@CurrentUser('userId') userId: string) {
    const data = await this.exercisesService.getFilterOptions(userId);
    return { ...data, __message: 'Filter options retrieved successfully' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one exercise with its recorded history' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.exercisesService.findOne(userId, id);
    return { ...data, __message: 'Exercise retrieved successfully' };
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get performance history for one exercise' })
  async history(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.exercisesService.exerciseHistory(
      userId,
      id,
      limit ? parseInt(limit, 10) : 20,
    );
    return { ...data, __message: 'Exercise history retrieved successfully' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an exercise' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExerciseDto,
  ) {
    const data = await this.exercisesService.update(userId, id, dto);
    return { ...data, __message: 'Exercise updated successfully' };
  }

  @Post(':id/favourite')
  @ApiOperation({ summary: 'Toggle the favourite flag on an exercise' })
  async toggleFavourite(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.exercisesService.toggleFavourite(userId, id);
    return {
      ...data,
      __message: data.isFavourite
        ? 'Added to favourites'
        : 'Removed from favourites',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete or archive an exercise' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.exercisesService.remove(userId, id);
    return {
      ...data,
      __message: data.softDeleted
        ? 'Exercise archived (it is used in recorded workouts)'
        : 'Exercise deleted successfully',
    };
  }
}
