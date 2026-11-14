import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  AddSessionExerciseDto,
  CompleteSessionDto,
  QuerySessionsDto,
  RecordSetDto,
  ReorderSessionExercisesDto,
  StartSessionDto,
  UpdateSessionDto,
  UpdateSetDto,
} from './dto/workout-session.dto';
import { WorkoutSessionsService } from './workout-sessions.service';

@ApiTags('Workout Sessions')
@Auth()
@Controller('workout-sessions')
export class WorkoutSessionsController {
  constructor(private readonly sessionsService: WorkoutSessionsService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start a workout from a plan or as a free session' })
  async start(@CurrentUser('userId') userId: string, @Body() dto: StartSessionDto) {
    const data = await this.sessionsService.start(userId, dto);
    return { ...data, __message: 'Workout started successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'Workout history with date range, status and search' })
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: QuerySessionsDto,
  ) {
    const data = await this.sessionsService.findAll(userId, query);
    return { ...data, __message: 'Workout history retrieved successfully' };
  }

  @Get('active')
  @ApiOperation({ summary: 'Get the in-progress workout, if one exists' })
  async active(@CurrentUser('userId') userId: string) {
    const data = await this.sessionsService.findActive(userId);
    return {
      data,
      __message: data ? 'Active workout retrieved' : 'No workout in progress',
    };
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's workout sessions" })
  async today(@CurrentUser('userId') userId: string) {
    const items = await this.sessionsService.findToday(userId);
    return { items, __message: "Today's sessions retrieved successfully" };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one session with sets and previous performance' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.sessionsService.findOne(userId, id);
    return { ...data, __message: 'Workout session retrieved successfully' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update session title, notes or status' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    const data = await this.sessionsService.update(userId, id, dto);
    return { ...data, __message: 'Workout session updated successfully' };
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a workout and save its totals' })
  async complete(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteSessionDto,
  ) {
    const data = await this.sessionsService.complete(userId, id, dto);
    return { ...data, __message: 'Workout completed successfully' };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a workout' })
  async cancel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.sessionsService.cancel(userId, id);
    return { ...data, __message: 'Workout cancelled' };
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause a workout' })
  async pause(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.sessionsService.pause(userId, id);
    return { ...data, __message: 'Workout paused' };
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused workout' })
  async resume(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.sessionsService.resume(userId, id);
    return { ...data, __message: 'Workout resumed' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workout session' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.sessionsService.remove(userId, id);
    return { ...data, __message: 'Workout session deleted successfully' };
  }

  // ------------------------------------------------------ session exercises

  @Post(':id/exercises')
  @ApiOperation({ summary: 'Add an exercise to the running workout' })
  async addExercise(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddSessionExerciseDto,
  ) {
    const data = await this.sessionsService.addExercise(userId, id, dto);
    return { ...data, __message: 'Exercise added successfully' };
  }

  // Declared before the ':sessionExerciseId' route so "reorder" is not
  // captured as a UUID parameter.
  @Patch(':id/exercises/reorder')
  @ApiOperation({ summary: 'Reorder exercises inside the workout' })
  async reorderExercises(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderSessionExercisesDto,
  ) {
    const data = await this.sessionsService.reorderExercises(userId, id, dto);
    return { ...data, __message: 'Exercises reordered successfully' };
  }

  @Patch(':id/exercises/:sessionExerciseId/skip')
  @ApiOperation({ summary: 'Mark an exercise as skipped' })
  async skipExercise(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionExerciseId', ParseUUIDPipe) sessionExerciseId: string,
  ) {
    const data = await this.sessionsService.skipExercise(userId, id, sessionExerciseId);
    return { ...data, __message: 'Exercise skipped' };
  }

  @Delete(':id/exercises/:sessionExerciseId')
  @ApiOperation({ summary: 'Remove an exercise from the workout' })
  async removeExercise(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionExerciseId', ParseUUIDPipe) sessionExerciseId: string,
  ) {
    const data = await this.sessionsService.removeExercise(
      userId,
      id,
      sessionExerciseId,
    );
    return { ...data, __message: 'Exercise removed successfully' };
  }

  // ------------------------------------------------------------ sets

  @Post(':id/sets')
  @ApiOperation({ summary: 'Record one set (reps and weight)' })
  async recordSet(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordSetDto,
  ) {
    const data = await this.sessionsService.recordSet(userId, id, dto);
    return { ...data, __message: 'Set recorded successfully' };
  }

  @Patch(':id/sets/:setId')
  @ApiOperation({ summary: 'Update a recorded set' })
  async updateSet(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('setId', ParseUUIDPipe) setId: string,
    @Body() dto: UpdateSetDto,
  ) {
    const data = await this.sessionsService.updateSet(userId, id, setId, dto);
    return { ...data, __message: 'Set updated successfully' };
  }

  @Delete(':id/sets/:setId')
  @ApiOperation({ summary: 'Delete a recorded set' })
  async deleteSet(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('setId', ParseUUIDPipe) setId: string,
  ) {
    const data = await this.sessionsService.deleteSet(userId, id, setId);
    return { ...data, __message: 'Set deleted successfully' };
  }
}
