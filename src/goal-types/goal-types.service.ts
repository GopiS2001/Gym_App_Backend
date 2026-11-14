import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import {
  CreateGoalTypeDto,
  QueryGoalTypesDto,
  UpdateGoalTypeDto,
} from './dto/goal-type.dto';

@Injectable()
export class GoalTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateGoalTypeDto) {
    const slug = await this.uniqueSlug(dto.name);

    const max = await this.prisma.goalType.aggregate({
      _max: { displayOrder: true },
    });

    return this.decorate(
      await this.prisma.goalType.create({
        data: {
          userId,
          name: dto.name,
          slug,
          description: dto.description,
          iconName: dto.iconName || 'flag',
          colorHex: dto.colorHex || '#34D399',
          displayOrder: dto.displayOrder ?? (max._max.displayOrder ?? 0) + 1,
          isCustom: true,
        },
        include: { _count: { select: { goals: true } } },
      }),
    );
  }

  async findAll(userId: string, query: QueryGoalTypesDto) {
    // Built-in types (userId null) sit alongside the user's own.
    const and: Prisma.GoalTypeWhereInput[] = [
      { OR: [{ userId: null }, { userId }] },
    ];

    if (!query.includeInactive) and.push({ isActive: true });
    if (query.isCustom !== undefined) and.push({ isCustom: query.isCustom });
    if (query.search) {
      and.push({
        OR: [
          { name: { contains: query.search } },
          { description: { contains: query.search } },
        ],
      });
    }

    const where: Prisma.GoalTypeWhereInput = { AND: and };
    const sortBy = this.safeSortField(query.sortBy);

    const [items, total] = await Promise.all([
      this.prisma.goalType.findMany({
        where,
        orderBy: [{ [sortBy]: query.sortOrder || 'asc' }, { name: 'asc' }],
        skip: query.skip,
        take: query.take,
        include: { _count: { select: { goals: true } } },
      }),
      this.prisma.goalType.count({ where }),
    ]);

    return buildPaginatedResult(
      items.map((i) => this.decorate(i)),
      total,
      query.page || 1,
      query.limit || 50,
    );
  }

  async findOne(userId: string, id: string) {
    const item = await this.prisma.goalType.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
      include: { _count: { select: { goals: true } } },
    });
    if (!item) throw new NotFoundException('Goal type not found');
    return this.decorate(item);
  }

  async update(userId: string, id: string, dto: UpdateGoalTypeDto) {
    const existing = await this.prisma.goalType.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
    });
    if (!existing) throw new NotFoundException('Goal type not found');

    const data: any = { ...dto };
    if (dto.name && dto.name !== existing.name) {
      data.slug = await this.uniqueSlug(dto.name, id);
    }

    return this.decorate(
      await this.prisma.goalType.update({
        where: { id },
        data,
        include: { _count: { select: { goals: true } } },
      }),
    );
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.goalType.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
      include: { _count: { select: { goals: true } } },
    });
    if (!existing) throw new NotFoundException('Goal type not found');

    // Goals reference this type, so deleting outright would orphan history.
    // Archiving keeps those goals readable while hiding the type from pickers.
    if (existing._count.goals > 0) {
      await this.prisma.goalType.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        id,
        deleted: true,
        archived: true,
        goalCount: existing._count.goals,
        reason: `${existing._count.goals} goal(s) use this type, so it was archived instead.`,
      };
    }

    await this.prisma.goalType.delete({ where: { id } });
    return { id, deleted: true, archived: false };
  }

  /** Brings an archived type back into the pickers. */
  async restore(userId: string, id: string) {
    const existing = await this.prisma.goalType.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
    });
    if (!existing) throw new NotFoundException('Goal type not found');

    return this.decorate(
      await this.prisma.goalType.update({
        where: { id },
        data: { isActive: true },
        include: { _count: { select: { goals: true } } },
      }),
    );
  }

  async reorder(userId: string, orderedIds: string[]) {
    const count = await this.prisma.goalType.count({
      where: { id: { in: orderedIds }, OR: [{ userId: null }, { userId }] },
    });
    if (count !== orderedIds.length) {
      throw new BadRequestException('One or more goal types do not exist');
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.goalType.update({
          where: { id },
          data: { displayOrder: index + 1 },
        }),
      ),
    );

    return { reordered: orderedIds.length };
  }

  // ------------------------------------------------------------ helpers

  private decorate(item: any) {
    const { _count, ...rest } = item;
    return {
      ...rest,
      // The client shows this to explain why a delete archives instead.
      goalCount: _count?.goals ?? 0,
      // Kept so existing clients that switch on a constant keep working.
      value: rest.id,
      label: rest.name,
    };
  }

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
        .slice(0, 60) || 'goal-type';

    let slug = base;
    let suffix = 1;
    while (true) {
      const clash = await this.prisma.goalType.findFirst({
        where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { id: true },
      });
      if (!clash) return slug;
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
  }
}
