import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import {
  addDays,
  dateRangeFilter,
  eachDay,
  formatDateOnly,
  toDateOnly,
} from '../common/utils/date.util';
import { currentStreak, round } from '../common/utils/fitness.util';
import {
  CreateWaterLogDto,
  QueryWaterDto,
  UpdateWaterLogDto,
} from './dto/water.dto';

@Injectable()
export class WaterService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateWaterLogDto) {
    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();

    // Replaying a queued offline write must not add the glass twice.
    if (dto.clientOpId) {
      const existing = await this.prisma.waterLog.findFirst({
        where: { userId, clientOpId: dto.clientOpId },
      });
      if (existing) return existing;
    }

    return this.prisma.waterLog.create({
      data: {
        userId,
        amountMl: dto.amountMl,
        recordedAt,
        loggedDate: toDateOnly(recordedAt),
        clientOpId: dto.clientOpId || null,
      },
    });
  }

  async findAll(userId: string, query: QueryWaterDto) {
    const where: Prisma.WaterLogWhereInput = {
      userId,
      ...(query.date
        ? { loggedDate: toDateOnly(query.date) }
        : dateRangeFilter(query.fromDate, query.toDate)
          ? { loggedDate: dateRangeFilter(query.fromDate, query.toDate) }
          : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.waterLog.findMany({
        where,
        orderBy: { recordedAt: query.sortOrder || 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.waterLog.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query.page || 1, query.limit || 20);
  }

  async update(userId: string, id: string, dto: UpdateWaterLogDto) {
    const existing = await this.prisma.waterLog.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Water entry not found');

    const data: any = { amountMl: dto.amountMl };
    if (dto.recordedAt) {
      data.recordedAt = new Date(dto.recordedAt);
      data.loggedDate = toDateOnly(data.recordedAt);
    }

    return this.prisma.waterLog.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.waterLog.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Water entry not found');
    await this.prisma.waterLog.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Removes the most recent entry — the undo action in the app. */
  async removeLast(userId: string, date?: string) {
    const loggedDate = toDateOnly(date);
    const last = await this.prisma.waterLog.findFirst({
      where: { userId, loggedDate },
      orderBy: { recordedAt: 'desc' },
    });
    if (!last) throw new NotFoundException('No water entry to undo for this day');

    await this.prisma.waterLog.delete({ where: { id: last.id } });
    return { id: last.id, deleted: true, amountMl: last.amountMl };
  }

  async dailySummary(userId: string, date?: string) {
    const loggedDate = toDateOnly(date);

    const [logs, settings] = await Promise.all([
      this.prisma.waterLog.findMany({
        where: { userId, loggedDate },
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.userSetting.findUnique({ where: { userId } }),
    ]);

    const totalMl = logs.reduce((sum, l) => sum + l.amountMl, 0);
    const targetMl = settings?.dailyWaterTargetMl ?? 3000;

    return {
      date: formatDateOnly(loggedDate),
      totalMl,
      targetMl,
      remainingMl: Math.max(0, targetMl - totalMl),
      progressPercentage: targetMl
        ? round(Math.min(100, (totalMl / targetMl) * 100), 1)
        : 0,
      goalReached: totalMl >= targetMl,
      glassesCount: logs.length,
      totalLitres: round(totalMl / 1000, 2),
      entries: logs,
      quickAddOptions: [150, 250, 500, 750, 1000],
    };
  }

  async history(userId: string, days = 7) {
    const to = toDateOnly(new Date());
    const from = addDays(to, -(days - 1));

    const [logs, settings] = await Promise.all([
      this.prisma.waterLog.findMany({
        where: { userId, loggedDate: { gte: from, lte: to } },
      }),
      this.prisma.userSetting.findUnique({ where: { userId } }),
    ]);

    const targetMl = settings?.dailyWaterTargetMl ?? 3000;
    const byDay = new Map<string, number>();
    for (const day of eachDay(from, to)) byDay.set(formatDateOnly(day), 0);
    for (const log of logs) {
      const key = formatDateOnly(log.loggedDate);
      if (byDay.has(key)) byDay.set(key, byDay.get(key)! + log.amountMl);
    }

    const points = [...byDay.entries()].map(([date, totalMl]) => ({
      date,
      totalMl,
      targetMl,
      goalReached: totalMl >= targetMl,
    }));

    const loggedDays = points.filter((p) => p.totalMl > 0);
    const goalDates = points
      .filter((p) => p.goalReached)
      .map((p) => new Date(`${p.date}T00:00:00.000Z`));

    return {
      points,
      rangeDays: days,
      targetMl,
      averageMl: loggedDays.length
        ? Math.round(
            loggedDays.reduce((sum, p) => sum + p.totalMl, 0) / loggedDays.length,
          )
        : 0,
      daysGoalReached: goalDates.length,
      streak: currentStreak(goalDates),
    };
  }
}
