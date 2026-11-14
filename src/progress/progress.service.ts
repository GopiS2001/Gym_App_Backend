import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import {
  addDays,
  dateRangeFilter,
  daysBetween,
  formatDateOnly,
  toDateOnly,
} from '../common/utils/date.util';
import { round, toNumber } from '../common/utils/fitness.util';
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

const MEASUREMENT_FIELDS = [
  'chestCm',
  'waistCm',
  'hipsCm',
  'leftArmCm',
  'rightArmCm',
  'leftThighCm',
  'rightThighCm',
  'leftCalfCm',
  'rightCalfCm',
  'neckCm',
  'shouldersCm',
  'bodyFatPercentage',
] as const;

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------ weight

  async addWeight(userId: string, dto: CreateWeightLogDto) {
    const recordedDate = toDateOnly(dto.recordedDate);

    // One entry per calendar day: re-logging the same day updates it instead
    // of creating a second row that would distort the chart.
    const log = await this.prisma.weightLog.upsert({
      where: { userId_recordedDate: { userId, recordedDate } },
      update: { weightKg: dto.weightKg, notes: dto.notes },
      create: {
        userId,
        weightKg: dto.weightKg,
        recordedDate,
        notes: dto.notes,
      },
    });

    // The profile holds a convenience copy of the newest weight.
    const newest = await this.prisma.weightLog.findFirst({
      where: { userId },
      orderBy: { recordedDate: 'desc' },
    });
    if (newest && newest.id === log.id) {
      await this.prisma.profile.updateMany({
        where: { userId },
        data: { currentWeightKg: dto.weightKg },
      });
    }

    return log;
  }

  async findWeightLogs(userId: string, query: QueryProgressDto) {
    const where: Prisma.WeightLogWhereInput = {
      userId,
      ...(dateRangeFilter(query.fromDate, query.toDate)
        ? { recordedDate: dateRangeFilter(query.fromDate, query.toDate) }
        : {}),
      ...(query.search ? { notes: { contains: query.search } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.weightLog.findMany({
        where,
        orderBy: { recordedDate: query.sortOrder || 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.weightLog.count({ where }),
    ]);

    const result = buildPaginatedResult(
      items,
      total,
      query.page || 1,
      query.limit || 20,
    );

    return { ...result, summary: await this.weightSummary(userId) };
  }

  async updateWeight(userId: string, id: string, dto: UpdateWeightLogDto) {
    const existing = await this.prisma.weightLog.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Weight entry not found');

    const data: any = { ...dto };
    if (dto.recordedDate) data.recordedDate = toDateOnly(dto.recordedDate);

    return this.prisma.weightLog.update({ where: { id }, data });
  }

  async removeWeight(userId: string, id: string) {
    const existing = await this.prisma.weightLog.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Weight entry not found');
    await this.prisma.weightLog.delete({ where: { id } });
    return { id, deleted: true };
  }

  async weightSummary(userId: string) {
    const [first, latest, goal, profile, all] = await Promise.all([
      this.prisma.weightLog.findFirst({
        where: { userId },
        orderBy: { recordedDate: 'asc' },
      }),
      this.prisma.weightLog.findFirst({
        where: { userId },
        orderBy: { recordedDate: 'desc' },
      }),
      this.prisma.fitnessGoal.findFirst({
        where: { userId, status: 'ACTIVE' },
      }),
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.weightLog.findMany({
        where: { userId },
        orderBy: { recordedDate: 'desc' },
        take: 60,
      }),
    ]);

    const current = latest ? toNumber(latest.weightKg) : toNumber(profile?.currentWeightKg, null as any);
    const starting = first ? toNumber(first.weightKg) : current;
    const target = goal?.targetWeightKg ? toNumber(goal.targetWeightKg) : null;

    const weekAgo = addDays(toDateOnly(new Date()), -7);
    const monthAgo = addDays(toDateOnly(new Date()), -30);
    const weekRef = all.find((l) => l.recordedDate.getTime() <= weekAgo.getTime());
    const monthRef = all.find((l) => l.recordedDate.getTime() <= monthAgo.getTime());

    return {
      startingWeightKg: starting,
      currentWeightKg: current,
      targetWeightKg: target,
      totalChangeKg:
        current !== null && starting !== null ? round(current - starting, 2) : null,
      weeklyChangeKg:
        weekRef && current !== null
          ? round(current - toNumber(weekRef.weightKg), 2)
          : null,
      monthlyChangeKg:
        monthRef && current !== null
          ? round(current - toNumber(monthRef.weightKg), 2)
          : null,
      remainingToTargetKg:
        target !== null && current !== null ? round(target - current, 2) : null,
      entryCount: all.length,
      lastRecordedDate: latest?.recordedDate ?? null,
    };
  }

  /** Chart-ready weight series for a number of days back. */
  async weightChart(userId: string, days = 90) {
    const from = addDays(toDateOnly(new Date()), -days);
    const logs = await this.prisma.weightLog.findMany({
      where: { userId, recordedDate: { gte: from } },
      orderBy: { recordedDate: 'asc' },
    });

    const points = logs.map((l) => ({
      date: formatDateOnly(l.recordedDate),
      value: toNumber(l.weightKg),
    }));

    const values = points.map((p) => p.value);
    const goal = await this.prisma.fitnessGoal.findFirst({
      where: { userId, status: 'ACTIVE' },
    });

    return {
      points,
      rangeDays: days,
      min: values.length ? round(Math.min(...values), 2) : null,
      max: values.length ? round(Math.max(...values), 2) : null,
      average: values.length
        ? round(values.reduce((a, b) => a + b, 0) / values.length, 2)
        : null,
      targetWeightKg: goal?.targetWeightKg ? toNumber(goal.targetWeightKg) : null,
    };
  }

  // ------------------------------------------------------ measurements

  async addMeasurement(userId: string, dto: CreateMeasurementDto) {
    const recordedDate = toDateOnly(dto.recordedDate);
    const { recordedDate: _ignored, ...values } = dto;

    return this.prisma.bodyMeasurement.upsert({
      where: { userId_recordedDate: { userId, recordedDate } },
      update: values,
      create: { userId, recordedDate, ...values },
    });
  }

  async findMeasurements(userId: string, query: QueryProgressDto) {
    const where: Prisma.BodyMeasurementWhereInput = {
      userId,
      ...(dateRangeFilter(query.fromDate, query.toDate)
        ? { recordedDate: dateRangeFilter(query.fromDate, query.toDate) }
        : {}),
      ...(query.search ? { notes: { contains: query.search } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.bodyMeasurement.findMany({
        where,
        orderBy: { recordedDate: query.sortOrder || 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.bodyMeasurement.count({ where }),
    ]);

    const result = buildPaginatedResult(
      items,
      total,
      query.page || 1,
      query.limit || 20,
    );

    return { ...result, summary: await this.measurementSummary(userId) };
  }

  async findMeasurement(userId: string, id: string) {
    const item = await this.prisma.bodyMeasurement.findFirst({
      where: { id, userId },
    });
    if (!item) throw new NotFoundException('Measurement entry not found');
    return item;
  }

  async updateMeasurement(userId: string, id: string, dto: UpdateMeasurementDto) {
    await this.findMeasurement(userId, id);
    const data: any = { ...dto };
    if (dto.recordedDate) data.recordedDate = toDateOnly(dto.recordedDate);
    return this.prisma.bodyMeasurement.update({ where: { id }, data });
  }

  async removeMeasurement(userId: string, id: string) {
    await this.findMeasurement(userId, id);
    await this.prisma.bodyMeasurement.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Latest values with the change since the first recorded entry. */
  async measurementSummary(userId: string) {
    const [latest, first] = await Promise.all([
      this.prisma.bodyMeasurement.findFirst({
        where: { userId },
        orderBy: { recordedDate: 'desc' },
      }),
      this.prisma.bodyMeasurement.findFirst({
        where: { userId },
        orderBy: { recordedDate: 'asc' },
      }),
    ]);

    if (!latest) {
      return { latest: null, changes: [], recordedDate: null };
    }

    const changes = MEASUREMENT_FIELDS.map((field) => {
      const current = latest[field] !== null ? toNumber(latest[field]) : null;
      const initial =
        first && first[field] !== null ? toNumber(first[field]) : null;
      return {
        field,
        label: this.measurementLabel(field),
        current,
        starting: initial,
        change:
          current !== null && initial !== null ? round(current - initial, 2) : null,
        unit: field === 'bodyFatPercentage' ? '%' : 'cm',
      };
    }).filter((c) => c.current !== null);

    return {
      latest,
      recordedDate: latest.recordedDate,
      changes,
    };
  }

  // ------------------------------------------------------------ photos

  async addPhoto(userId: string, dto: CreateProgressPhotoDto) {
    return this.prisma.progressPhoto.create({
      data: {
        userId,
        photoUrl: dto.photoUrl,
        mediaAssetId: dto.mediaAssetId || null,
        photoType: (dto.photoType as any) || 'FRONT',
        capturedDate: toDateOnly(dto.capturedDate),
        weightKg: dto.weightKg,
        notes: dto.notes,
      },
    });
  }

  async findPhotos(userId: string, query: QueryPhotosDto) {
    const where: Prisma.ProgressPhotoWhereInput = {
      userId,
      ...(query.photoType ? { photoType: query.photoType as any } : {}),
      ...(dateRangeFilter(query.fromDate, query.toDate)
        ? { capturedDate: dateRangeFilter(query.fromDate, query.toDate) }
        : {}),
      ...(query.search ? { notes: { contains: query.search } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.progressPhoto.findMany({
        where,
        orderBy: { capturedDate: query.sortOrder || 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.progressPhoto.count({ where }),
    ]);

    // Group by capture date so the client can render a timeline directly.
    const timelineMap = new Map<string, any[]>();
    for (const photo of items) {
      const key = formatDateOnly(photo.capturedDate);
      if (!timelineMap.has(key)) timelineMap.set(key, []);
      timelineMap.get(key)!.push(photo);
    }

    const result = buildPaginatedResult(
      items,
      total,
      query.page || 1,
      query.limit || 20,
    );

    return {
      ...result,
      timeline: [...timelineMap.entries()].map(([date, photos]) => ({
        date,
        photos,
      })),
    };
  }

  async updatePhoto(userId: string, id: string, dto: UpdateProgressPhotoDto) {
    const existing = await this.prisma.progressPhoto.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Photo not found');

    const data: any = { ...dto };
    if (dto.capturedDate) data.capturedDate = toDateOnly(dto.capturedDate);
    return this.prisma.progressPhoto.update({ where: { id }, data });
  }

  async removePhoto(userId: string, id: string) {
    const existing = await this.prisma.progressPhoto.findFirst({
      where: { id, userId },
      include: { mediaAsset: true },
    });
    if (!existing) throw new NotFoundException('Photo not found');

    await this.prisma.progressPhoto.delete({ where: { id } });

    // The underlying asset is removed too so storage does not accumulate
    // orphaned files.
    if (existing.mediaAssetId) {
      await this.prisma.mediaAsset
        .delete({ where: { id: existing.mediaAssetId } })
        .catch(() => undefined);
    }

    return { id, deleted: true, storageKey: existing.mediaAsset?.storageKey ?? null };
  }

  async comparePhotos(userId: string, dto: ComparePhotosDto) {
    const [first, second] = await Promise.all([
      this.prisma.progressPhoto.findFirst({
        where: { id: dto.firstPhotoId, userId },
      }),
      this.prisma.progressPhoto.findFirst({
        where: { id: dto.secondPhotoId, userId },
      }),
    ]);

    if (!first || !second) {
      throw new NotFoundException('One or both photos were not found');
    }

    const [earlier, later] =
      first.capturedDate <= second.capturedDate ? [first, second] : [second, first];

    const weightChange =
      earlier.weightKg !== null && later.weightKg !== null
        ? round(toNumber(later.weightKg) - toNumber(earlier.weightKg), 2)
        : null;

    return {
      before: earlier,
      after: later,
      daysBetween: daysBetween(earlier.capturedDate, later.capturedDate),
      weightChangeKg: weightChange,
    };
  }

  // ------------------------------------------------------------ helpers

  private measurementLabel(field: string): string {
    const labels: Record<string, string> = {
      chestCm: 'Chest',
      waistCm: 'Waist',
      hipsCm: 'Hips',
      leftArmCm: 'Left Arm',
      rightArmCm: 'Right Arm',
      leftThighCm: 'Left Thigh',
      rightThighCm: 'Right Thigh',
      leftCalfCm: 'Left Calf',
      rightCalfCm: 'Right Calf',
      neckCm: 'Neck',
      shouldersCm: 'Shoulders',
      bodyFatPercentage: 'Body Fat',
    };
    return labels[field] || field;
  }
}
