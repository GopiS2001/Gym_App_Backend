import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { toDateOnly } from '../common/utils/date.util';
import {
  bmiCategory,
  calculateAge,
  calculateBmi,
  calculateBmr,
  toNumber,
} from '../common/utils/fitness.util';
import { UpdateAccountDto, UpdateProfileDto } from './dto/profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, settings: true },
    });
    if (!user) throw new NotFoundException('Account not found');

    // The profile row is created with the account, but guard against a
    // partially-provisioned record so the app never gets a null profile.
    const profile =
      user.profile ??
      (await this.prisma.profile.create({
        data: { userId, fullName: user.email.split('@')[0] },
      }));

    return this.decorate(profile, user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found');

    const data: any = { ...dto };
    if (dto.dateOfBirth !== undefined) data.dateOfBirth = toDateOnly(dto.dateOfBirth);
    if (dto.gymJoiningDate !== undefined)
      data.gymJoiningDate = toDateOnly(dto.gymJoiningDate);

    const profile = await this.prisma.profile.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        fullName: dto.fullName || user.email.split('@')[0],
        ...data,
      },
    });

    // Keeping a weight log in sync means the chart always reflects what the
    // profile shows, without the profile becoming the source of truth.
    if (dto.currentWeightKg !== undefined && dto.currentWeightKg !== null) {
      const today = toDateOnly(new Date());
      await this.prisma.weightLog.upsert({
        where: { userId_recordedDate: { userId, recordedDate: today } },
        update: { weightKg: dto.currentWeightKg },
        create: {
          userId,
          weightKg: dto.currentWeightKg,
          recordedDate: today,
          notes: 'Synced from profile update',
        },
      });
    }

    return this.decorate(profile, user);
  }

  async updateAccount(userId: string, dto: UpdateAccountDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { ...(dto.email ? { email: dto.email } : {}) },
      include: { profile: true, settings: true },
    });
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async deleteAccountData(userId: string) {
    // Removes tracked data but keeps the account itself usable.
    const [sessions, weights, measurements, photos, foods, waters, sleeps, attendance] =
      await this.prisma.$transaction([
        this.prisma.workoutSession.deleteMany({ where: { userId } }),
        this.prisma.weightLog.deleteMany({ where: { userId } }),
        this.prisma.bodyMeasurement.deleteMany({ where: { userId } }),
        this.prisma.progressPhoto.deleteMany({ where: { userId } }),
        this.prisma.foodLog.deleteMany({ where: { userId } }),
        this.prisma.waterLog.deleteMany({ where: { userId } }),
        this.prisma.sleepLog.deleteMany({ where: { userId } }),
        this.prisma.gymAttendance.deleteMany({ where: { userId } }),
      ]);

    return {
      deleted: {
        workoutSessions: sessions.count,
        weightLogs: weights.count,
        bodyMeasurements: measurements.count,
        progressPhotos: photos.count,
        foodLogs: foods.count,
        waterLogs: waters.count,
        sleepLogs: sleeps.count,
        attendance: attendance.count,
      },
    };
  }

  /** Full personal data export for backup purposes. */
  async exportData(userId: string) {
    const [
      user,
      goals,
      plans,
      sessions,
      weightLogs,
      measurements,
      photos,
      foodLogs,
      waterLogs,
      sleepLogs,
      attendance,
      customExercises,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true, settings: true },
      }),
      this.prisma.fitnessGoal.findMany({ where: { userId } }),
      this.prisma.workoutPlan.findMany({
        where: { userId },
        include: { exercises: { include: { exercise: true } } },
      }),
      this.prisma.workoutSession.findMany({
        where: { userId },
        include: { exercises: { include: { sets: true, exercise: true } } },
      }),
      this.prisma.weightLog.findMany({ where: { userId } }),
      this.prisma.bodyMeasurement.findMany({ where: { userId } }),
      this.prisma.progressPhoto.findMany({ where: { userId } }),
      this.prisma.foodLog.findMany({ where: { userId } }),
      this.prisma.waterLog.findMany({ where: { userId } }),
      this.prisma.sleepLog.findMany({ where: { userId } }),
      this.prisma.gymAttendance.findMany({ where: { userId } }),
      this.prisma.exercise.findMany({ where: { userId, isCustom: true } }),
    ]);

    if (!user) throw new NotFoundException('Account not found');
    const { passwordHash, ...account } = user;

    return {
      exportedAt: new Date().toISOString(),
      account,
      goals,
      workoutPlans: plans,
      workoutSessions: sessions,
      weightLogs,
      bodyMeasurements: measurements,
      progressPhotos: photos,
      foodLogs,
      waterLogs,
      sleepLogs,
      attendance,
      customExercises,
    };
  }

  // ------------------------------------------------------------ helpers

  private decorate(profile: any, user: any) {
    const weight = toNumber(profile.currentWeightKg, null as any);
    const height = toNumber(profile.heightCm, null as any);
    const age = calculateAge(profile.dateOfBirth);
    const bmi = calculateBmi(weight, height);

    const membershipDays = profile.gymJoiningDate
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(profile.gymJoiningDate).getTime()) / 86_400_000,
          ),
        )
      : null;

    return {
      ...profile,
      email: user.email,
      role: user.role,
      age,
      bmi,
      bmiCategory: bmiCategory(bmi),
      bmr: calculateBmr(weight, height, age, profile.gender),
      membershipDays,
    };
  }
}
