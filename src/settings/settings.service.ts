import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateSettingsDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    // Settings are created with the account, but upserting here means a
    // missing row can never break the app.
    return this.prisma.userSetting.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async update(userId: string, dto: UpdateSettingsDto) {
    return this.prisma.userSetting.upsert({
      where: { userId },
      update: { ...dto } as any,
      create: { userId, ...dto } as any,
    });
  }

  getOptions() {
    return {
      themes: [
        { value: 'SYSTEM', label: 'System default' },
        { value: 'LIGHT', label: 'Light' },
        { value: 'DARK', label: 'Dark' },
      ],
      weightUnits: [
        { value: 'KG', label: 'Kilograms (kg)' },
        { value: 'LB', label: 'Pounds (lb)' },
      ],
      heightUnits: [
        { value: 'CM', label: 'Centimetres (cm)' },
        { value: 'FT', label: 'Feet & inches' },
      ],
    };
  }
}
