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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateMealReminderDto,
  ToggleMealReminderDto,
  UpdateMealReminderDto,
  UpdateWorkoutScheduleDto,
} from './dto/meal-reminders.dto';
import { MealRemindersService } from './meal-reminders.service';

/**
 * Reminder settings. The phone schedules the actual notifications from
 * these rows (`schedule` on each item says when they fire).
 */
@ApiTags('Meal Reminders')
@Auth()
@Controller('meal-reminders')
export class MealRemindersController {
  constructor(private readonly service: MealRemindersService) {}

  @Get()
  @ApiOperation({ summary: 'List reminders with when each fires, plus the workout schedule' })
  async findAll(@CurrentUser('userId') userId: string) {
    const data = await this.service.findAll(userId);
    return { ...data, __message: 'Reminders retrieved successfully' };
  }

  // Declared before ':id' so the path is not read as a reminder id.
  @Get('workout-schedule')
  @ApiOperation({ summary: 'Workout time and days used by pre/post-workout reminders' })
  async getWorkoutSchedule(@CurrentUser('userId') userId: string) {
    const data = await this.service.getWorkoutSchedule(userId);
    return { ...data, __message: 'Workout schedule retrieved successfully' };
  }

  @Put('workout-schedule')
  @ApiOperation({ summary: 'Update the workout schedule (moves linked reminders)' })
  async updateWorkoutSchedule(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateWorkoutScheduleDto,
  ) {
    const data = await this.service.updateWorkoutSchedule(userId, dto);
    return { ...data, __message: 'Workout schedule updated successfully' };
  }

  @Post('samples')
  @ApiOperation({ summary: 'Add the sample reminder schedule (skips types you already have)' })
  async addSamples(@CurrentUser('userId') userId: string) {
    const data = await this.service.addSamples(userId);
    return { ...data, __message: `${data.created} sample reminders added` };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one reminder' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.service.findOne(userId, id);
    return { ...data, __message: 'Reminder retrieved successfully' };
  }

  @Post()
  @ApiOperation({ summary: 'Create a reminder' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateMealReminderDto) {
    const data = await this.service.create(userId, dto);
    return { ...data, __message: 'Reminder created successfully' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a reminder' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMealReminderDto,
  ) {
    const data = await this.service.update(userId, id, dto);
    return { ...data, __message: 'Reminder updated successfully' };
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Enable or disable a reminder' })
  async toggle(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleMealReminderDto,
  ) {
    const data = await this.service.toggle(userId, id, dto);
    return {
      ...data,
      __message: data.isEnabled ? 'Reminder turned on' : 'Reminder turned off',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a reminder' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.service.remove(userId, id);
    return { ...data, __message: 'Reminder deleted successfully' };
  }
}
