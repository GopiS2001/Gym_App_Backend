import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import { CreateWarmupDto, QueryWarmupsDto, UpdateWarmupDto } from './dto/warmups.dto';

const include = {
  category: { select: { id: true, name: true, slug: true, colorHex: true, iconName: true } },
} satisfies Prisma.WarmupInclude;

@Injectable()
export class WarmupsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: QueryWarmupsDto) {
    const where: Prisma.WarmupWhereInput = { userId };
    if (query.categoryId === 'none') where.categoryId = null;
    else if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) where.name = { contains: query.search };

    const [items, total] = await Promise.all([
      this.prisma.warmup.findMany({
        where,
        include,
        orderBy: [{ name: query.sortOrder || 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.warmup.count({ where }),
    ]);
    return buildPaginatedResult(items, total, query.page || 1, query.limit || 20);
  }

  async findOne(userId: string, id: string) {
    const item = await this.prisma.warmup.findFirst({ where: { id, userId }, include });
    if (!item) throw new NotFoundException('Warm-up not found');
    return item;
  }

  async create(userId: string, dto: CreateWarmupDto) {
    await this.checkCategory(userId, dto.categoryId);
    return this.prisma.warmup.create({
      data: {
        userId,
        name: dto.name,
        categoryId: dto.categoryId || null,
        durationSeconds: dto.durationSeconds ?? null,
        reps: dto.reps ?? null,
        description: dto.description || null,
      },
      include,
    });
  }

  async update(userId: string, id: string, dto: UpdateWarmupDto) {
    await this.findOne(userId, id);
    if (dto.categoryId !== undefined) await this.checkCategory(userId, dto.categoryId);
    const data: Prisma.WarmupUncheckedUpdateInput = { ...dto };
    if (dto.description !== undefined) data.description = dto.description || null;
    return this.prisma.warmup.update({ where: { id }, data, include });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.warmup.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** The category is optional, but when given it must be one the user can see. */
  private async checkCategory(userId: string, categoryId?: string | null) {
    if (!categoryId) return;
    const found = await this.prisma.workoutCategory.findFirst({
      where: { id: categoryId, OR: [{ userId: null }, { userId }] },
      select: { id: true },
    });
    if (!found) throw new BadRequestException('Category not found');
  }
}
