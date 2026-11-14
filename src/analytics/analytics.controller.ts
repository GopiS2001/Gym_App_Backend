import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { ProgressService } from '../progress/progress.service';

@ApiTags('Analytics')
@Auth()
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly progressService: ProgressService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Everything the home dashboard renders' })
  async dashboard(@CurrentUser('userId') userId: string) {
    const data = await this.analyticsService.dashboard(userId);
    return { ...data, __message: 'Dashboard retrieved successfully' };
  }

  @Get('workouts')
  @ApiOperation({ summary: 'Workout statistics and muscle distribution' })
  async workouts(@CurrentUser('userId') userId: string, @Query('days') days?: string) {
    const data = await this.analyticsService.workoutStats(
      userId,
      days ? parseInt(days, 10) : 30,
    );
    return { ...data, __message: 'Workout statistics retrieved successfully' };
  }

  @Get('weight')
  @ApiOperation({ summary: 'Weight chart data' })
  async weight(@CurrentUser('userId') userId: string, @Query('days') days?: string) {
    const data = await this.progressService.weightChart(
      userId,
      days ? parseInt(days, 10) : 90,
    );
    return { ...data, __message: 'Weight chart retrieved successfully' };
  }

  @Get('strength')
  @ApiOperation({ summary: 'Strength progression or personal records' })
  async strength(
    @CurrentUser('userId') userId: string,
    @Query('exerciseId') exerciseId?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.analyticsService.strengthProgress(
      userId,
      exerciseId,
      limit ? parseInt(limit, 10) : 10,
    );
    return { ...data, __message: 'Strength progress retrieved successfully' };
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Full monthly report (YYYY-MM)' })
  async monthly(@CurrentUser('userId') userId: string, @Query('month') month?: string) {
    const data = await this.analyticsService.monthlyReport(userId, month);
    return { ...data, __message: 'Monthly report retrieved successfully' };
  }
}
