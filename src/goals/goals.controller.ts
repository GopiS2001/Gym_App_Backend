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
import { CreateGoalDto, QueryGoalsDto, UpdateGoalDto } from './dto/goal.dto';
import { GoalsService } from './goals.service';
import { GoalTypesService } from '../goal-types/goal-types.service';

@ApiTags('Fitness Goals')
@Auth()
@Controller('goals')
export class GoalsController {
  constructor(
    private readonly goalsService: GoalsService,
    private readonly goalTypesService: GoalTypesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a fitness goal' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateGoalDto) {
    const data = await this.goalsService.create(userId, dto);
    return { ...data, __message: 'Goal created successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'List goals with search, filters and pagination' })
  async findAll(@CurrentUser('userId') userId: string, @Query() query: QueryGoalsDto) {
    const data = await this.goalsService.findAll(userId, query);
    return { ...data, __message: 'Goals retrieved successfully' };
  }

  @Get('types')
  @ApiOperation({ summary: 'List goal types (alias of GET /goal-types)' })
  async getTypes(@CurrentUser('userId') userId: string) {
    const data = await this.goalTypesService.findAll(userId, { limit: 100 } as any);
    return { items: data.items, __message: 'Goal types retrieved' };
  }

  @Get('active')
  @ApiOperation({ summary: 'Get the currently active goal' })
  async findActive(@CurrentUser('userId') userId: string) {
    const data = await this.goalsService.findActive(userId);
    return { data, __message: data ? 'Active goal retrieved' : 'No active goal set' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one goal with progress details' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.goalsService.findOne(userId, id);
    return { ...data, __message: 'Goal retrieved successfully' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a goal' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    const data = await this.goalsService.update(userId, id, dto);
    return { ...data, __message: 'Goal updated successfully' };
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark a goal as completed' })
  async complete(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.goalsService.complete(userId, id);
    return { ...data, __message: 'Goal marked as completed' };
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Make this the active goal' })
  async activate(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.goalsService.activate(userId, id);
    return { ...data, __message: 'Goal activated successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a goal' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.goalsService.remove(userId, id);
    return { ...data, __message: 'Goal deleted successfully' };
  }
}
