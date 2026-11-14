import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResult, PaginationDto } from '../common/dto/pagination.dto';

const IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
];
const VIDEO_MIME = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/3gpp',
  'video/x-m4v',
  'video/x-matroska',
];

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The public origin to build media URLs from.
   *
   * `PUBLIC_BASE_URL` is used when it names a real host. When it is unset or
   * still points at localhost, the origin is taken from the request instead —
   * otherwise a phone uploading over the LAN gets back a `localhost` URL,
   * which on the phone means the phone itself and can never load.
   */
  private publicOrigin(req?: { protocol?: string; get?: (h: string) => string }): string {
    const configured = this.config.get<string>('PUBLIC_BASE_URL');
    const isLoopback = !configured || /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(configured);

    if (!isLoopback) return configured.replace(/\/+$/, '');

    const host = req?.get?.('host');
    if (host) return `${req?.protocol || 'http'}://${host}`;

    return (configured || 'http://localhost:3000').replace(/\/+$/, '');
  }

  async saveUpload(
    userId: string,
    file: Express.Multer.File,
    folder = 'misc',
    req?: any,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded');

    const isImage = IMAGE_MIME.includes(file.mimetype);
    const isVideo = VIDEO_MIME.includes(file.mimetype);
    if (!isImage && !isVideo) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Upload an image or a video.`,
      );
    }

    // Videos get their own, larger cap: a short phone clip easily passes 15 MB.
    const maxMb = isVideo
      ? Number(this.config.get('MAX_VIDEO_UPLOAD_MB') || 100)
      : Number(this.config.get('MAX_UPLOAD_MB') || 15);
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(
        `${isVideo ? 'Video' : 'Image'} must be smaller than ${maxMb} MB`,
      );
    }

    const uploadDir = this.config.get<string>('UPLOAD_DIR') || 'uploads';
    const safeFolder = folder.replace(/[^a-z0-9-]/gi, '') || 'misc';
    const targetDir = join(process.cwd(), uploadDir, safeFolder);
    await fs.mkdir(targetDir, { recursive: true });

    const ext = extname(file.originalname) || (isImage ? '.jpg' : '.mp4');
    const filename = `${randomUUID()}${ext.toLowerCase()}`;
    const storageKey = `${safeFolder}/${filename}`;

    await fs.writeFile(join(targetDir, filename), file.buffer);

    const baseUrl = this.publicOrigin(req);

    return this.prisma.mediaAsset.create({
      data: {
        userId,
        mediaType: isImage ? 'IMAGE' : 'VIDEO',
        storageProvider: 'local',
        storageKey,
        mediaUrl: `${baseUrl}/${uploadDir}/${storageKey}`,
        fileSize: file.size,
        mimeType: file.mimetype,
        originalName: file.originalname,
      },
    });
  }

  async findAll(userId: string, query: PaginationDto, mediaType?: string) {
    const where = {
      userId,
      ...(mediaType ? { mediaType: mediaType as any } : {}),
      ...(query.search ? { originalName: { contains: query.search } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: query.sortOrder || 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query.page || 1, query.limit || 20);
  }

  async remove(userId: string, id: string) {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, userId } });
    if (!asset) throw new NotFoundException('Media not found');

    await this.prisma.mediaAsset.delete({ where: { id } });

    // The row is the source of truth; a missing file on disk must not fail
    // the request.
    if (asset.storageProvider === 'local') {
      const uploadDir = this.config.get<string>('UPLOAD_DIR') || 'uploads';
      await fs
        .unlink(join(process.cwd(), uploadDir, asset.storageKey))
        .catch(() => undefined);
    }

    return { id, deleted: true };
  }
}
