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
  CreateGoalTypeDto,
  QueryGoalTypesDto,
  UpdateGoalTypeDto,
} from './dto/goal-type.dto';
import { GoalTypesService } from './goal-types.service';

@ApiTags('Goal Types')
@Auth()
@Controller('goal-types')
export class GoalTypesController {
  constructor(private readonly goalTypesService: GoalTypesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a custom goal type' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateGoalTypeDto) {
    const data = await this.goalTypesService.create(userId, dto);
    return { ...data, __message: 'Goal type created successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'List goal types with search and pagination' })
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: QueryGoalTypesDto,
  ) {
    const data = await this.goalTypesService.findAll(userId, query);
    return { ...data, __message: 'Goal types retrieved successfully' };
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder goal types' })
  async reorder(
    @CurrentUser('userId') userId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    const data = await this.goalTypesService.reorder(userId, body.orderedIds || []);
    return { ...data, __message: 'Goal types reordered successfully' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one goal type' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.goalTypesService.findOne(userId, id);
    return { ...data, __message: 'Goal type retrieved successfully' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a goal type' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoalTypeDto,
  ) {
    const data = await this.goalTypesService.update(userId, id, dto);
    return { ...data, __message: 'Goal type updated successfully' };
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore an archived goal type' })
  async restore(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.goalTypesService.restore(userId, id);
    return { ...data, __message: 'Goal type restored successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a goal type, or archive it when goals use it' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.goalTypesService.remove(userId, id);
    return {
      ...data,
      __message: data.archived
        ? 'Goal type archived (it is used by existing goals)'
        : 'Goal type deleted successfully',
    };
  }
}
