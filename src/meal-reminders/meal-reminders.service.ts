import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MealReminder, UserSetting } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  CreateMealReminderDto,
  ReminderTypeDto,
  ToggleMealReminderDto,
  UpdateMealReminderDto,
  UpdateWorkoutScheduleDto,
  WEEK_DAYS,
  WeekDayName,
  WorkoutLinkDto,
} from './dto/meal-reminders.dto';

const TYPE_LABELS: Record<ReminderTypeDto, string> = {
  PRE_WORKOUT: 'Pre-Workout',
  BREAKFAST: 'Breakfast',
  POST_WORKOUT: 'Post-Workout',
  LUNCH: 'Lunch',
  SNACK: 'Evening Snacks',
  DINNER: 'Dinner',
  BEFORE_BED: 'Before Bed',
  WATER: 'Water',
  CUSTOM: 'Custom',
};

/** Which Food Intake meal a reminder opens when tapped. */
const TYPE_MEAL: Partial<Record<ReminderTypeDto, string>> = {
  PRE_WORKOUT: 'PRE_WORKOUT',
  BREAKFAST: 'BREAKFAST',
  POST_WORKOUT: 'POST_WORKOUT',
  LUNCH: 'LUNCH',
  SNACK: 'SNACKS',
  DINNER: 'DINNER',
  BEFORE_BED: 'BEFORE_BED',
};

const DEFAULT_MESSAGES: Record<ReminderTypeDto, string> = {
  PRE_WORKOUT: 'Your pre-workout reminder. Have your planned snack and water.',
  BREAKFAST: 'Breakfast time. Remember to log your meal.',
  POST_WORKOUT: 'Time to log your post-workout meal and hydration.',
  LUNCH: 'Lunch time. Remember to log your meal.',
  SNACK: 'Snack time. Choose a snack that fits your plan.',
  DINNER: 'Dinner time. Remember to log your meal.',
  BEFORE_BED: 'Before bed. Log anything you had this evening.',
  WATER: 'Time to drink some water.',
  CUSTOM: 'Reminder from Personal Gym.',
};

/** Editable sample schedule; created on request, never automatically. */
const SAMPLE_REMINDERS: CreateMealReminderDto[] = [
  { title: 'Pre-Workout', reminderType: ReminderTypeDto.PRE_WORKOUT, reminderTime: '05:30', workoutLink: WorkoutLinkDto.BEFORE },
  { title: 'Breakfast', reminderType: ReminderTypeDto.BREAKFAST, reminderTime: '07:30' },
  { title: 'Post-Workout', reminderType: ReminderTypeDto.POST_WORKOUT, reminderTime: '07:00', workoutLink: WorkoutLinkDto.AFTER },
  { title: 'Lunch', reminderType: ReminderTypeDto.LUNCH, reminderTime: '13:00' },
  { title: 'Evening Snacks', reminderType: ReminderTypeDto.SNACK, reminderTime: '16:30' },
  { title: 'Dinner', reminderType: ReminderTypeDto.DINNER, reminderTime: '20:00' },
  { title: 'Water', reminderType: ReminderTypeDto.WATER, reminderTime: '11:00', isEnabled: false },
];

const MINUTES_PER_DAY = 24 * 60;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Moves each day by `offset` days (wrapping around the week), in week order. */
function shiftDays(days: WeekDayName[], offset: number): WeekDayName[] {
  if (!offset) return days;
  const shifted = new Set(
    days.map((d) => WEEK_DAYS[(WEEK_DAYS.indexOf(d) + offset + 7) % 7]),
  );
  return WEEK_DAYS.filter((d) => shifted.has(d));
}

function asDayList(value: unknown): WeekDayName[] {
  if (!Array.isArray(value)) return [];
  const set = new Set(value);
  return WEEK_DAYS.filter((d) => set.has(d));
}

export interface WorkoutSchedule {
  workoutTime: string | null;
  /** Days the user picked, or null when following the workout plan. */
  workoutDays: WeekDayName[] | null;
  /** The days actually used. */
  effectiveDays: WeekDayName[];
  daysSource: 'CUSTOM' | 'PLAN' | 'EVERY_DAY';
  workoutDurationMin: number;
  preWorkoutLeadMin: number;
  postWorkoutDelayMin: number;
}

@Injectable()
export class MealRemindersService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- reads

  async findAll(userId: string) {
    const [rows, schedule] = await Promise.all([
      this.prisma.mealReminder.findMany({
        where: { userId },
        orderBy: [{ reminderTime: 'asc' }, { createdAt: 'asc' }],
      }),
      this.getWorkoutSchedule(userId),
    ]);
    const items = rows
      .map((r) => this.present(r, schedule))
      // Sort by the time it actually fires, which differs for linked ones.
      .sort((a, b) => a.schedule.time.localeCompare(b.schedule.time));
    return {
      items,
      workoutSchedule: schedule,
      types: Object.entries(TYPE_LABELS).map(([value, label]) => ({
        value,
        label,
        defaultMessage: DEFAULT_MESSAGES[value as ReminderTypeDto],
      })),
    };
  }

  async findOne(userId: string, id: string) {
    const row = await this.getOwned(userId, id);
    return this.present(row, await this.getWorkoutSchedule(userId));
  }

  // --------------------------------------------------------------- writes

  async create(userId: string, dto: CreateMealReminderDto) {
    const repeatDays = asDayList(dto.repeatDays);
    const workoutLink = dto.workoutLink ?? WorkoutLinkDto.NONE;
    await this.assertNotDuplicate(userId, {
      reminderType: dto.reminderType,
      reminderTime: dto.reminderTime,
      repeatDays,
      workoutLink,
    });

    const row = await this.prisma.mealReminder.create({
      data: {
        userId,
        title: dto.title,
        reminderType: dto.reminderType as any,
        reminderTime: dto.reminderTime,
        repeatDays,
        message: dto.message || DEFAULT_MESSAGES[dto.reminderType],
        isEnabled: dto.isEnabled ?? true,
        workoutLink: workoutLink as any,
        snoozeMinutes: dto.snoozeMinutes ?? 10,
      },
    });
    return this.present(row, await this.getWorkoutSchedule(userId));
  }

  async update(userId: string, id: string, dto: UpdateMealReminderDto) {
    const current = await this.getOwned(userId, id);
    const next = {
      reminderType: (dto.reminderType ?? current.reminderType) as ReminderTypeDto,
      reminderTime: dto.reminderTime ?? current.reminderTime,
      repeatDays:
        dto.repeatDays !== undefined ? asDayList(dto.repeatDays) : asDayList(current.repeatDays),
      workoutLink: (dto.workoutLink ?? current.workoutLink) as WorkoutLinkDto,
    };
    await this.assertNotDuplicate(userId, next, id);

    const row = await this.prisma.mealReminder.update({
      where: { id },
      data: {
        title: dto.title,
        reminderType: next.reminderType as any,
        reminderTime: next.reminderTime,
        repeatDays: next.repeatDays,
        message:
          dto.message !== undefined ? dto.message || DEFAULT_MESSAGES[next.reminderType] : undefined,
        isEnabled: dto.isEnabled,
        workoutLink: next.workoutLink as any,
        snoozeMinutes: dto.snoozeMinutes,
      },
    });
    return this.present(row, await this.getWorkoutSchedule(userId));
  }

  async toggle(userId: string, id: string, dto: ToggleMealReminderDto) {
    const current = await this.getOwned(userId, id);
    const row = await this.prisma.mealReminder.update({
      where: { id },
      data: { isEnabled: dto.isEnabled ?? !current.isEnabled },
    });
    return this.present(row, await this.getWorkoutSchedule(userId));
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    await this.prisma.mealReminder.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Adds the sample schedule, skipping any type the user already has. */
  async addSamples(userId: string) {
    const existing = await this.prisma.mealReminder.findMany({
      where: { userId },
      select: { reminderType: true },
    });
    const have = new Set(existing.map((r) => r.reminderType as string));
    const toCreate = SAMPLE_REMINDERS.filter((s) => !have.has(s.reminderType));

    for (const s of toCreate) {
      await this.prisma.mealReminder.create({
        data: {
          userId,
          title: s.title,
          reminderType: s.reminderType as any,
          reminderTime: s.reminderTime,
          repeatDays: [],
          message: DEFAULT_MESSAGES[s.reminderType],
          isEnabled: s.isEnabled ?? true,
          workoutLink: (s.workoutLink ?? WorkoutLinkDto.NONE) as any,
          snoozeMinutes: 10,
        },
      });
    }
    return { created: toCreate.length, ...(await this.findAll(userId)) };
  }

  // ------------------------------------------------------ workout schedule

  async getWorkoutSchedule(userId: string): Promise<WorkoutSchedule> {
    const settings = await this.prisma.userSetting.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return this.buildSchedule(userId, settings);
  }

  async updateWorkoutSchedule(userId: string, dto: UpdateWorkoutScheduleDto) {
    const data: any = {};
    if (dto.workoutTime !== undefined) data.workoutTime = dto.workoutTime;
    if (dto.workoutDays !== undefined) {
      // An empty list is treated like "follow my plan".
      const days = dto.workoutDays === null ? [] : asDayList(dto.workoutDays);
      data.workoutDays = days.length ? days : null;
    }
    if (dto.workoutDurationMin !== undefined) data.workoutDurationMin = dto.workoutDurationMin;
    if (dto.preWorkoutLeadMin !== undefined) data.preWorkoutLeadMin = dto.preWorkoutLeadMin;
    if (dto.postWorkoutDelayMin !== undefined) data.postWorkoutDelayMin = dto.postWorkoutDelayMin;

    // Prisma needs the JSON null sentinel to store SQL NULL in a Json column.
    if (data.workoutDays === null) data.workoutDays = (await import('@prisma/client')).Prisma.DbNull;

    const settings = await this.prisma.userSetting.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    return this.buildSchedule(userId, settings);
  }

  // -------------------------------------------------------------- helpers

  private async buildSchedule(userId: string, s: UserSetting): Promise<WorkoutSchedule> {
    const custom = asDayList(s.workoutDays);
    let effectiveDays: WeekDayName[] = custom;
    let daysSource: WorkoutSchedule['daysSource'] = 'CUSTOM';

    if (!custom.length) {
      const planDays = await this.prisma.workoutPlanExercise.findMany({
        where: { plan: { userId, status: 'ACTIVE' } },
        distinct: ['scheduledDay'],
        select: { scheduledDay: true },
      });
      effectiveDays = asDayList(planDays.map((d) => d.scheduledDay));
      daysSource = effectiveDays.length ? 'PLAN' : 'EVERY_DAY';
      if (!effectiveDays.length) effectiveDays = [...WEEK_DAYS];
    }

    return {
      workoutTime: s.workoutTime,
      workoutDays: custom.length ? custom : null,
      effectiveDays,
      daysSource,
      workoutDurationMin: s.workoutDurationMin,
      preWorkoutLeadMin: s.preWorkoutLeadMin,
      postWorkoutDelayMin: s.postWorkoutDelayMin,
    };
  }

  /**
   * When and on which days a reminder actually fires. Workout-linked
   * reminders follow the workout schedule, moving to the previous or next
   * day if the offset crosses midnight. Without a workout time set they
   * fall back to their own time and days.
   */
  private scheduleFor(r: MealReminder, w: WorkoutSchedule) {
    const ownDays = asDayList(r.repeatDays);
    const own = {
      time: r.reminderTime,
      days: ownDays.length ? ownDays : [...WEEK_DAYS],
      basedOnWorkout: false,
      needsWorkoutTime: r.workoutLink !== 'NONE' && !w.workoutTime,
    };
    if (r.workoutLink === 'NONE' || !w.workoutTime) return own;

    const start = toMinutes(w.workoutTime);
    let minutes =
      r.workoutLink === 'BEFORE'
        ? start - w.preWorkoutLeadMin
        : start + w.workoutDurationMin + w.postWorkoutDelayMin;
    let dayOffset = 0;
    while (minutes < 0) {
      minutes += MINUTES_PER_DAY;
      dayOffset -= 1;
    }
    while (minutes >= MINUTES_PER_DAY) {
      minutes -= MINUTES_PER_DAY;
      dayOffset += 1;
    }
    return {
      time: toHhmm(minutes),
      days: shiftDays(w.effectiveDays, dayOffset),
      basedOnWorkout: true,
      needsWorkoutTime: false,
    };
  }

  private present(r: MealReminder, w: WorkoutSchedule) {
    const type = r.reminderType as ReminderTypeDto;
    return {
      ...r,
      repeatDays: asDayList(r.repeatDays),
      typeLabel: TYPE_LABELS[type],
      mealType: TYPE_MEAL[type] ?? null,
      schedule: this.scheduleFor(r, w),
    };
  }

  private async getOwned(userId: string, id: string) {
    const row = await this.prisma.mealReminder.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Reminder not found');
    return row;
  }

  /** Same type, time, days and workout link as an existing reminder = duplicate. */
  private async assertNotDuplicate(
    userId: string,
    r: {
      reminderType: string;
      reminderTime: string;
      repeatDays: WeekDayName[];
      workoutLink: string;
    },
    exceptId?: string,
  ) {
    const same = await this.prisma.mealReminder.findMany({
      where: {
        userId,
        reminderType: r.reminderType as any,
        workoutLink: r.workoutLink as any,
        ...(r.workoutLink === 'NONE' ? { reminderTime: r.reminderTime } : {}),
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    const key = r.repeatDays.join(',');
    if (same.some((s) => r.workoutLink !== 'NONE' || asDayList(s.repeatDays).join(',') === key)) {
      throw new ConflictException('You already have a reminder like this one');
    }
  }
}
