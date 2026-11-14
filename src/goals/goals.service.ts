import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import { daysBetween, toDateOnly } from '../common/utils/date.util';
import { goalProgressPercentage, round, toNumber } from '../common/utils/fitness.util';
import { CreateGoalDto, QueryGoalsDto, UpdateGoalDto } from './dto/goal.dto';

/** Goal types are rows now, so the relation comes along on every read. */
const GOAL_INCLUDE = {
  goalType: {
    select: {
      id: true,
      name: true,
      slug: true,
      iconName: true,
      colorHex: true,
      isCustom: true,
    },
  },
};

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateGoalDto) {
    await this.ensureGoalType(userId, dto.goalTypeId);

    const status = dto.status || 'ACTIVE';

    // Only one goal may be ACTIVE at a time; the previous one is paused.
    if (status === 'ACTIVE') {
      await this.prisma.fitnessGoal.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'PAUSED' },
      });
    }

    const startingWeight =
      dto.startingWeightKg ?? (await this.latestWeight(userId)) ?? undefined;

    const type = await this.prisma.goalType.findUnique({
      where: { id: dto.goalTypeId },
      select: { name: true },
    });

    const goal = await this.prisma.fitnessGoal.create({
      data: {
        userId,
        goalTypeId: dto.goalTypeId,
        title: dto.title || type?.name,
        startingWeightKg: startingWeight,
        targetWeightKg: dto.targetWeightKg,
        targetBodyFatPercentage: dto.targetBodyFatPercentage,
        startDate: toDateOnly(dto.startDate),
        targetDate: dto.targetDate ? toDateOnly(dto.targetDate) : null,
        status: status as any,
        notes: dto.notes,
      },
      include: GOAL_INCLUDE,
    });

    return this.decorate(goal, await this.latestWeight(userId));
  }

  async findAll(userId: string, query: QueryGoalsDto) {
    const where: Prisma.FitnessGoalWhereInput = {
      userId,
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.goalTypeId ? { goalTypeId: query.goalTypeId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search } },
              { notes: { contains: query.search } },
              { goalType: { name: { contains: query.search } } },
            ],
          }
        : {}),
    };

    const sortBy = this.safeSortField(query.sortBy);
    const [items, total, currentWeight] = await Promise.all([
      this.prisma.fitnessGoal.findMany({
        where,
        orderBy: { [sortBy]: query.sortOrder || 'desc' },
        skip: query.skip,
        take: query.take,
        include: GOAL_INCLUDE,
      }),
      this.prisma.fitnessGoal.count({ where }),
      this.latestWeight(userId),
    ]);

    return buildPaginatedResult(
      items.map((g) => this.decorate(g, currentWeight)),
      total,
      query.page || 1,
      query.limit || 20,
    );
  }

  async findActive(userId: string) {
    const goal = await this.prisma.fitnessGoal.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: GOAL_INCLUDE,
    });
    if (!goal) return null;
    return this.decorate(goal, await this.latestWeight(userId));
  }

  async findOne(userId: string, id: string) {
    const goal = await this.prisma.fitnessGoal.findFirst({
      where: { id, userId },
      include: GOAL_INCLUDE,
    });
    if (!goal) throw new NotFoundException('Goal not found');
    return this.decorate(goal, await this.latestWeight(userId));
  }

  async update(userId: string, id: string, dto: UpdateGoalDto) {
    await this.ensureOwned(userId, id);
    if (dto.goalTypeId) await this.ensureGoalType(userId, dto.goalTypeId);

    if (dto.status === 'ACTIVE') {
      await this.prisma.fitnessGoal.updateMany({
        where: { userId, status: 'ACTIVE', NOT: { id } },
        data: { status: 'PAUSED' },
      });
    }

    const data: any = { ...dto };
    if (dto.startDate !== undefined) data.startDate = toDateOnly(dto.startDate);
    if (dto.targetDate !== undefined)
      data.targetDate = dto.targetDate ? toDateOnly(dto.targetDate) : null;

    const goal = await this.prisma.fitnessGoal.update({
      where: { id },
      data,
      include: GOAL_INCLUDE,
    });
    return this.decorate(goal, await this.latestWeight(userId));
  }

  async complete(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    const goal = await this.prisma.fitnessGoal.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: GOAL_INCLUDE,
    });
    return this.decorate(goal, await this.latestWeight(userId));
  }

  async activate(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.fitnessGoal.updateMany({
      where: { userId, status: 'ACTIVE', NOT: { id } },
      data: { status: 'PAUSED' },
    });
    const goal = await this.prisma.fitnessGoal.update({
      where: { id },
      data: { status: 'ACTIVE' },
      include: GOAL_INCLUDE,
    });
    return this.decorate(goal, await this.latestWeight(userId));
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.fitnessGoal.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ------------------------------------------------------------ helpers

  private async ensureOwned(userId: string, id: string) {
    const existing = await this.prisma.fitnessGoal.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Goal not found');
  }

  private async ensureGoalType(userId: string, goalTypeId: string) {
    const type = await this.prisma.goalType.findFirst({
      where: { id: goalTypeId, OR: [{ userId: null }, { userId }] },
      select: { id: true, isActive: true },
    });
    if (!type) throw new BadRequestException('The selected goal type does not exist');
    if (!type.isActive) {
      throw new BadRequestException('That goal type has been archived');
    }
  }

  private async latestWeight(userId: string): Promise<number | null> {
    const log = await this.prisma.weightLog.findFirst({
      where: { userId },
      orderBy: { recordedDate: 'desc' },
    });
    if (log) return toNumber(log.weightKg);
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    return profile?.currentWeightKg ? toNumber(profile.currentWeightKg) : null;
  }

  private safeSortField(field?: string): string {
    const allowed = ['createdAt', 'startDate', 'targetDate', 'status'];
    return allowed.includes(field || '') ? field! : 'createdAt';
  }

  private decorate(goal: any, currentWeight: number | null) {
    const starting = goal.startingWeightKg ? toNumber(goal.startingWeightKg) : null;
    const target = goal.targetWeightKg ? toNumber(goal.targetWeightKg) : null;

    const progressPercentage = goalProgressPercentage(starting, target, currentWeight);
    const remainingKg =
      target !== null && currentWeight !== null
        ? round(Math.abs(target - currentWeight), 2)
        : null;

    const totalDays = goal.targetDate
      ? daysBetween(goal.startDate, goal.targetDate)
      : null;
    const daysElapsed = daysBetween(goal.startDate, new Date());
    const daysRemaining =
      goal.targetDate !== null && goal.targetDate !== undefined
        ? daysBetween(new Date(), goal.targetDate)
        : null;

    return {
      ...goal,
      goalTypeLabel: goal.goalType?.name ?? null,
      goalTypeColor: goal.goalType?.colorHex ?? null,
      goalTypeIcon: goal.goalType?.iconName ?? null,
      currentWeightKg: currentWeight,
      progressPercentage,
      remainingKg,
      changedKg:
        starting !== null && currentWeight !== null
          ? round(currentWeight - starting, 2)
          : null,
      totalDays,
      daysElapsed: Math.max(0, daysElapsed),
      daysRemaining,
      isOverdue:
        daysRemaining !== null && daysRemaining < 0 && goal.status === 'ACTIVE',
    };
  }
}
