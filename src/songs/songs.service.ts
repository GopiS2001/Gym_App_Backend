import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import { CreateSongDto, QuerySongsDto, UpdateSongDto } from './dto/songs.dto';

@Injectable()
export class SongsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: QuerySongsDto) {
    const where: Prisma.SongWhereInput = { userId };
    if (query.search) {
      where.OR = [
        { movieTitle: { contains: query.search } },
        { songName: { contains: query.search } },
      ];
    }

    const sortBy = ['movieTitle', 'songName', 'createdAt'].includes(query.sortBy || '')
      ? query.sortBy!
      : 'createdAt';
    const sortOrder = query.sortOrder || (sortBy === 'createdAt' ? 'desc' : 'asc');

    const [items, total] = await Promise.all([
      this.prisma.song.findMany({
        where,
        orderBy: [{ [sortBy]: sortOrder }, { songName: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.song.count({ where }),
    ]);
    return buildPaginatedResult(items, total, query.page || 1, query.limit || 20);
  }

  async findOne(userId: string, id: string) {
    const item = await this.prisma.song.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException('Song not found');
    return item;
  }

  create(userId: string, dto: CreateSongDto) {
    return this.prisma.song.create({
      data: {
        userId,
        movieTitle: dto.movieTitle,
        songName: dto.songName,
        imageUrl: dto.imageUrl || null,
        audioUrl: dto.audioUrl || null,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateSongDto) {
    await this.findOne(userId, id);
    const data: Prisma.SongUpdateInput = {};
    if (dto.movieTitle !== undefined) data.movieTitle = dto.movieTitle;
    if (dto.songName !== undefined) data.songName = dto.songName;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl || null;
    if (dto.audioUrl !== undefined) data.audioUrl = dto.audioUrl || null;
    return this.prisma.song.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.song.delete({ where: { id } });
    return { id, deleted: true };
  }
}
