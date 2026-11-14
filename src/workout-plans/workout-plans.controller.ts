import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateWorkoutPlanDto,
  PlanExerciseDto,
  QueryWorkoutPlansDto,
  ReorderPlanExercisesDto,
  UpdateWorkoutPlanDto,
} from './dto/workout-plan.dto';
import { WorkoutPlansService } from './workout-plans.service';

@ApiTags('Workout Plans')
@Auth()
@Controller('workout-plans')
export class WorkoutPlansController {
  constructor(private readonly plansService: WorkoutPlansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a workout plan with its weekly schedule' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateWorkoutPlanDto,
  ) {
    const data = await this.plansService.create(userId, dto);
    return { ...data, __message: 'Workout plan created successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'List plans with search, status and difficulty filters' })
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: QueryWorkoutPlansDto,
  ) {
    const data = await this.plansService.findAll(userId, query);
    return { ...data, __message: 'Workout plans retrieved successfully' };
  }

  @Get('week-days')
  @ApiOperation({ summary: 'List the days of the week' })
  weekDays() {
    return { items: this.plansService.getWeekDays(), __message: 'Week days retrieved' };
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's scheduled workout from the active plan" })
  async today(@CurrentUser('userId') userId: string, @Query('day') day?: string) {
    const data = await this.plansService.todaysPlan(userId, day);
    return {
      data,
      __message: data ? "Today's workout retrieved" : 'No active plan found',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a plan with its full weekly schedule' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.plansService.findOne(userId, id);
    return { ...data, __message: 'Workout plan retrieved successfully' };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a plan and replace its schedule' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkoutPlanDto,
  ) {
    const data = await this.plansService.update(userId, id, dto);
    return { ...data, __message: 'Workout plan updated successfully' };
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a plan as a draft' })
  async duplicate(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.plansService.duplicate(userId, id);
    return { ...data, __message: 'Workout plan duplicated successfully' };
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Make this the active plan' })
  async activate(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.plansService.activate(userId, id);
    return { ...data, __message: 'Workout plan activated successfully' };
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a plan' })
  async archive(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.plansService.archive(userId, id);
    return { ...data, __message: 'Workout plan archived successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a plan' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.plansService.remove(userId, id);
    return { ...data, __message: 'Workout plan deleted successfully' };
  }

  // ------------------------------------------------------ plan exercises

  @Post(':id/exercises')
  @ApiOperation({ summary: 'Add an exercise to a plan day' })
  async addExercise(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlanExerciseDto,
  ) {
    const data = await this.plansService.addExercise(userId, id, dto);
    return { ...data, __message: 'Exercise added to plan successfully' };
  }

  // Declared before ':id/exercises/:planExerciseId' so the literal "reorder"
  // segment is not swallowed by the UUID param route.
  @Patch(':id/exercises/reorder')
  @ApiOperation({ summary: 'Reorder exercises within a plan' })
  async reorder(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderPlanExercisesDto,
  ) {
    const data = await this.plansService.reorderExercises(userId, id, dto);
    return { ...data, __message: 'Exercises reordered successfully' };
  }

  @Patch(':id/exercises/:planExerciseId')
  @ApiOperation({ summary: 'Update one scheduled exercise' })
  async updateExercise(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('planExerciseId', ParseUUIDPipe) planExerciseId: string,
    @Body() dto: Partial<PlanExerciseDto>,
  ) {
    const data = await this.plansService.updateExercise(
      userId,
      id,
      planExerciseId,
      dto,
    );
    return { ...data, __message: 'Scheduled exercise updated successfully' };
  }

  @Delete(':id/exercises/:planExerciseId')
  @ApiOperation({ summary: 'Remove one scheduled exercise' })
  async removeExercise(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('planExerciseId', ParseUUIDPipe) planExerciseId: string,
  ) {
    const data = await this.plansService.removeExercise(userId, id, planExerciseId);
    return { ...data, __message: 'Exercise removed from plan successfully' };
  }
}
