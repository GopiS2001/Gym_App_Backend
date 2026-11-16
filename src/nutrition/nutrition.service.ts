import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FoodLog, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { FoodsService, nutritionFor } from '../foods/foods.service';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import {
  addDays,
  dateRangeFilter,
  eachDay,
  formatDateOnly,
  toDateOnly,
} from '../common/utils/date.util';
import { round, toNumber } from '../common/utils/fitness.util';
import {
  CreateFoodLogDto,
  MealTypeDto,
  QueryFoodLogsDto,
  UpdateFoodLogDto,
} from './dto/nutrition.dto';

// In order through the day; the daily summary lists meals in this order.
const MEAL_LABELS: Record<string, string> = {
  PRE_WORKOUT: 'Pre-Workout',
  BREAKFAST: 'Breakfast',
  POST_WORKOUT: 'Post-Workout',
  LUNCH: 'Lunch',
  SNACKS: 'Evening Snacks',
  DINNER: 'Dinner',
  BEFORE_BED: 'Before Bed',
};

@Injectable()
export class NutritionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foodsService: FoodsService,
  ) {}

  /**
   * Name, unit, image and nutrition for `quantity` of a library food, as a
   * snapshot to store on the entry.
   */
  private async snapshotFromLibrary(userId: string, foodId: string, quantity: number) {
    const food = await this.foodsService.findOne(userId, foodId);
    if (!food.isActive) {
      throw new BadRequestException('That food was removed from the library');
    }
    return {
      foodId: food.id,
      foodName: food.name,
      quantity,
      quantityUnit: food.servingUnit,
      imageUrl: food.imageUrl,
      ...nutritionFor(food, quantity),
    };
  }

  /**
   * New nutrition for an entry whose quantity changed, scaled from the
   * entry's own snapshot rather than the library, so later library edits
   * never leak into history.
   */
  private rescaleSnapshot(entry: FoodLog, quantity: number) {
    const old = toNumber(entry.quantity);
    if (!old) return {};
    const factor = quantity / old;
    return {
      calories: round(toNumber(entry.calories) * factor, 2),
      proteinG: round(toNumber(entry.proteinG) * factor, 2),
      carbsG: round(toNumber(entry.carbsG) * factor, 2),
      fatG: round(toNumber(entry.fatG) * factor, 2),
    };
  }

  async create(userId: string, dto: CreateFoodLogDto) {
    const consumedAt = dto.consumedAt ? new Date(dto.consumedAt) : new Date();
    const loggedDate = toDateOnly(dto.loggedDate || consumedAt);

    // An offline client replays queued writes with the same key; returning
    // the original row keeps a retry from creating a duplicate meal.
    if (dto.clientOpId) {
      const existing = await this.prisma.foodLog.findFirst({
        where: { userId, clientOpId: dto.clientOpId },
      });
      if (existing) return existing;
    }

    const values = dto.foodId
      ? await this.snapshotFromLibrary(userId, dto.foodId, dto.quantity ?? 1)
      : {
          foodId: null,
          foodName: dto.foodName,
          quantity: dto.quantity ?? 1,
          quantityUnit: dto.quantityUnit || 'serving',
          calories: dto.calories,
          proteinG: dto.proteinG ?? 0,
          carbsG: dto.carbsG ?? 0,
          fatG: dto.fatG ?? 0,
          imageUrl: dto.imageUrl,
        };

    const created = await this.prisma.foodLog.create({
      data: {
        userId,
        clientOpId: dto.clientOpId || null,
        mealType: dto.mealType as any,
        ...values,
        consumedAt,
        loggedDate,
        notes: dto.notes,
      },
    });
    return { ...created, mealTypeLabel: MEAL_LABELS[created.mealType] };
  }

  async findAll(userId: string, query: QueryFoodLogsDto) {
    const and: Prisma.FoodLogWhereInput[] = [{ userId }];

    if (query.date) {
      and.push({ loggedDate: toDateOnly(query.date) });
    } else {
      const range = dateRangeFilter(query.fromDate, query.toDate);
      if (range) and.push({ loggedDate: range });
    }

    if (query.mealType) and.push({ mealType: query.mealType as any });
    if (query.minCalories !== undefined)
      and.push({ calories: { gte: query.minCalories } });
    if (query.maxCalories !== undefined)
      and.push({ calories: { lte: query.maxCalories } });
    if (query.search) {
      and.push({
        OR: [
          { foodName: { contains: query.search } },
          { notes: { contains: query.search } },
        ],
      });
    }

    const where: Prisma.FoodLogWhereInput = { AND: and };
    const sortBy = this.safeSortField(query.sortBy);

    const [items, total] = await Promise.all([
      this.prisma.foodLog.findMany({
        where,
        orderBy: { [sortBy]: query.sortOrder || 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.foodLog.count({ where }),
    ]);

    return buildPaginatedResult(
      items.map((i) => ({ ...i, mealTypeLabel: MEAL_LABELS[i.mealType] })),
      total,
      query.page || 1,
      query.limit || 20,
    );
  }

  async findOne(userId: string, id: string) {
    const item = await this.prisma.foodLog.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException('Food entry not found');
    return { ...item, mealTypeLabel: MEAL_LABELS[item.mealType] };
  }

  async update(userId: string, id: string, dto: UpdateFoodLogDto) {
    const entry = await this.prisma.foodLog.findFirst({ where: { id, userId } });
    if (!entry) throw new NotFoundException('Food entry not found');

    const { foodId, loggedDate, clientOpId: _ignored, ...rest } = dto;
    let data: Prisma.FoodLogUncheckedUpdateInput = { ...rest };

    const quantity = dto.quantity ?? toNumber(entry.quantity);
    const sentNutrition =
      dto.calories !== undefined ||
      dto.proteinG !== undefined ||
      dto.carbsG !== undefined ||
      dto.fatG !== undefined;

    if (foodId && foodId !== entry.foodId) {
      // Switched to a different library food: take a fresh snapshot.
      data = { ...data, ...(await this.snapshotFromLibrary(userId, foodId, quantity)) };
    } else if (entry.foodId && dto.quantity !== undefined && !sentNutrition) {
      // Same library food, new amount: scale this entry's own snapshot.
      data = { ...data, ...this.rescaleSnapshot(entry, dto.quantity) };
    }

    if (dto.consumedAt) {
      data.consumedAt = new Date(dto.consumedAt);
      data.loggedDate = toDateOnly(loggedDate || data.consumedAt);
    } else if (loggedDate) {
      data.loggedDate = toDateOnly(loggedDate);
    }

    const updated = await this.prisma.foodLog.update({ where: { id }, data });
    return { ...updated, mealTypeLabel: MEAL_LABELS[updated.mealType] };
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.foodLog.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Totals, per-meal breakdown and target comparison for a single day. */
  async dailySummary(userId: string, date?: string) {
    const loggedDate = toDateOnly(date);

    const [logs, settings] = await Promise.all([
      this.prisma.foodLog.findMany({
        where: { userId, loggedDate },
        orderBy: { consumedAt: 'asc' },
      }),
      this.prisma.userSetting.findUnique({ where: { userId } }),
    ]);

    const totals = logs.reduce(
      (acc, log) => ({
        calories: acc.calories + toNumber(log.calories),
        proteinG: acc.proteinG + toNumber(log.proteinG),
        carbsG: acc.carbsG + toNumber(log.carbsG),
        fatG: acc.fatG + toNumber(log.fatG),
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );

    const meals = Object.keys(MEAL_LABELS).map((meal) => {
      const mealLogs = logs.filter((l) => l.mealType === meal);
      return {
        mealType: meal,
        label: MEAL_LABELS[meal],
        itemCount: mealLogs.length,
        calories: round(
          mealLogs.reduce((sum, l) => sum + toNumber(l.calories), 0),
          1,
        ),
        proteinG: round(
          mealLogs.reduce((sum, l) => sum + toNumber(l.proteinG), 0),
          1,
        ),
        carbsG: round(mealLogs.reduce((sum, l) => sum + toNumber(l.carbsG), 0), 1),
        fatG: round(mealLogs.reduce((sum, l) => sum + toNumber(l.fatG), 0), 1),
        items: mealLogs,
      };
    });

    const targets = {
      calories: settings?.dailyCalorieTarget ?? 2000,
      proteinG: settings?.dailyProteinTargetG ?? 150,
      carbsG: settings?.dailyCarbsTargetG ?? 220,
      fatG: settings?.dailyFatTargetG ?? 65,
    };

    // Macro split as a share of total macro grams, which is what the ring
    // chart in the app renders.
    const macroGrams = totals.proteinG + totals.carbsG + totals.fatG;

    return {
      date: formatDateOnly(loggedDate),
      totals: {
        calories: round(totals.calories, 1),
        proteinG: round(totals.proteinG, 1),
        carbsG: round(totals.carbsG, 1),
        fatG: round(totals.fatG, 1),
      },
      targets,
      remaining: {
        calories: round(targets.calories - totals.calories, 1),
        proteinG: round(targets.proteinG - totals.proteinG, 1),
        carbsG: round(targets.carbsG - totals.carbsG, 1),
        fatG: round(targets.fatG - totals.fatG, 1),
      },
      progress: {
        calories: this.pct(totals.calories, targets.calories),
        proteinG: this.pct(totals.proteinG, targets.proteinG),
        carbsG: this.pct(totals.carbsG, targets.carbsG),
        fatG: this.pct(totals.fatG, targets.fatG),
      },
      macroSplit: {
        proteinPct: macroGrams ? round((totals.proteinG / macroGrams) * 100, 1) : 0,
        carbsPct: macroGrams ? round((totals.carbsG / macroGrams) * 100, 1) : 0,
        fatPct: macroGrams ? round((totals.fatG / macroGrams) * 100, 1) : 0,
      },
      entryCount: logs.length,
      meals,
    };
  }

  /** Daily totals over a range, for the nutrition trend chart. */
  async history(userId: string, days = 7) {
    const to = toDateOnly(new Date());
    const from = addDays(to, -(days - 1));

    const logs = await this.prisma.foodLog.findMany({
      where: { userId, loggedDate: { gte: from, lte: to } },
    });

    const byDay = new Map<string, any>();
    for (const day of eachDay(from, to)) {
      byDay.set(formatDateOnly(day), {
        date: formatDateOnly(day),
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        entryCount: 0,
      });
    }

    for (const log of logs) {
      const key = formatDateOnly(log.loggedDate);
      const row = byDay.get(key);
      if (!row) continue;
      row.calories += toNumber(log.calories);
      row.proteinG += toNumber(log.proteinG);
      row.carbsG += toNumber(log.carbsG);
      row.fatG += toNumber(log.fatG);
      row.entryCount += 1;
    }

    const points = [...byDay.values()].map((p) => ({
      ...p,
      calories: round(p.calories, 1),
      proteinG: round(p.proteinG, 1),
      carbsG: round(p.carbsG, 1),
      fatG: round(p.fatG, 1),
    }));

    const loggedDays = points.filter((p) => p.entryCount > 0);

    return {
      points,
      rangeDays: days,
      averageCalories: loggedDays.length
        ? round(
            loggedDays.reduce((sum, p) => sum + p.calories, 0) / loggedDays.length,
            1,
          )
        : 0,
      averageProteinG: loggedDays.length
        ? round(
            loggedDays.reduce((sum, p) => sum + p.proteinG, 0) / loggedDays.length,
            1,
          )
        : 0,
      daysLogged: loggedDays.length,
    };
  }

  /** Previously logged foods, so repeated meals can be re-added in one tap. */
  async frequentFoods(userId: string, limit = 20, search?: string) {
    const logs = await this.prisma.foodLog.findMany({
      where: {
        userId,
        ...(search ? { foodName: { contains: search } } : {}),
      },
      orderBy: { consumedAt: 'desc' },
      take: 400,
    });

    const map = new Map<string, any>();
    for (const log of logs) {
      const key = log.foodName.toLowerCase();
      if (map.has(key)) {
        map.get(key).timesLogged += 1;
        continue;
      }
      map.set(key, {
        foodName: log.foodName,
        mealType: log.mealType,
        quantity: toNumber(log.quantity),
        quantityUnit: log.quantityUnit,
        calories: toNumber(log.calories),
        proteinG: toNumber(log.proteinG),
        carbsG: toNumber(log.carbsG),
        fatG: toNumber(log.fatG),
        imageUrl: log.imageUrl,
        lastLoggedAt: log.consumedAt,
        timesLogged: 1,
      });
    }

    return [...map.values()]
      .sort((a, b) => b.timesLogged - a.timesLogged)
      .slice(0, limit);
  }

  getMealTypes() {
    return Object.entries(MEAL_LABELS).map(([value, label]) => ({ value, label }));
  }

  // ------------------------------------------------------------ helpers

  private pct(value: number, target: number): number {
    if (!target) return 0;
    return round(Math.min(100, (value / target) * 100), 1);
  }

  private safeSortField(field?: string): string {
    const allowed = ['consumedAt', 'loggedDate', 'calories', 'foodName', 'createdAt'];
    return allowed.includes(field || '') ? field! : 'consumedAt';
  }
}
