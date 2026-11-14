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
import { AttendanceService } from './attendance.service';
import {
  CheckInDto,
  CheckOutDto,
  QueryAttendanceDto,
  UpdateAttendanceDto,
} from './dto/attendance.dto';

@ApiTags('Gym Attendance')
@Auth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a gym check-in' })
  async checkIn(@CurrentUser('userId') userId: string, @Body() dto: CheckInDto) {
    const data = await this.attendanceService.checkIn(userId, dto);
    return { ...data, __message: 'Checked in successfully' };
  }

  @Post('check-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a gym check-out' })
  async checkOut(@CurrentUser('userId') userId: string, @Body() dto: CheckOutDto) {
    const data = await this.attendanceService.checkOut(userId, dto);
    return { ...data, __message: 'Checked out successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'Attendance history with date filters' })
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: QueryAttendanceDto,
  ) {
    const data = await this.attendanceService.findAll(userId, query);
    return { ...data, __message: 'Attendance history retrieved successfully' };
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's attendance state" })
  async today(@CurrentUser('userId') userId: string) {
    const data = await this.attendanceService.today(userId);
    return { ...data, __message: "Today's attendance retrieved successfully" };
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Monthly attendance calendar (YYYY-MM)' })
  async calendar(
    @CurrentUser('userId') userId: string,
    @Query('month') month?: string,
  ) {
    const data = await this.attendanceService.calendar(userId, month);
    return { ...data, __message: 'Attendance calendar retrieved successfully' };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Attendance totals and streaks' })
  async stats(@CurrentUser('userId') userId: string) {
    const data = await this.attendanceService.stats(userId);
    return { ...data, __message: 'Attendance stats retrieved successfully' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an attendance record' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    const data = await this.attendanceService.update(userId, id, dto);
    return { ...data, __message: 'Attendance updated successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an attendance record' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.attendanceService.remove(userId, id);
    return { ...data, __message: 'Attendance deleted successfully' };
  }
}
