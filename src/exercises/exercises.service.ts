import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import { estimateOneRepMax, round, toNumber } from '../common/utils/fitness.util';
import {
  CreateExerciseDto,
  QueryExercisesDto,
  UpdateExerciseDto,
} from './dto/exercise.dto';

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateExerciseDto) {
    await this.ensureCategory(userId, dto.categoryId);

    const exercise = await this.prisma.exercise.create({
      data: {
        userId,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        instructions: dto.instructions,
        targetMuscle: dto.targetMuscle,
        secondaryMuscles: dto.secondaryMuscles ?? [],
        equipment: dto.equipment,
        difficultyLevel: (dto.difficultyLevel as any) || 'BEGINNER',
        ...this.mediaFields(dto),
        videoUrl: dto.videoUrl?.trim() || null,
        backgroundImageUrl: dto.backgroundImageUrl?.trim() || null,
        caloriesPerMin: dto.caloriesPerMin,
        isCustom: true,
      },
      include: { category: true },
    });

    return { ...exercise, isFavourite: false };
  }

  async findAll(userId: string, query: QueryExercisesDto) {
    const and: Prisma.ExerciseWhereInput[] = [
      { OR: [{ userId: null }, { userId }] },
      { isActive: true },
    ];

    if (query.categoryId) and.push({ categoryId: query.categoryId });
    if (query.categorySlug) and.push({ category: { slug: query.categorySlug } });
    if (query.difficultyLevel) and.push({ difficultyLevel: query.difficultyLevel as any });
    if (query.equipment) and.push({ equipment: { contains: query.equipment } });
    if (query.targetMuscle) and.push({ targetMuscle: { contains: query.targetMuscle } });
    if (query.isCustom !== undefined) and.push({ isCustom: query.isCustom });
    if (query.favouritesOnly) and.push({ favourites: { some: { userId } } });

    if (query.search) {
      and.push({
        OR: [
          { name: { contains: query.search } },
          { description: { contains: query.search } },
          { targetMuscle: { contains: query.search } },
          { equipment: { contains: query.search } },
          { category: { name: { contains: query.search } } },
        ],
      });
    }

    const where: Prisma.ExerciseWhereInput = { AND: and };
    const sortBy = this.safeSortField(query.sortBy);

    const [items, total] = await Promise.all([
      this.prisma.exercise.findMany({
        where,
        orderBy: { [sortBy]: query.sortOrder || (sortBy === 'name' ? 'asc' : 'desc') },
        skip: query.skip,
        take: query.take,
        include: {
          category: { select: { id: true, name: true, slug: true, colorHex: true } },
          favourites: { where: { userId }, select: { id: true } },
        },
      }),
      this.prisma.exercise.count({ where }),
    ]);

    return buildPaginatedResult(
      items.map(({ favourites, ...e }) => ({
        ...e,
        isFavourite: favourites.length > 0,
      })),
      total,
      query.page || 1,
      query.limit || 20,
    );
  }

  async findOne(userId: string, id: string) {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
      include: {
        category: true,
        favourites: { where: { userId }, select: { id: true } },
      },
    });
    if (!exercise) throw new NotFoundException('Exercise not found');

    const { favourites, ...rest } = exercise;
    const history = await this.exerciseHistory(userId, id, 10);

    return {
      ...rest,
      isFavourite: favourites.length > 0,
      ...history,
    };
  }

  async update(userId: string, id: string, dto: UpdateExerciseDto) {
    const existing = await this.prisma.exercise.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Exercise not found');

    // Built-in exercises belong to no user; copying them on edit would be
    // surprising, so they are editable but their origin is preserved.
    if (existing.userId && existing.userId !== userId) {
      throw new NotFoundException('Exercise not found');
    }
    if (dto.categoryId) await this.ensureCategory(userId, dto.categoryId);

    const data: any = { ...dto, ...this.mediaFields(dto) };
    if (dto.secondaryMuscles !== undefined) {
      data.secondaryMuscles = dto.secondaryMuscles;
    }
    // An empty string clears the video rather than storing "".
    if (dto.videoUrl !== undefined) data.videoUrl = dto.videoUrl.trim() || null;
    if (dto.backgroundImageUrl !== undefined) {
      data.backgroundImageUrl = dto.backgroundImageUrl.trim() || null;
    }

    const exercise = await this.prisma.exercise.update({
      where: { id },
      data,
      include: {
        category: true,
        favourites: { where: { userId }, select: { id: true } },
      },
    });

    const { favourites, ...rest } = exercise;
    return { ...rest, isFavourite: favourites.length > 0 };
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.exercise.findFirst({
      where: { id },
      include: {
        _count: { select: { sessionExercises: true, planExercises: true } },
      },
    });
    if (!existing) throw new NotFoundException('Exercise not found');
    if (existing.userId && existing.userId !== userId) {
      throw new NotFoundException('Exercise not found');
    }

    // Exercises already used in a session are soft-deleted so the recorded
    // history keeps its exercise reference.
    if (existing._count.sessionExercises > 0) {
      await this.prisma.exercise.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        id,
        deleted: true,
        softDeleted: true,
        reason: 'Exercise is used in recorded workouts, so it was archived instead.',
      };
    }

    await this.prisma.exercise.delete({ where: { id } });
    return { id, deleted: true, softDeleted: false };
  }

  async toggleFavourite(userId: string, id: string) {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
      select: { id: true },
    });
    if (!exercise) throw new NotFoundException('Exercise not found');

    const existing = await this.prisma.exerciseFavourite.findUnique({
      where: { userId_exerciseId: { userId, exerciseId: id } },
    });

    if (existing) {
      await this.prisma.exerciseFavourite.delete({ where: { id: existing.id } });
      return { exerciseId: id, isFavourite: false };
    }

    await this.prisma.exerciseFavourite.create({
      data: { userId, exerciseId: id },
    });
    return { exerciseId: id, isFavourite: true };
  }

  /** Distinct equipment and muscle values, for building filter chips. */
  async getFilterOptions(userId: string) {
    const exercises = await this.prisma.exercise.findMany({
      where: { OR: [{ userId: null }, { userId }], isActive: true },
      select: { equipment: true, targetMuscle: true },
    });

    const equipment = [
      ...new Set(exercises.map((e) => e.equipment).filter(Boolean)),
    ].sort();
    const targetMuscles = [
      ...new Set(exercises.map((e) => e.targetMuscle).filter(Boolean)),
    ].sort();

    return {
      equipment,
      targetMuscles,
      difficultyLevels: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
    };
  }

  /** Recorded performance for one exercise, newest first. */
  async exerciseHistory(userId: string, exerciseId: string, limit = 20) {
    const sessionExercises = await this.prisma.sessionExercise.findMany({
      where: {
        exerciseId,
        session: { userId, status: 'COMPLETED' },
      },
      include: {
        sets: { orderBy: { setNumber: 'asc' } },
        session: { select: { id: true, sessionDate: true, title: true } },
      },
      orderBy: { session: { sessionDate: 'desc' } },
      take: limit,
    });

    const history = sessionExercises.map((se) => {
      const completed = se.sets.filter((s) => s.completed);
      const volume = completed.reduce(
        (sum, s) => sum + toNumber(s.reps) * toNumber(s.weightKg),
        0,
      );
      const best = completed.reduce(
        (max, s) => (toNumber(s.weightKg) > toNumber(max?.weightKg ?? 0) ? s : max),
        completed[0],
      );
      return {
        sessionId: se.session.id,
        sessionDate: se.session.sessionDate,
        sessionTitle: se.session.title,
        setCount: completed.length,
        totalReps: completed.reduce((sum, s) => sum + s.reps, 0),
        totalVolumeKg: round(volume, 2),
        bestWeightKg: best ? toNumber(best.weightKg) : 0,
        bestReps: best ? best.reps : 0,
        sets: completed.map((s) => ({
          setNumber: s.setNumber,
          reps: s.reps,
          weightKg: toNumber(s.weightKg),
        })),
      };
    });

    const allBest = history.reduce(
      (max, h) => (h.bestWeightKg > max.bestWeightKg ? h : max),
      { bestWeightKg: 0, bestReps: 0 } as any,
    );

    return {
      history,
      lastPerformance: history[0] || null,
      personalRecord:
        allBest.bestWeightKg > 0
          ? {
              weightKg: allBest.bestWeightKg,
              reps: allBest.bestReps,
              estimatedOneRepMaxKg: estimateOneRepMax(
                allBest.bestWeightKg,
                allBest.bestReps,
              ),
              isEstimate: true,
            }
          : null,
      bestVolumeKg: history.reduce((max, h) => Math.max(max, h.totalVolumeKg), 0),
    };
  }

  // ------------------------------------------------------------ helpers

  /**
   * Keeps `imageUrl` (the cover, read all over the app) in step with the
   * `imageUrls` gallery. The cover is always the gallery's first image.
   * A client that only sends `imageUrl` still works: it becomes a one-image
   * gallery.
   */
  private mediaFields(dto: { imageUrl?: string; imageUrls?: string[] }) {
    if (dto.imageUrls !== undefined) {
      const urls = [...new Set(dto.imageUrls.map((u) => u.trim()).filter(Boolean))];
      return { imageUrls: urls, imageUrl: urls[0] ?? null };
    }
    if (dto.imageUrl !== undefined) {
      const url = dto.imageUrl.trim();
      return { imageUrl: url || null, imageUrls: url ? [url] : [] };
    }
    return {};
  }

  private async ensureCategory(userId: string, categoryId: string) {
    const category = await this.prisma.workoutCategory.findFirst({
      where: { id: categoryId, OR: [{ userId: null }, { userId }] },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException('The selected category does not exist');
    }
  }

  private safeSortField(field?: string): string {
    const allowed = ['name', 'createdAt', 'difficultyLevel', 'targetMuscle'];
    return allowed.includes(field || '') ? field! : 'name';
  }
}
