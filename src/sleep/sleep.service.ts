import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
import { round } from '../common/utils/fitness.util';
import { CreateSleepLogDto, QuerySleepDto, UpdateSleepLogDto } from './dto/sleep.dto';

const QUALITY_SCORE: Record<string, number> = {
  POOR: 1,
  FAIR: 2,
  GOOD: 3,
  EXCELLENT: 4,
};

@Injectable()
export class SleepService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSleepLogDto) {
    const sleepStart = new Date(dto.sleepStart);
    const sleepEnd = new Date(dto.sleepEnd);

    if (sleepEnd.getTime() <= sleepStart.getTime()) {
      throw new BadRequestException('Wake-up time must be after the sleep start time');
    }

    const durationMinutes = Math.round(
      (sleepEnd.getTime() - sleepStart.getTime()) / 60000,
    );
    if (durationMinutes > 24 * 60) {
      throw new BadRequestException('A sleep record cannot be longer than 24 hours');
    }

    // Replaying a queued offline write returns the original record.
    if (dto.clientOpId) {
      const existing = await this.prisma.sleepLog.findFirst({
        where: { userId, clientOpId: dto.clientOpId },
      });
      if (existing) return this.decorate(existing);
    }

    // Sleep is attributed to the day you wake up, which is how the entry
    // lines up with that day's training and nutrition.
    const loggedDate = toDateOnly(dto.loggedDate ?? sleepEnd);

    return this.decorate(
      await this.prisma.sleepLog.create({
        data: {
          userId,
          sleepStart,
          sleepEnd,
          durationMinutes,
          sleepQuality: (dto.sleepQuality as any) ?? null,
          loggedDate,
          notes: dto.notes,
          clientOpId: dto.clientOpId || null,
        },
      }),
    );
  }

  async findAll(userId: string, query: QuerySleepDto) {
    const where: Prisma.SleepLogWhereInput = {
      userId,
      ...(query.sleepQuality ? { sleepQuality: query.sleepQuality as any } : {}),
      ...(query.date
        ? { loggedDate: toDateOnly(query.date) }
        : dateRangeFilter(query.fromDate, query.toDate)
          ? { loggedDate: dateRangeFilter(query.fromDate, query.toDate) }
          : {}),
      ...(query.search ? { notes: { contains: query.search } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.sleepLog.findMany({
        where,
        orderBy: { loggedDate: query.sortOrder || 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.sleepLog.count({ where }),
    ]);

    return buildPaginatedResult(
      items.map((i) => this.decorate(i)),
      total,
      query.page || 1,
      query.limit || 20,
    );
  }

  async findOne(userId: string, id: string) {
    const item = await this.prisma.sleepLog.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException('Sleep entry not found');
    return this.decorate(item);
  }

  async update(userId: string, id: string, dto: UpdateSleepLogDto) {
    const existing = await this.prisma.sleepLog.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Sleep entry not found');

    const sleepStart = dto.sleepStart ? new Date(dto.sleepStart) : existing.sleepStart;
    const sleepEnd = dto.sleepEnd ? new Date(dto.sleepEnd) : existing.sleepEnd;

    if (sleepEnd.getTime() <= sleepStart.getTime()) {
      throw new BadRequestException('Wake-up time must be after the sleep start time');
    }

    const updated = await this.prisma.sleepLog.update({
      where: { id },
      data: {
        sleepStart,
        sleepEnd,
        durationMinutes: Math.round(
          (sleepEnd.getTime() - sleepStart.getTime()) / 60000,
        ),
        sleepQuality: (dto.sleepQuality as any) ?? existing.sleepQuality,
        loggedDate: dto.loggedDate ? toDateOnly(dto.loggedDate) : toDateOnly(sleepEnd),
        notes: dto.notes ?? existing.notes,
      },
    });

    return this.decorate(updated);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.sleepLog.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Sleep entry not found');
    await this.prisma.sleepLog.delete({ where: { id } });
    return { id, deleted: true };
  }

  async summary(userId: string, days = 7) {
    const to = toDateOnly(new Date());
    const from = addDays(to, -(days - 1));

    const logs = await this.prisma.sleepLog.findMany({
      where: { userId, loggedDate: { gte: from, lte: to } },
      orderBy: { loggedDate: 'asc' },
    });

    const byDay = new Map<string, any>();
    for (const day of eachDay(from, to)) {
      byDay.set(formatDateOnly(day), {
        date: formatDateOnly(day),
        durationMinutes: 0,
        durationHours: 0,
        sleepQuality: null,
      });
    }
    for (const log of logs) {
      const key = formatDateOnly(log.loggedDate);
      if (!byDay.has(key)) continue;
      byDay.set(key, {
        date: key,
        durationMinutes: log.durationMinutes,
        durationHours: round(log.durationMinutes / 60, 1),
        sleepQuality: log.sleepQuality,
      });
    }

    const recorded = logs.length;
    const totalMinutes = logs.reduce((sum, l) => sum + l.durationMinutes, 0);
    const qualityScores = logs
      .filter((l) => l.sleepQuality)
      .map((l) => QUALITY_SCORE[l.sleepQuality!]);

    const latest = await this.prisma.sleepLog.findFirst({
      where: { userId },
      orderBy: { loggedDate: 'desc' },
    });

    return {
      points: [...byDay.values()],
      rangeDays: days,
      nightsRecorded: recorded,
      averageMinutes: recorded ? Math.round(totalMinutes / recorded) : 0,
      averageHours: recorded ? round(totalMinutes / recorded / 60, 1) : 0,
      averageQualityScore: qualityScores.length
        ? round(
            qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length,
            1,
          )
        : null,
      lastNight: latest ? this.decorate(latest) : null,
    };
  }

  getQualityOptions() {
    return [
      { value: 'POOR', label: 'Poor', score: 1 },
      { value: 'FAIR', label: 'Fair', score: 2 },
      { value: 'GOOD', label: 'Good', score: 3 },
      { value: 'EXCELLENT', label: 'Excellent', score: 4 },
    ];
  }

  private decorate(log: any) {
    const hours = Math.floor(log.durationMinutes / 60);
    const minutes = log.durationMinutes % 60;
    return {
      ...log,
      durationHours: round(log.durationMinutes / 60, 1),
      durationLabel: `${hours}h ${minutes}m`,
      qualityScore: log.sleepQuality ? QUALITY_SCORE[log.sleepQuality] : null,
    };
  }
}
