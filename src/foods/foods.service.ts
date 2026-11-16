import { Injectable, NotFoundException } from '@nestjs/common';
import { Food, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import { round, toNumber } from '../common/utils/fitness.util';
import { CreateFoodDto, QueryFoodsDto, UpdateFoodDto } from './dto/foods.dto';

/** Nutrition for an amount of a food, all in grams except calories. */
export interface NutritionAmount {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * Consumed nutrition = nutrition per serving × (quantity ÷ serving size).
 * `quantity` is in the food's own serving unit, so 150 g of a food stored
 * per 100 g is 1.5 servings, and 2 of a food stored per 1 piece is 2.
 * Rounded to 2 decimals to match the DECIMAL(8,2) columns.
 */
export function nutritionFor(food: Food, quantity: number): NutritionAmount {
  const servingSize = toNumber(food.servingSize, 1) || 1;
  const factor = quantity / servingSize;
  return {
    calories: round(toNumber(food.calories) * factor, 2),
    proteinG: round(toNumber(food.proteinG) * factor, 2),
    carbsG: round(toNumber(food.carbsG) * factor, 2),
    fatG: round(toNumber(food.fatG) * factor, 2),
  };
}

@Injectable()
export class FoodsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The built-in library plus foods this user added. */
  private visibleTo(userId: string): Prisma.FoodWhereInput {
    return { OR: [{ userId: null }, { userId }] };
  }

  async findAll(userId: string, query: QueryFoodsDto) {
    const and: Prisma.FoodWhereInput[] = [this.visibleTo(userId)];
    if (!query.includeInactive) and.push({ isActive: true });
    if (query.category) and.push({ category: query.category });
    if (query.search) and.push({ name: { contains: query.search } });

    const where: Prisma.FoodWhereInput = { AND: and };
    const [items, total] = await Promise.all([
      this.prisma.food.findMany({
        where,
        orderBy: [{ name: query.sortOrder || 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.food.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query.page || 1, query.limit || 20);
  }

  async categories(userId: string) {
    const rows = await this.prisma.food.groupBy({
      by: ['category'],
      where: { AND: [this.visibleTo(userId), { isActive: true }] },
      _count: { _all: true },
      orderBy: { category: 'asc' },
    });
    return rows
      .filter((r) => !!r.category)
      .map((r) => ({ name: r.category as string, count: r._count._all }));
  }

  async findOne(userId: string, id: string) {
    const food = await this.prisma.food.findFirst({
      where: { AND: [{ id }, this.visibleTo(userId)] },
    });
    if (!food) throw new NotFoundException('Food not found');
    return food;
  }

  async create(userId: string, dto: CreateFoodDto) {
    return this.prisma.food.create({
      data: {
        userId,
        name: dto.name,
        category: dto.category || null,
        servingSize: dto.servingSize ?? 1,
        servingUnit: dto.servingUnit || 'serving',
        calories: dto.calories,
        proteinG: dto.proteinG ?? 0,
        carbsG: dto.carbsG ?? 0,
        fatG: dto.fatG ?? 0,
        fibreG: dto.fibreG ?? null,
        imageUrl: dto.imageUrl || null,
        isCustom: true,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /**
   * Editing a library food only affects future logging: every food entry
   * keeps its own snapshot of the values it was logged with.
   */
  async update(userId: string, id: string, dto: UpdateFoodDto) {
    await this.findOne(userId, id);
    const data: Prisma.FoodUpdateInput = { ...dto };
    if (dto.category !== undefined) data.category = dto.category || null;
    return this.prisma.food.update({ where: { id }, data });
  }

  /**
   * Removes a food from the library without touching history: it is
   * deactivated, so past entries that reference it stay intact.
   */
  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.food.update({ where: { id }, data: { isActive: false } });
    return { id, deleted: true };
  }

  /** Preview of the nutrition for a quantity, without logging anything. */
  async calculate(userId: string, id: string, quantity: number) {
    const food = await this.findOne(userId, id);
    return {
      foodId: food.id,
      quantity,
      unit: food.servingUnit,
      ...nutritionFor(food, quantity),
    };
  }
}
