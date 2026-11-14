import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import {
  CreateCategoryDto,
  QueryCategoriesDto,
  UpdateCategoryDto,
} from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCategoryDto) {
    const slug = await this.uniqueSlug(dto.name);
    return this.prisma.workoutCategory.create({
      data: {
        userId,
        name: dto.name,
        slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        iconName: dto.iconName || 'dumbbell',
        colorHex: dto.colorHex || '#34D399',
        displayOrder: dto.displayOrder ?? 99,
        isCustom: true,
      },
    });
  }

  async findAll(userId: string, query: QueryCategoriesDto) {
    // Built-in categories (userId null) are visible alongside the user's own.
    const where: Prisma.WorkoutCategoryWhereInput = {
      OR: [{ userId: null }, { userId }],
      ...(query.isCustom !== undefined ? { isCustom: query.isCustom } : {}),
      ...(query.search
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: query.search } },
                  { description: { contains: query.search } },
                ],
              },
            ],
          }
        : {}),
    };

    const sortBy = this.safeSortField(query.sortBy);
    const [items, total] = await Promise.all([
      this.prisma.workoutCategory.findMany({
        where,
        orderBy: [{ [sortBy]: query.sortOrder || 'asc' }, { name: 'asc' }],
        skip: query.skip,
        take: query.take,
        include: {
          _count: { select: { exercises: { where: { isActive: true } } } },
        },
      }),
      this.prisma.workoutCategory.count({ where }),
    ]);

    return buildPaginatedResult(
      items.map(({ _count, ...c }) => ({ ...c, exerciseCount: _count.exercises })),
      total,
      query.page || 1,
      query.limit || 20,
    );
  }

  async findOne(userId: string, id: string) {
    const category = await this.prisma.workoutCategory.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
      include: {
        _count: { select: { exercises: { where: { isActive: true } } } },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    const { _count, ...rest } = category;
    return { ...rest, exerciseCount: _count.exercises };
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.workoutCategory.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
    });
    if (!existing) throw new NotFoundException('Category not found');

    const data: any = { ...dto };
    if (dto.name && dto.name !== existing.name) {
      data.slug = await this.uniqueSlug(dto.name, id);
    }

    return this.prisma.workoutCategory.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.workoutCategory.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
      include: {
        _count: {
          select: {
            exercises: true,
            // Listings only count active exercises, so an archived one would
            // make the category look empty while still blocking the delete.
            // Counting both lets the message say what is actually in the way.
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('Category not found');

    if (existing._count.exercises > 0) {
      const active = await this.prisma.exercise.count({
        where: { categoryId: id, isActive: true },
      });
      const archived = existing._count.exercises - active;

      const parts: string[] = [];
      if (active > 0) parts.push(`${active} exercise(s)`);
      if (archived > 0) parts.push(`${archived} archived exercise(s)`);

      throw new BadRequestException(
        `This category still holds ${parts.join(' and ')}. Move them to another category first.`,
      );
    }

    await this.prisma.workoutCategory.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ------------------------------------------------------------ helpers

  private safeSortField(field?: string): string {
    const allowed = ['displayOrder', 'name', 'createdAt'];
    return allowed.includes(field || '') ? field! : 'displayOrder';
  }

  private async uniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'category';

    let slug = base;
    let suffix = 1;
    // `slug` is unique across the table, so collisions must be resolved here.
    while (true) {
      const clash = await this.prisma.workoutCategory.findFirst({
        where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { id: true },
      });
      if (!clash) return slug;
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
  }
}
