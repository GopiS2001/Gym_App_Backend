import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import { dateRangeFilter, toDateOnly, weekDayOf } from '../common/utils/date.util';
import {
  completionPercentage,
  estimateCaloriesBurned,
  estimateOneRepMax,
  round,
  toNumber,
} from '../common/utils/fitness.util';
import {
  AddSessionExerciseDto,
  CompleteSessionDto,
  QuerySessionsDto,
  RecordSetDto,
  ReorderSessionExercisesDto,
  StartSessionDto,
  UpdateSessionDto,
  UpdateSetDto,
} from './dto/workout-session.dto';

const SESSION_INCLUDE = {
  plan: { select: { id: true, planName: true } },
  exercises: {
    orderBy: { displayOrder: 'asc' as const },
    include: {
      sets: { orderBy: { setNumber: 'asc' as const } },
      exercise: {
        include: {
          category: { select: { id: true, name: true, slug: true, colorHex: true } },
        },
      },
    },
  },
};

@Injectable()
export class WorkoutSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------ lifecycle

  async start(userId: string, dto: StartSessionDto) {
    // Offline clients retry with the same key; return the original session
    // rather than creating a duplicate.
    if (dto.clientOpId) {
      const existing = await this.prisma.workoutSession.findFirst({
        where: { userId, clientOpId: dto.clientOpId },
      });
      if (existing) return this.findOne(userId, existing.id);
    }

    const active = await this.prisma.workoutSession.findFirst({
      where: { userId, status: { in: ['IN_PROGRESS', 'PAUSED'] } },
    });
    if (active) {
      throw new BadRequestException(
        'A workout is already in progress. Finish or cancel it before starting another.',
      );
    }

    const sessionDate = toDateOnly(dto.sessionDate);
    let title = dto.title;
    let exerciseRows: Array<{
      exerciseId: string;
      targetSets: number;
      targetReps: number;
      restSeconds: number;
    }> = [];

    if (dto.workoutPlanId) {
      const plan = await this.prisma.workoutPlan.findFirst({
        where: { id: dto.workoutPlanId, userId },
        include: {
          exercises: {
            include: { exercise: { include: { category: true } } },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
      if (!plan) throw new NotFoundException('Workout plan not found');

      const day = (dto.scheduledDay || weekDayOf(sessionDate)).toUpperCase();
      const dayExercises = plan.exercises.filter((e) => e.scheduledDay === day);

      if (!dayExercises.length && !dto.exerciseIds?.length) {
        throw new BadRequestException(
          `The plan "${plan.planName}" has no exercises scheduled for ${day.toLowerCase()}.`,
        );
      }

      exerciseRows = dayExercises.map((e) => ({
        exerciseId: e.exerciseId,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        restSeconds: e.restSeconds,
      }));

      if (!title) {
        const groups = [
          ...new Set(dayExercises.map((e) => e.exercise.category?.name).filter(Boolean)),
        ];
        title = groups.length ? groups.join(' + ') : plan.planName;
      }
    }

    if (dto.exerciseIds?.length) {
      await this.ensureExercises(userId, dto.exerciseIds);
      const known = new Set(exerciseRows.map((r) => r.exerciseId));
      for (const exerciseId of dto.exerciseIds) {
        if (!known.has(exerciseId)) {
          exerciseRows.push({
            exerciseId,
            targetSets: 3,
            targetReps: 12,
            restSeconds: 60,
          });
        }
      }
    }

    const session = await this.prisma.workoutSession.create({
      data: {
        userId,
        workoutPlanId: dto.workoutPlanId || null,
        title: title || 'Free Workout',
        sessionDate,
        startedAt: new Date(),
        status: 'IN_PROGRESS',
        notes: dto.notes,
        clientOpId: dto.clientOpId || null,
        exercises: {
          create: exerciseRows.map((row, index) => ({
            exerciseId: row.exerciseId,
            displayOrder: index,
            targetSets: row.targetSets,
            targetReps: row.targetReps,
            restSeconds: row.restSeconds,
            status: 'PENDING',
          })),
        },
      },
    });

    // Starting a workout implies being at the gym today.
    await this.ensureAttendance(userId, sessionDate);

    return this.findOne(userId, session.id);
  }

  async complete(userId: string, id: string, dto: CompleteSessionDto) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id, userId },
      include: { exercises: { include: { sets: true } } },
    });
    if (!session) throw new NotFoundException('Workout session not found');
    if (session.status === 'COMPLETED') {
      return this.findOne(userId, id);
    }

    const completedAt = new Date();
    const durationSeconds =
      dto.durationSeconds ??
      Math.max(
        0,
        Math.round((completedAt.getTime() - session.startedAt.getTime()) / 1000),
      );

    const allSets = session.exercises.flatMap((e) => e.sets);
    const volume = allSets
      .filter((s) => s.completed)
      .reduce((sum, s) => sum + toNumber(s.reps) * toNumber(s.weightKg), 0);

    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const bodyWeight = toNumber(profile?.currentWeightKg, 70);

    await this.prisma.$transaction(async (tx) => {
      // An exercise with at least one completed set counts as done;
      // one that was opened but never completed is marked skipped.
      for (const exercise of session.exercises) {
        const hasCompleted = exercise.sets.some((s) => s.completed);
        await tx.sessionExercise.update({
          where: { id: exercise.id },
          data: { status: hasCompleted ? 'COMPLETED' : 'SKIPPED' },
        });
      }

      await tx.workoutSession.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt,
          durationSeconds,
          totalVolumeKg: round(volume, 2),
          caloriesBurned: estimateCaloriesBurned(durationSeconds, bodyWeight, 5),
          notes: dto.notes ?? session.notes,
        },
      });

      // Close out the gym visit started with this session.
      const attendance = await tx.gymAttendance.findUnique({
        where: {
          userId_attendanceDate: { userId, attendanceDate: session.sessionDate },
        },
      });
      if (attendance && !attendance.checkOutAt) {
        await tx.gymAttendance.update({
          where: { id: attendance.id },
          data: {
            checkOutAt: completedAt,
            durationMinutes: Math.round(
              (completedAt.getTime() - attendance.checkInAt.getTime()) / 60000,
            ),
          },
        });
      }
    });

    return this.findOne(userId, id);
  }

  async cancel(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.workoutSession.update({
      where: { id },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    return this.findOne(userId, id);
  }

  async pause(userId: string, id: string) {
    const session = await this.ensureOwned(userId, id);
    if (session.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Only an in-progress workout can be paused');
    }
    await this.prisma.workoutSession.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
    return this.findOne(userId, id);
  }

  async resume(userId: string, id: string) {
    const session = await this.ensureOwned(userId, id);
    if (session.status !== 'PAUSED') {
      throw new BadRequestException('Only a paused workout can be resumed');
    }
    await this.prisma.workoutSession.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });
    return this.findOne(userId, id);
  }

  async update(userId: string, id: string, dto: UpdateSessionDto) {
    await this.ensureOwned(userId, id);
    await this.prisma.workoutSession.update({
      where: { id },
      data: {
        title: dto.title,
        notes: dto.notes,
        status: dto.status as any,
        durationSeconds: dto.durationSeconds,
      },
    });
    return this.findOne(userId, id);
  }

  // ------------------------------------------------------------ reads

  async findAll(userId: string, query: QuerySessionsDto) {
    const where: Prisma.WorkoutSessionWhereInput = {
      userId,
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.workoutPlanId ? { workoutPlanId: query.workoutPlanId } : {}),
      ...(query.exerciseId
        ? { exercises: { some: { exerciseId: query.exerciseId } } }
        : {}),
      ...(dateRangeFilter(query.fromDate, query.toDate)
        ? { sessionDate: dateRangeFilter(query.fromDate, query.toDate) }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search } },
              { notes: { contains: query.search } },
              { plan: { planName: { contains: query.search } } },
              { exercises: { some: { exercise: { name: { contains: query.search } } } } },
            ],
          }
        : {}),
    };

    const sortBy = this.safeSortField(query.sortBy);
    const [items, total] = await Promise.all([
      this.prisma.workoutSession.findMany({
        where,
        orderBy: { [sortBy]: query.sortOrder || 'desc' },
        skip: query.skip,
        take: query.take,
        include: {
          plan: { select: { id: true, planName: true } },
          exercises: {
            include: {
              sets: true,
              exercise: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                  category: { select: { name: true, colorHex: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.workoutSession.count({ where }),
    ]);

    return buildPaginatedResult(
      items.map((s) => this.summarise(s)),
      total,
      query.page || 1,
      query.limit || 20,
    );
  }

  async findOne(userId: string, id: string) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id, userId },
      include: SESSION_INCLUDE,
    });
    if (!session) throw new NotFoundException('Workout session not found');

    // Attach the previous recorded performance per exercise so the client can
    // show "last time" without extra round-trips.
    const exercises = await Promise.all(
      session.exercises.map(async (se) => {
        const previous = await this.previousPerformance(
          userId,
          se.exerciseId,
          session.id,
        );
        const completedSets = se.sets.filter((s) => s.completed);
        return {
          ...se,
          completedSetCount: completedSets.length,
          totalVolumeKg: round(
            completedSets.reduce(
              (sum, s) => sum + toNumber(s.reps) * toNumber(s.weightKg),
              0,
            ),
            2,
          ),
          bestSet: completedSets.length
            ? completedSets.reduce((best, s) =>
                toNumber(s.weightKg) > toNumber(best.weightKg) ? s : best,
              )
            : null,
          previousPerformance: previous,
        };
      }),
    );

    return { ...this.summarise(session), exercises };
  }

  /** The workout currently open, if any — used to restore after app restart. */
  async findActive(userId: string) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { userId, status: { in: ['IN_PROGRESS', 'PAUSED'] } },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });
    if (!session) return null;
    return this.findOne(userId, session.id);
  }

  async findToday(userId: string) {
    const today = toDateOnly(new Date());
    const sessions = await this.prisma.workoutSession.findMany({
      where: { userId, sessionDate: today },
      orderBy: { startedAt: 'desc' },
      include: SESSION_INCLUDE,
    });
    return sessions.map((s) => this.summarise(s));
  }

  // ------------------------------------------------------ session exercises

  async addExercise(userId: string, sessionId: string, dto: AddSessionExerciseDto) {
    await this.ensureOwned(userId, sessionId);
    await this.ensureExercises(userId, [dto.exerciseId]);

    const max = await this.prisma.sessionExercise.aggregate({
      where: { workoutSessionId: sessionId },
      _max: { displayOrder: true },
    });

    await this.prisma.sessionExercise.create({
      data: {
        workoutSessionId: sessionId,
        exerciseId: dto.exerciseId,
        displayOrder: (max._max.displayOrder ?? -1) + 1,
        targetSets: dto.targetSets ?? 3,
        targetReps: dto.targetReps ?? 12,
        restSeconds: dto.restSeconds ?? 60,
        notes: dto.notes,
        status: 'PENDING',
      },
    });

    return this.findOne(userId, sessionId);
  }

  async removeExercise(userId: string, sessionId: string, sessionExerciseId: string) {
    await this.ensureOwned(userId, sessionId);
    const row = await this.prisma.sessionExercise.findFirst({
      where: { id: sessionExerciseId, workoutSessionId: sessionId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Exercise not found in this workout');

    await this.prisma.sessionExercise.delete({ where: { id: sessionExerciseId } });
    return this.findOne(userId, sessionId);
  }

  async reorderExercises(
    userId: string,
    sessionId: string,
    dto: ReorderSessionExercisesDto,
  ) {
    await this.ensureOwned(userId, sessionId);
    const rows = await this.prisma.sessionExercise.findMany({
      where: { id: { in: dto.orderedIds }, workoutSessionId: sessionId },
      select: { id: true },
    });
    if (rows.length !== dto.orderedIds.length) {
      throw new BadRequestException('One or more exercises are not in this workout');
    }

    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.sessionExercise.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );

    return this.findOne(userId, sessionId);
  }

  async skipExercise(userId: string, sessionId: string, sessionExerciseId: string) {
    await this.ensureOwned(userId, sessionId);
    const row = await this.prisma.sessionExercise.findFirst({
      where: { id: sessionExerciseId, workoutSessionId: sessionId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Exercise not found in this workout');

    await this.prisma.sessionExercise.update({
      where: { id: sessionExerciseId },
      data: { status: 'SKIPPED' },
    });
    return this.findOne(userId, sessionId);
  }

  // ------------------------------------------------------------ sets

  async recordSet(userId: string, sessionId: string, dto: RecordSetDto) {
    await this.ensureOwned(userId, sessionId);

    const sessionExercise = await this.prisma.sessionExercise.findFirst({
      where: { id: dto.sessionExerciseId, workoutSessionId: sessionId },
      include: { sets: { orderBy: { setNumber: 'desc' }, take: 1 } },
    });
    if (!sessionExercise) {
      throw new NotFoundException('Exercise not found in this workout');
    }

    const setNumber =
      dto.setNumber ?? (sessionExercise.sets[0]?.setNumber ?? 0) + 1;

    // Re-recording the same set number updates it rather than duplicating.
    const existing = await this.prisma.sessionSet.findFirst({
      where: { sessionExerciseId: dto.sessionExerciseId, setNumber },
    });

    const payload = {
      reps: dto.reps,
      weightKg: dto.weightKg,
      completed: dto.completed ?? true,
      restSeconds: dto.restSeconds ?? sessionExercise.restSeconds,
      notes: dto.notes,
    };

    if (existing) {
      await this.prisma.sessionSet.update({ where: { id: existing.id }, data: payload });
    } else {
      await this.prisma.sessionSet.create({
        data: {
          sessionExerciseId: dto.sessionExerciseId,
          setNumber,
          ...payload,
        },
      });
    }

    await this.prisma.sessionExercise.update({
      where: { id: dto.sessionExerciseId },
      data: { status: 'IN_PROGRESS' },
    });
    await this.recalculateVolume(sessionId);

    return this.findOne(userId, sessionId);
  }

  async updateSet(userId: string, sessionId: string, setId: string, dto: UpdateSetDto) {
    await this.ensureOwned(userId, sessionId);

    const set = await this.prisma.sessionSet.findFirst({
      where: { id: setId, sessionExercise: { workoutSessionId: sessionId } },
      select: { id: true },
    });
    if (!set) throw new NotFoundException('Set not found in this workout');

    await this.prisma.sessionSet.update({ where: { id: setId }, data: { ...dto } });
    await this.recalculateVolume(sessionId);

    return this.findOne(userId, sessionId);
  }

  async deleteSet(userId: string, sessionId: string, setId: string) {
    await this.ensureOwned(userId, sessionId);

    const set = await this.prisma.sessionSet.findFirst({
      where: { id: setId, sessionExercise: { workoutSessionId: sessionId } },
      select: { id: true },
    });
    if (!set) throw new NotFoundException('Set not found in this workout');

    await this.prisma.sessionSet.delete({ where: { id: setId } });
    await this.recalculateVolume(sessionId);

    return this.findOne(userId, sessionId);
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.workoutSession.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ------------------------------------------------------------ helpers

  private async ensureOwned(userId: string, id: string) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id, userId },
    });
    if (!session) throw new NotFoundException('Workout session not found');
    return session;
  }

  private async ensureExercises(userId: string, exerciseIds: string[]) {
    const unique = [...new Set(exerciseIds)];
    const count = await this.prisma.exercise.count({
      where: { id: { in: unique }, OR: [{ userId: null }, { userId }] },
    });
    if (count !== unique.length) {
      throw new BadRequestException('One or more selected exercises do not exist');
    }
  }

  private async ensureAttendance(userId: string, date: Date) {
    const existing = await this.prisma.gymAttendance.findUnique({
      where: { userId_attendanceDate: { userId, attendanceDate: date } },
    });
    if (!existing) {
      await this.prisma.gymAttendance.create({
        data: {
          userId,
          attendanceDate: date,
          checkInAt: new Date(),
          notes: 'Auto check-in from workout start',
        },
      });
    }
  }

  private async recalculateVolume(sessionId: string) {
    const sets = await this.prisma.sessionSet.findMany({
      where: { sessionExercise: { workoutSessionId: sessionId }, completed: true },
      select: { reps: true, weightKg: true },
    });
    const volume = sets.reduce(
      (sum, s) => sum + toNumber(s.reps) * toNumber(s.weightKg),
      0,
    );
    await this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: { totalVolumeKg: round(volume, 2) },
    });
  }

  /** Most recent completed performance of an exercise, excluding this session. */
  private async previousPerformance(
    userId: string,
    exerciseId: string,
    excludeSessionId: string,
  ) {
    const previous = await this.prisma.sessionExercise.findFirst({
      where: {
        exerciseId,
        workoutSessionId: { not: excludeSessionId },
        session: { userId, status: 'COMPLETED' },
      },
      include: {
        sets: { where: { completed: true }, orderBy: { setNumber: 'asc' } },
        session: { select: { sessionDate: true } },
      },
      orderBy: { session: { sessionDate: 'desc' } },
    });

    if (!previous || !previous.sets.length) return null;

    const best = previous.sets.reduce((max, s) =>
      toNumber(s.weightKg) > toNumber(max.weightKg) ? s : max,
    );

    return {
      sessionDate: previous.session.sessionDate,
      setCount: previous.sets.length,
      totalVolumeKg: round(
        previous.sets.reduce(
          (sum, s) => sum + toNumber(s.reps) * toNumber(s.weightKg),
          0,
        ),
        2,
      ),
      bestWeightKg: toNumber(best.weightKg),
      bestReps: best.reps,
      estimatedOneRepMaxKg: estimateOneRepMax(toNumber(best.weightKg), best.reps),
      sets: previous.sets.map((s) => ({
        setNumber: s.setNumber,
        reps: s.reps,
        weightKg: toNumber(s.weightKg),
      })),
    };
  }

  private summarise(session: any) {
    const exercises = session.exercises || [];
    const allSets = exercises.flatMap((e: any) => e.sets || []);
    const completedSets = allSets.filter((s: any) => s.completed);
    const completedExercises = exercises.filter((e: any) =>
      (e.sets || []).some((s: any) => s.completed),
    ).length;

    const volume = completedSets.reduce(
      (sum: number, s: any) => sum + toNumber(s.reps) * toNumber(s.weightKg),
      0,
    );

    return {
      ...session,
      exerciseCount: exercises.length,
      completedExerciseCount: completedExercises,
      totalSets: allSets.length,
      completedSets: completedSets.length,
      totalReps: completedSets.reduce((sum: number, s: any) => sum + s.reps, 0),
      totalVolumeKg: round(volume, 2),
      completionPercentage: completionPercentage(completedExercises, exercises.length),
      durationMinutes: Math.round((session.durationSeconds || 0) / 60),
      muscleGroups: [
        ...new Set(
          exercises.map((e: any) => e.exercise?.category?.name).filter(Boolean),
        ),
      ],
    };
  }

  private safeSortField(field?: string): string {
    const allowed = [
      'sessionDate',
      'startedAt',
      'completedAt',
      'durationSeconds',
      'totalVolumeKg',
      'createdAt',
    ];
    return allowed.includes(field || '') ? field! : 'sessionDate';
  }
}
