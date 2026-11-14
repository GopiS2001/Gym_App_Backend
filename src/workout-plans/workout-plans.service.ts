import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import { toDateOnly, weekDayOf, WEEK_DAYS } from '../common/utils/date.util';
import {
  CreateWorkoutPlanDto,
  PlanExerciseDto,
  QueryWorkoutPlansDto,
  ReorderPlanExercisesDto,
  UpdateWorkoutPlanDto,
} from './dto/workout-plan.dto';

const ORDERED_DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

@Injectable()
export class WorkoutPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateWorkoutPlanDto) {
    if (dto.exercises?.length) {
      await this.ensureExercises(userId, dto.exercises.map((e) => e.exerciseId));
    }

    const status = dto.status || 'ACTIVE';
    if (status === 'ACTIVE') {
      await this.prisma.workoutPlan.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      });
    }

    const plan = await this.prisma.workoutPlan.create({
      data: {
        userId,
        planName: dto.planName,
        description: dto.description,
        coverImageUrl: dto.coverImageUrl,
        startDate: dto.startDate ? toDateOnly(dto.startDate) : toDateOnly(new Date()),
        endDate: dto.endDate ? toDateOnly(dto.endDate) : null,
        status: status as any,
        difficultyLevel: (dto.difficultyLevel as any) || 'BEGINNER',
        exercises: dto.exercises?.length
          ? { create: dto.exercises.map((e, i) => this.planExerciseData(e, i)) }
          : undefined,
      },
    });

    return this.findOne(userId, plan.id);
  }

  async findAll(userId: string, query: QueryWorkoutPlansDto) {
    const where: Prisma.WorkoutPlanWhereInput = {
      userId,
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.difficultyLevel
        ? { difficultyLevel: query.difficultyLevel as any }
        : {}),
      ...(query.search
        ? {
            OR: [
              { planName: { contains: query.search } },
              { description: { contains: query.search } },
            ],
          }
        : {}),
    };

    const sortBy = this.safeSortField(query.sortBy);
    const [items, total] = await Promise.all([
      this.prisma.workoutPlan.findMany({
        where,
        orderBy: { [sortBy]: query.sortOrder || 'desc' },
        skip: query.skip,
        take: query.take,
        include: {
          _count: { select: { exercises: true, sessions: true } },
          exercises: { select: { scheduledDay: true } },
        },
      }),
      this.prisma.workoutPlan.count({ where }),
    ]);

    return buildPaginatedResult(
      items.map(({ _count, exercises, ...p }) => ({
        ...p,
        exerciseCount: _count.exercises,
        sessionCount: _count.sessions,
        trainingDays: [...new Set(exercises.map((e) => e.scheduledDay))].sort(
          (a, b) => ORDERED_DAYS.indexOf(a) - ORDERED_DAYS.indexOf(b),
        ),
      })),
      total,
      query.page || 1,
      query.limit || 20,
    );
  }

  async findOne(userId: string, id: string) {
    const plan = await this.prisma.workoutPlan.findFirst({
      where: { id, userId },
      include: {
        exercises: {
          orderBy: [{ scheduledDay: 'asc' }, { displayOrder: 'asc' }],
          include: {
            exercise: {
              include: {
                category: {
                  select: { id: true, name: true, slug: true, colorHex: true },
                },
              },
            },
          },
        },
        _count: { select: { sessions: true } },
      },
    });
    if (!plan) throw new NotFoundException('Workout plan not found');

    const { _count, exercises, ...rest } = plan;

    // Group by weekday so the client can render the weekly schedule directly.
    const schedule = ORDERED_DAYS.map((day) => {
      const dayExercises = exercises
        .filter((e) => e.scheduledDay === day)
        .sort((a, b) => a.displayOrder - b.displayOrder);
      return {
        day,
        dayLabel: day.charAt(0) + day.slice(1).toLowerCase(),
        isRestDay: dayExercises.length === 0,
        exerciseCount: dayExercises.length,
        estimatedMinutes: this.estimateMinutes(dayExercises),
        muscleGroups: [
          ...new Set(dayExercises.map((e) => e.exercise.category?.name).filter(Boolean)),
        ],
        exercises: dayExercises,
      };
    });

    return {
      ...rest,
      sessionCount: _count.sessions,
      exerciseCount: exercises.length,
      exercises,
      schedule,
      todaysWorkout: schedule.find((s) => s.day === weekDayOf(new Date())) || null,
    };
  }

  async update(userId: string, id: string, dto: UpdateWorkoutPlanDto) {
    await this.ensureOwned(userId, id);

    if (dto.status === 'ACTIVE') {
      await this.prisma.workoutPlan.updateMany({
        where: { userId, status: 'ACTIVE', NOT: { id } },
        data: { status: 'ARCHIVED' },
      });
    }

    const { exercises, ...planFields } = dto;
    const data: any = { ...planFields };
    if (dto.startDate !== undefined)
      data.startDate = dto.startDate ? toDateOnly(dto.startDate) : null;
    if (dto.endDate !== undefined)
      data.endDate = dto.endDate ? toDateOnly(dto.endDate) : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.workoutPlan.update({ where: { id }, data });

      // An `exercises` array means "this is the full new schedule".
      if (exercises) {
        await this.ensureExercises(
          userId,
          exercises.map((e) => e.exerciseId),
        );
        await tx.workoutPlanExercise.deleteMany({ where: { workoutPlanId: id } });
        if (exercises.length) {
          await tx.workoutPlanExercise.createMany({
            data: exercises.map((e, i) => ({
              workoutPlanId: id,
              ...this.planExerciseData(e, i),
            })),
          });
        }
      }
    });

    return this.findOne(userId, id);
  }

  async duplicate(userId: string, id: string) {
    const plan = await this.prisma.workoutPlan.findFirst({
      where: { id, userId },
      include: { exercises: true },
    });
    if (!plan) throw new NotFoundException('Workout plan not found');

    const copy = await this.prisma.workoutPlan.create({
      data: {
        userId,
        planName: `${plan.planName} (Copy)`,
        description: plan.description,
        coverImageUrl: plan.coverImageUrl,
        startDate: toDateOnly(new Date()),
        status: 'DRAFT',
        difficultyLevel: plan.difficultyLevel,
        exercises: {
          create: plan.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            scheduledDay: e.scheduledDay,
            displayOrder: e.displayOrder,
            targetSets: e.targetSets,
            targetReps: e.targetReps,
            targetWeightKg: e.targetWeightKg,
            restSeconds: e.restSeconds,
            notes: e.notes,
          })),
        },
      },
    });

    return this.findOne(userId, copy.id);
  }

  async activate(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.workoutPlan.updateMany({
      where: { userId, status: 'ACTIVE', NOT: { id } },
      data: { status: 'ARCHIVED' },
    });
    await this.prisma.workoutPlan.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
    return this.findOne(userId, id);
  }

  async archive(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.workoutPlan.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.workoutPlan.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ---------------------------------------------------- plan exercise CRUD

  async addExercise(userId: string, planId: string, dto: PlanExerciseDto) {
    await this.ensureOwned(userId, planId);
    await this.ensureExercises(userId, [dto.exerciseId]);

    const maxOrder = await this.prisma.workoutPlanExercise.aggregate({
      where: { workoutPlanId: planId, scheduledDay: dto.scheduledDay as any },
      _max: { displayOrder: true },
    });

    await this.prisma.workoutPlanExercise.create({
      data: {
        workoutPlanId: planId,
        ...this.planExerciseData(dto, (maxOrder._max.displayOrder ?? -1) + 1),
      },
    });

    return this.findOne(userId, planId);
  }

  async updateExercise(
    userId: string,
    planId: string,
    planExerciseId: string,
    dto: Partial<PlanExerciseDto>,
  ) {
    await this.ensureOwned(userId, planId);
    const existing = await this.prisma.workoutPlanExercise.findFirst({
      where: { id: planExerciseId, workoutPlanId: planId },
    });
    if (!existing) throw new NotFoundException('Exercise not found in this plan');

    await this.prisma.workoutPlanExercise.update({
      where: { id: planExerciseId },
      data: {
        exerciseId: dto.exerciseId,
        scheduledDay: dto.scheduledDay as any,
        displayOrder: dto.displayOrder,
        targetSets: dto.targetSets,
        targetReps: dto.targetReps,
        targetWeightKg: dto.targetWeightKg,
        restSeconds: dto.restSeconds,
        notes: dto.notes,
      },
    });

    return this.findOne(userId, planId);
  }

  async removeExercise(userId: string, planId: string, planExerciseId: string) {
    await this.ensureOwned(userId, planId);
    const existing = await this.prisma.workoutPlanExercise.findFirst({
      where: { id: planExerciseId, workoutPlanId: planId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Exercise not found in this plan');

    await this.prisma.workoutPlanExercise.delete({ where: { id: planExerciseId } });
    return this.findOne(userId, planId);
  }

  async reorderExercises(
    userId: string,
    planId: string,
    dto: ReorderPlanExercisesDto,
  ) {
    await this.ensureOwned(userId, planId);

    const rows = await this.prisma.workoutPlanExercise.findMany({
      where: { id: { in: dto.orderedIds }, workoutPlanId: planId },
      select: { id: true },
    });
    if (rows.length !== dto.orderedIds.length) {
      throw new BadRequestException('One or more exercises do not belong to this plan');
    }

    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.workoutPlanExercise.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );

    return this.findOne(userId, planId);
  }

  /** The schedule entry for a given weekday of the active plan. */
  async todaysPlan(userId: string, day?: string) {
    const plan = await this.prisma.workoutPlan.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!plan) return null;

    const full = await this.findOne(userId, plan.id);
    const targetDay = (day || weekDayOf(new Date())).toUpperCase();
    const entry = full.schedule.find((s) => s.day === targetDay) || null;

    return {
      planId: full.id,
      planName: full.planName,
      day: targetDay,
      ...(entry || { isRestDay: true, exercises: [], exerciseCount: 0 }),
    };
  }

  getWeekDays() {
    return ORDERED_DAYS.map((d) => ({
      value: d,
      label: d.charAt(0) + d.slice(1).toLowerCase(),
    }));
  }

  // ------------------------------------------------------------ helpers

  private planExerciseData(e: PlanExerciseDto, fallbackOrder: number) {
    return {
      exerciseId: e.exerciseId,
      scheduledDay: e.scheduledDay as any,
      displayOrder: e.displayOrder ?? fallbackOrder,
      targetSets: e.targetSets ?? 3,
      targetReps: e.targetReps ?? 12,
      targetWeightKg: e.targetWeightKg,
      restSeconds: e.restSeconds ?? 60,
      notes: e.notes,
    };
  }

  private safeSortField(field?: string): string {
    const allowed = ['createdAt', 'planName', 'startDate', 'status', 'updatedAt'];
    return allowed.includes(field || '') ? field! : 'createdAt';
  }

  private estimateMinutes(exercises: any[]): number {
    // ~45s per set of work plus the configured rest between sets.
    const seconds = exercises.reduce(
      (sum, e) => sum + e.targetSets * (45 + (e.restSeconds ?? 60)),
      0,
    );
    return Math.round(seconds / 60);
  }

  private async ensureOwned(userId: string, id: string) {
    const plan = await this.prisma.workoutPlan.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!plan) throw new NotFoundException('Workout plan not found');
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
}
