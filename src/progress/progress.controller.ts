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
  ComparePhotosDto,
  CreateMeasurementDto,
  CreateProgressPhotoDto,
  CreateWeightLogDto,
  QueryPhotosDto,
  QueryProgressDto,
  UpdateMeasurementDto,
  UpdateProgressPhotoDto,
  UpdateWeightLogDto,
} from './dto/progress.dto';
import { ProgressService } from './progress.service';

@ApiTags('Progress')
@Auth()
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  // ------------------------------------------------------------ weight

  @Post('weight')
  @ApiOperation({ summary: 'Record body weight for a day' })
  async addWeight(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateWeightLogDto,
  ) {
    const data = await this.progressService.addWeight(userId, dto);
    return { ...data, __message: 'Weight recorded successfully' };
  }

  @Get('weight')
  @ApiOperation({ summary: 'Weight history with date range and pagination' })
  async weightHistory(
    @CurrentUser('userId') userId: string,
    @Query() query: QueryProgressDto,
  ) {
    const data = await this.progressService.findWeightLogs(userId, query);
    return { ...data, __message: 'Weight history retrieved successfully' };
  }

  @Get('weight/summary')
  @ApiOperation({ summary: 'Starting, current, target weight and trends' })
  async weightSummary(@CurrentUser('userId') userId: string) {
    const data = await this.progressService.weightSummary(userId);
    return { ...data, __message: 'Weight summary retrieved successfully' };
  }

  @Get('weight/chart')
  @ApiOperation({ summary: 'Chart-ready weight series' })
  async weightChart(
    @CurrentUser('userId') userId: string,
    @Query('days') days?: string,
  ) {
    const data = await this.progressService.weightChart(
      userId,
      days ? parseInt(days, 10) : 90,
    );
    return { ...data, __message: 'Weight chart retrieved successfully' };
  }

  @Patch('weight/:id')
  @ApiOperation({ summary: 'Update a weight entry' })
  async updateWeight(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWeightLogDto,
  ) {
    const data = await this.progressService.updateWeight(userId, id, dto);
    return { ...data, __message: 'Weight entry updated successfully' };
  }

  @Delete('weight/:id')
  @ApiOperation({ summary: 'Delete a weight entry' })
  async removeWeight(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.progressService.removeWeight(userId, id);
    return { ...data, __message: 'Weight entry deleted successfully' };
  }

  // ------------------------------------------------------ measurements

  @Post('measurements')
  @ApiOperation({ summary: 'Record body measurements for a day' })
  async addMeasurement(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateMeasurementDto,
  ) {
    const data = await this.progressService.addMeasurement(userId, dto);
    return { ...data, __message: 'Measurements recorded successfully' };
  }

  @Get('measurements')
  @ApiOperation({ summary: 'Measurement history with date range' })
  async measurements(
    @CurrentUser('userId') userId: string,
    @Query() query: QueryProgressDto,
  ) {
    const data = await this.progressService.findMeasurements(userId, query);
    return { ...data, __message: 'Measurements retrieved successfully' };
  }

  @Get('measurements/summary')
  @ApiOperation({ summary: 'Latest measurements with change since the first entry' })
  async measurementSummary(@CurrentUser('userId') userId: string) {
    const data = await this.progressService.measurementSummary(userId);
    return { ...data, __message: 'Measurement summary retrieved successfully' };
  }

  @Get('measurements/:id')
  @ApiOperation({ summary: 'Get one measurement entry' })
  async measurement(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.progressService.findMeasurement(userId, id);
    return { ...data, __message: 'Measurement retrieved successfully' };
  }

  @Patch('measurements/:id')
  @ApiOperation({ summary: 'Update a measurement entry' })
  async updateMeasurement(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMeasurementDto,
  ) {
    const data = await this.progressService.updateMeasurement(userId, id, dto);
    return { ...data, __message: 'Measurement updated successfully' };
  }

  @Delete('measurements/:id')
  @ApiOperation({ summary: 'Delete a measurement entry' })
  async removeMeasurement(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.progressService.removeMeasurement(userId, id);
    return { ...data, __message: 'Measurement deleted successfully' };
  }

  // ------------------------------------------------------------ photos

  @Post('photos')
  @ApiOperation({ summary: 'Add a transformation photo record' })
  async addPhoto(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateProgressPhotoDto,
  ) {
    const data = await this.progressService.addPhoto(userId, dto);
    return { ...data, __message: 'Photo added successfully' };
  }

  @Get('photos')
  @ApiOperation({ summary: 'Photo timeline with type and date filters' })
  async photos(
    @CurrentUser('userId') userId: string,
    @Query() query: QueryPhotosDto,
  ) {
    const data = await this.progressService.findPhotos(userId, query);
    return { ...data, __message: 'Photos retrieved successfully' };
  }

  @Post('photos/compare')
  @ApiOperation({ summary: 'Compare two photos side by side' })
  async comparePhotos(
    @CurrentUser('userId') userId: string,
    @Body() dto: ComparePhotosDto,
  ) {
    const data = await this.progressService.comparePhotos(userId, dto);
    return { ...data, __message: 'Comparison retrieved successfully' };
  }

  @Patch('photos/:id')
  @ApiOperation({ summary: 'Update a photo record' })
  async updatePhoto(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProgressPhotoDto,
  ) {
    const data = await this.progressService.updatePhoto(userId, id, dto);
    return { ...data, __message: 'Photo updated successfully' };
  }

  @Delete('photos/:id')
  @ApiOperation({ summary: 'Delete a photo and its stored file' })
  async removePhoto(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.progressService.removePhoto(userId, id);
    return { ...data, __message: 'Photo deleted successfully' };
  }
}
