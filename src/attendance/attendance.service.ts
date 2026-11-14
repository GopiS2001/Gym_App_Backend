import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import {
  addDays,
  dateRangeFilter,
  eachDay,
  endOfMonth,
  formatDateOnly,
  startOfMonth,
  toDateOnly,
} from '../common/utils/date.util';
import { currentStreak, round } from '../common/utils/fitness.util';
import {
  CheckInDto,
  CheckOutDto,
  QueryAttendanceDto,
  UpdateAttendanceDto,
} from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async checkIn(userId: string, dto: CheckInDto) {
    const attendanceDate = toDateOnly(dto.attendanceDate);
    const checkInAt = dto.checkInAt ? new Date(dto.checkInAt) : new Date();

    const existing = await this.prisma.gymAttendance.findUnique({
      where: { userId_attendanceDate: { userId, attendanceDate } },
    });

    if (existing) {
      // A second check-in on the same day reopens the visit rather than
      // creating a duplicate row.
      return this.prisma.gymAttendance.update({
        where: { id: existing.id },
        data: {
          checkInAt: existing.checkOutAt ? existing.checkInAt : checkInAt,
          notes: dto.notes ?? existing.notes,
        },
      });
    }

    return this.prisma.gymAttendance.create({
      data: { userId, attendanceDate, checkInAt, notes: dto.notes },
    });
  }

  async checkOut(userId: string, dto: CheckOutDto) {
    const attendanceDate = toDateOnly(dto.attendanceDate);
    const record = await this.prisma.gymAttendance.findUnique({
      where: { userId_attendanceDate: { userId, attendanceDate } },
    });
    if (!record) {
      throw new BadRequestException('There is no check-in recorded for this day');
    }

    const checkOutAt = dto.checkOutAt ? new Date(dto.checkOutAt) : new Date();
    if (checkOutAt.getTime() < record.checkInAt.getTime()) {
      throw new BadRequestException('Check-out time must be after the check-in time');
    }

    return this.prisma.gymAttendance.update({
      where: { id: record.id },
      data: {
        checkOutAt,
        durationMinutes: Math.round(
          (checkOutAt.getTime() - record.checkInAt.getTime()) / 60000,
        ),
        notes: dto.notes ?? record.notes,
      },
    });
  }

  async findAll(userId: string, query: QueryAttendanceDto) {
    const where: Prisma.GymAttendanceWhereInput = {
      userId,
      ...(dateRangeFilter(query.fromDate, query.toDate)
        ? { attendanceDate: dateRangeFilter(query.fromDate, query.toDate) }
        : {}),
      ...(query.search ? { notes: { contains: query.search } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.gymAttendance.findMany({
        where,
        orderBy: { attendanceDate: query.sortOrder || 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.gymAttendance.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query.page || 1, query.limit || 20);
  }

  async today(userId: string) {
    const attendanceDate = toDateOnly(new Date());
    const record = await this.prisma.gymAttendance.findUnique({
      where: { userId_attendanceDate: { userId, attendanceDate } },
    });

    return {
      date: formatDateOnly(attendanceDate),
      checkedIn: !!record,
      checkedOut: !!record?.checkOutAt,
      record,
    };
  }

  async update(userId: string, id: string, dto: UpdateAttendanceDto) {
    const record = await this.prisma.gymAttendance.findFirst({
      where: { id, userId },
    });
    if (!record) throw new NotFoundException('Attendance record not found');

    const checkInAt = dto.checkInAt ? new Date(dto.checkInAt) : record.checkInAt;
    const checkOutAt = dto.checkOutAt
      ? new Date(dto.checkOutAt)
      : record.checkOutAt;

    if (checkOutAt && checkOutAt.getTime() < checkInAt.getTime()) {
      throw new BadRequestException('Check-out time must be after the check-in time');
    }

    return this.prisma.gymAttendance.update({
      where: { id },
      data: {
        checkInAt,
        checkOutAt,
        durationMinutes: checkOutAt
          ? Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000)
          : 0,
        notes: dto.notes ?? record.notes,
      },
    });
  }

  async remove(userId: string, id: string) {
    const record = await this.prisma.gymAttendance.findFirst({
      where: { id, userId },
    });
    if (!record) throw new NotFoundException('Attendance record not found');
    await this.prisma.gymAttendance.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Calendar view for a month: every day marked as a workout day, a gym visit
   * without a workout, or a rest day.
   */
  async calendar(userId: string, month?: string) {
    const reference = month ? toDateOnly(`${month}-01`) : toDateOnly(new Date());
    const from = startOfMonth(reference);
    const to = endOfMonth(reference);

    const [attendance, sessions] = await Promise.all([
      this.prisma.gymAttendance.findMany({
        where: { userId, attendanceDate: { gte: from, lte: to } },
      }),
      this.prisma.workoutSession.findMany({
        where: {
          userId,
          sessionDate: { gte: from, lte: to },
          status: 'COMPLETED',
        },
        select: {
          id: true,
          sessionDate: true,
          title: true,
          durationSeconds: true,
          totalVolumeKg: true,
        },
      }),
    ]);

    const attendanceMap = new Map(
      attendance.map((a) => [formatDateOnly(a.attendanceDate), a]),
    );
    const sessionMap = new Map<string, any[]>();
    for (const s of sessions) {
      const key = formatDateOnly(s.sessionDate);
      if (!sessionMap.has(key)) sessionMap.set(key, []);
      sessionMap.get(key)!.push(s);
    }

    const today = formatDateOnly(toDateOnly(new Date()));
    const days = eachDay(from, to).map((day) => {
      const key = formatDateOnly(day);
      const record = attendanceMap.get(key);
      const daySessions = sessionMap.get(key) || [];
      return {
        date: key,
        dayOfMonth: day.getUTCDate(),
        weekDay: day.getUTCDay(),
        isToday: key === today,
        isFuture: key > today,
        attended: !!record,
        workedOut: daySessions.length > 0,
        durationMinutes: record?.durationMinutes ?? 0,
        sessionCount: daySessions.length,
        sessions: daySessions,
        status: daySessions.length
          ? 'WORKOUT'
          : record
            ? 'VISIT'
            : key > today
              ? 'UPCOMING'
              : 'REST',
      };
    });

    const attendedDays = days.filter((d) => d.attended);
    const workoutDays = days.filter((d) => d.workedOut);
    const pastDays = days.filter((d) => !d.isFuture);

    return {
      month: `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, '0')}`,
      monthLabel: from.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }),
      year: from.getUTCFullYear(),
      firstWeekDay: from.getUTCDay(),
      daysInMonth: days.length,
      days,
      summary: {
        attendedDays: attendedDays.length,
        workoutDays: workoutDays.length,
        restDays: pastDays.length - attendedDays.length,
        totalMinutes: attendedDays.reduce((sum, d) => sum + d.durationMinutes, 0),
        averageMinutes: attendedDays.length
          ? Math.round(
              attendedDays.reduce((sum, d) => sum + d.durationMinutes, 0) /
                attendedDays.length,
            )
          : 0,
        consistencyPercentage: pastDays.length
          ? round((attendedDays.length / pastDays.length) * 100, 1)
          : 0,
      },
    };
  }

  async stats(userId: string) {
    const to = toDateOnly(new Date());
    const from = addDays(to, -364);

    const records = await this.prisma.gymAttendance.findMany({
      where: { userId, attendanceDate: { gte: from, lte: to } },
      orderBy: { attendanceDate: 'desc' },
    });

    const dates = records.map((r) => r.attendanceDate);
    const thisMonthStart = startOfMonth(to);
    const thisWeekStart = addDays(to, -6);

    return {
      totalVisits: records.length,
      thisMonthVisits: records.filter(
        (r) => r.attendanceDate.getTime() >= thisMonthStart.getTime(),
      ).length,
      thisWeekVisits: records.filter(
        (r) => r.attendanceDate.getTime() >= thisWeekStart.getTime(),
      ).length,
      currentStreak: currentStreak(dates),
      longestStreak: this.longestStreak(dates),
      totalMinutes: records.reduce((sum, r) => sum + r.durationMinutes, 0),
      averageMinutes: records.length
        ? Math.round(
            records.reduce((sum, r) => sum + r.durationMinutes, 0) / records.length,
          )
        : 0,
      lastVisit: records[0]?.attendanceDate ?? null,
    };
  }

  private longestStreak(dates: Date[]): number {
    if (!dates.length) return 0;
    const sorted = [...new Set(dates.map((d) => formatDateOnly(d)))].sort();
    let longest = 1;
    let run = 1;
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = new Date(`${sorted[i - 1]}T00:00:00.000Z`).getTime();
      const curr = new Date(`${sorted[i]}T00:00:00.000Z`).getTime();
      if (curr - prev === 86_400_000) {
        run += 1;
        longest = Math.max(longest, run);
      } else {
        run = 1;
      }
    }
    return longest;
  }
}
