import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  addDays,
  eachDay,
  endOfMonth,
  formatDateOnly,
  startOfMonth,
  startOfWeek,
  toDateOnly,
  weekDayOf,
} from '../common/utils/date.util';
import {
  bmiCategory,
  calculateAge,
  calculateBmi,
  currentStreak,
  estimateOneRepMax,
  goalProgressPercentage,
  round,
  toNumber,
} from '../common/utils/fitness.util';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Everything the home dashboard renders, in one response. */
  async dashboard(userId: string) {
    const today = toDateOnly(new Date());
    const weekStart = startOfWeek(today);
    const monthStart = startOfMonth(today);

    const [
      profile,
      settings,
      activeGoal,
      latestWeight,
      firstWeight,
      weekSessions,
      monthSessions,
      totalSessions,
      recentSessions,
      waterToday,
      foodToday,
      latestMeasurement,
      activePlan,
      attendanceDates,
      activeSession,
      lastSleep,
    ] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.userSetting.findUnique({ where: { userId } }),
      this.prisma.fitnessGoal.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.weightLog.findFirst({
        where: { userId },
        orderBy: { recordedDate: 'desc' },
      }),
      this.prisma.weightLog.findFirst({
        where: { userId },
        orderBy: { recordedDate: 'asc' },
      }),
      this.prisma.workoutSession.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          sessionDate: { gte: weekStart, lte: today },
        },
      }),
      this.prisma.workoutSession.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          sessionDate: { gte: monthStart, lte: today },
        },
      }),
      this.prisma.workoutSession.count({
        where: { userId, status: 'COMPLETED' },
      }),
      this.prisma.workoutSession.findMany({
        where: { userId, status: 'COMPLETED' },
        orderBy: { sessionDate: 'desc' },
        take: 5,
        include: {
          exercises: {
            include: {
              exercise: {
                select: {
                  name: true,
                  imageUrl: true,
                  category: { select: { name: true, colorHex: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.waterLog.findMany({ where: { userId, loggedDate: today } }),
      this.prisma.foodLog.findMany({ where: { userId, loggedDate: today } }),
      this.prisma.bodyMeasurement.findFirst({
        where: { userId },
        orderBy: { recordedDate: 'desc' },
      }),
      this.prisma.workoutPlan.findFirst({
        where: { userId, status: 'ACTIVE' },
        include: {
          exercises: {
            include: {
              exercise: {
                include: { category: { select: { name: true, colorHex: true } } },
              },
            },
            orderBy: { displayOrder: 'asc' },
          },
        },
      }),
      this.prisma.gymAttendance.findMany({
        where: { userId, attendanceDate: { gte: addDays(today, -90) } },
        select: { attendanceDate: true },
      }),
      this.prisma.workoutSession.findFirst({
        where: { userId, status: { in: ['IN_PROGRESS', 'PAUSED'] } },
        select: { id: true, title: true, startedAt: true, status: true },
      }),
      this.prisma.sleepLog.findFirst({
        where: { userId },
        orderBy: { loggedDate: 'desc' },
      }),
    ]);

    // ---- weight ----------------------------------------------------------
    const currentWeight = latestWeight
      ? toNumber(latestWeight.weightKg)
      : profile?.currentWeightKg
        ? toNumber(profile.currentWeightKg)
        : null;
    const startingWeight = firstWeight ? toNumber(firstWeight.weightKg) : currentWeight;
    const heightCm = profile?.heightCm ? toNumber(profile.heightCm) : null;
    const bmi = calculateBmi(currentWeight, heightCm);

    // ---- today's plan ----------------------------------------------------
    const todayName = weekDayOf(today);
    const todaysExercises =
      activePlan?.exercises.filter((e) => e.scheduledDay === todayName) ?? [];
    const completedToday = await this.prisma.workoutSession.findFirst({
      where: { userId, sessionDate: today, status: 'COMPLETED' },
      select: { id: true },
    });

    // ---- weekly activity bars -------------------------------------------
    const weekDays = eachDay(weekStart, addDays(weekStart, 6));
    const weeklyActivity = weekDays.map((day) => {
      const key = formatDateOnly(day);
      const daySessions = weekSessions.filter(
        (s) => formatDateOnly(s.sessionDate) === key,
      );
      return {
        date: key,
        label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][day.getUTCDay()],
        dayName: weekDayOf(day),
        isToday: key === formatDateOnly(today),
        sessionCount: daySessions.length,
        durationMinutes: Math.round(
          daySessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60,
        ),
        volumeKg: round(
          daySessions.reduce((sum, s) => sum + toNumber(s.totalVolumeKg), 0),
          1,
        ),
        caloriesBurned: daySessions.reduce((sum, s) => sum + s.caloriesBurned, 0),
      };
    });

    // ---- today's totals --------------------------------------------------
    const waterTotalMl = waterToday.reduce((sum, w) => sum + w.amountMl, 0);
    const waterTargetMl = settings?.dailyWaterTargetMl ?? 3000;
    const calorieTarget = settings?.dailyCalorieTarget ?? 2000;
    const caloriesConsumed = foodToday.reduce(
      (sum, f) => sum + toNumber(f.calories),
      0,
    );
    const todaySessionsAll = await this.prisma.workoutSession.findMany({
      where: { userId, sessionDate: today, status: 'COMPLETED' },
    });
    const caloriesBurnedToday = todaySessionsAll.reduce(
      (sum, s) => sum + s.caloriesBurned,
      0,
    );
    const activeMinutesToday = Math.round(
      todaySessionsAll.reduce((sum, s) => sum + s.durationSeconds, 0) / 60,
    );

    const weeklyTarget = settings?.weeklyWorkoutTarget ?? 5;

    return {
      greeting: this.greeting(),
      profile: profile
        ? {
            fullName: profile.fullName,
            profileImageUrl: profile.profileImageUrl,
            experienceLevel: profile.experienceLevel,
            age: calculateAge(profile.dateOfBirth),
            heightCm,
            gymJoiningDate: profile.gymJoiningDate,
          }
        : null,

      todaysProgress: {
        date: formatDateOnly(today),
        workoutMinutes: activeMinutesToday,
        caloriesBurned: caloriesBurnedToday,
        caloriesConsumed: round(caloriesConsumed, 0),
        calorieTarget,
        waterMl: waterTotalMl,
        waterTargetMl,
        waterPercentage: waterTargetMl
          ? round(Math.min(100, (waterTotalMl / waterTargetMl) * 100), 1)
          : 0,
        workoutCompleted: !!completedToday,
        // Overall ring: workout done, calories logged, water target reached.
        overallPercentage: round(
          ((completedToday ? 1 : 0) * 50 +
            Math.min(1, caloriesConsumed / calorieTarget) * 20 +
            Math.min(1, waterTotalMl / waterTargetMl) * 30),
          0,
        ),
      },

      weight: {
        currentKg: currentWeight,
        startingKg: startingWeight,
        targetKg: activeGoal?.targetWeightKg
          ? toNumber(activeGoal.targetWeightKg)
          : null,
        changeKg:
          currentWeight !== null && startingWeight !== null
            ? round(currentWeight - startingWeight, 2)
            : null,
        bmi,
        bmiCategory: bmiCategory(bmi),
        lastRecordedDate: latestWeight?.recordedDate ?? null,
      },

      activeGoal: activeGoal
        ? {
            ...activeGoal,
            currentWeightKg: currentWeight,
            progressPercentage: goalProgressPercentage(
              activeGoal.startingWeightKg ? toNumber(activeGoal.startingWeightKg) : null,
              activeGoal.targetWeightKg ? toNumber(activeGoal.targetWeightKg) : null,
              currentWeight,
            ),
          }
        : null,

      todaysWorkout: activePlan
        ? {
            planId: activePlan.id,
            planName: activePlan.planName,
            day: todayName,
            isRestDay: todaysExercises.length === 0,
            exerciseCount: todaysExercises.length,
            alreadyCompleted: !!completedToday,
            estimatedMinutes: Math.round(
              todaysExercises.reduce(
                (sum, e) => sum + e.targetSets * (45 + e.restSeconds),
                0,
              ) / 60,
            ),
            muscleGroups: [
              ...new Set(
                todaysExercises.map((e) => e.exercise.category?.name).filter(Boolean),
              ),
            ],
            exercises: todaysExercises.slice(0, 6).map((e) => ({
              id: e.id,
              exerciseId: e.exerciseId,
              name: e.exercise.name,
              imageUrl: e.exercise.imageUrl,
              targetSets: e.targetSets,
              targetReps: e.targetReps,
              categoryName: e.exercise.category?.name,
              colorHex: e.exercise.category?.colorHex,
            })),
          }
        : null,

      activeSession,

      weeklySummary: {
        weekStart: formatDateOnly(weekStart),
        workoutCount: weekSessions.length,
        target: weeklyTarget,
        completionPercentage: weeklyTarget
          ? round(Math.min(100, (weekSessions.length / weeklyTarget) * 100), 1)
          : 0,
        totalMinutes: Math.round(
          weekSessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60,
        ),
        totalVolumeKg: round(
          weekSessions.reduce((sum, s) => sum + toNumber(s.totalVolumeKg), 0),
          1,
        ),
        caloriesBurned: weekSessions.reduce((sum, s) => sum + s.caloriesBurned, 0),
        activity: weeklyActivity,
      },

      monthlySummary: {
        month: formatDateOnly(monthStart).slice(0, 7),
        workoutCount: monthSessions.length,
        totalMinutes: Math.round(
          monthSessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60,
        ),
        totalVolumeKg: round(
          monthSessions.reduce((sum, s) => sum + toNumber(s.totalVolumeKg), 0),
          1,
        ),
      },

      totals: {
        totalWorkouts: totalSessions,
        currentStreak: currentStreak(attendanceDates.map((a) => a.attendanceDate)),
        memberSinceDays: profile?.gymJoiningDate
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(profile.gymJoiningDate).getTime()) / 86_400_000,
              ),
            )
          : null,
      },

      latestMeasurement,
      lastSleep: lastSleep
        ? {
            ...lastSleep,
            durationHours: round(lastSleep.durationMinutes / 60, 1),
          }
        : null,

      recentActivity: recentSessions.map((s) => ({
        id: s.id,
        title: s.title,
        sessionDate: s.sessionDate,
        durationMinutes: Math.round(s.durationSeconds / 60),
        totalVolumeKg: toNumber(s.totalVolumeKg),
        caloriesBurned: s.caloriesBurned,
        exerciseCount: s.exercises.length,
        muscleGroups: [
          ...new Set(
            s.exercises.map((e) => e.exercise.category?.name).filter(Boolean),
          ),
        ],
        coverImageUrl:
          s.exercises.find((e) => e.exercise.imageUrl)?.exercise.imageUrl ?? null,
      })),
    };
  }

  /** Workout statistics over a window of days. */
  async workoutStats(userId: string, days = 30) {
    const to = toDateOnly(new Date());
    const from = addDays(to, -(days - 1));

    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        sessionDate: { gte: from, lte: to },
      },
      include: {
        exercises: {
          include: {
            sets: true,
            exercise: {
              select: { id: true, name: true, category: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { sessionDate: 'asc' },
    });

    const byDay = new Map<string, any>();
    for (const day of eachDay(from, to)) {
      byDay.set(formatDateOnly(day), {
        date: formatDateOnly(day),
        sessionCount: 0,
        durationMinutes: 0,
        volumeKg: 0,
        caloriesBurned: 0,
      });
    }
    for (const s of sessions) {
      const row = byDay.get(formatDateOnly(s.sessionDate));
      if (!row) continue;
      row.sessionCount += 1;
      row.durationMinutes += Math.round(s.durationSeconds / 60);
      row.volumeKg += toNumber(s.totalVolumeKg);
      row.caloriesBurned += s.caloriesBurned;
    }

    // Distribution across muscle groups, used by the analytics donut.
    const muscleCount = new Map<string, number>();
    for (const s of sessions) {
      for (const e of s.exercises) {
        const name = e.exercise.category?.name || 'Other';
        muscleCount.set(name, (muscleCount.get(name) || 0) + 1);
      }
    }
    const totalExerciseCount = [...muscleCount.values()].reduce((a, b) => a + b, 0);

    const totalSets = sessions.reduce(
      (sum, s) =>
        sum + s.exercises.reduce((c, e) => c + e.sets.filter((x) => x.completed).length, 0),
      0,
    );

    return {
      rangeDays: days,
      points: [...byDay.values()].map((p) => ({ ...p, volumeKg: round(p.volumeKg, 1) })),
      totals: {
        sessionCount: sessions.length,
        totalMinutes: Math.round(
          sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60,
        ),
        totalVolumeKg: round(
          sessions.reduce((sum, s) => sum + toNumber(s.totalVolumeKg), 0),
          1,
        ),
        totalSets,
        caloriesBurned: sessions.reduce((sum, s) => sum + s.caloriesBurned, 0),
        averageMinutes: sessions.length
          ? Math.round(
              sessions.reduce((sum, s) => sum + s.durationSeconds, 0) /
                sessions.length /
                60,
            )
          : 0,
        averageVolumeKg: sessions.length
          ? round(
              sessions.reduce((sum, s) => sum + toNumber(s.totalVolumeKg), 0) /
                sessions.length,
              1,
            )
          : 0,
      },
      muscleDistribution: [...muscleCount.entries()]
        .map(([name, count]) => ({
          name,
          count,
          percentage: totalExerciseCount
            ? round((count / totalExerciseCount) * 100, 1)
            : 0,
        }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /** Strength progression for one exercise, or the top movements overall. */
  async strengthProgress(userId: string, exerciseId?: string, limit = 10) {
    if (exerciseId) {
      const rows = await this.prisma.sessionExercise.findMany({
        where: {
          exerciseId,
          session: { userId, status: 'COMPLETED' },
        },
        include: {
          sets: { where: { completed: true } },
          session: { select: { sessionDate: true } },
          exercise: { select: { id: true, name: true } },
        },
        orderBy: { session: { sessionDate: 'asc' } },
      });

      const points = rows
        .filter((r) => r.sets.length)
        .map((r) => {
          const best = r.sets.reduce((max, s) =>
            toNumber(s.weightKg) > toNumber(max.weightKg) ? s : max,
          );
          return {
            date: formatDateOnly(r.session.sessionDate),
            maxWeightKg: toNumber(best.weightKg),
            reps: best.reps,
            estimatedOneRepMaxKg: estimateOneRepMax(toNumber(best.weightKg), best.reps),
            totalVolumeKg: round(
              r.sets.reduce((sum, s) => sum + toNumber(s.reps) * toNumber(s.weightKg), 0),
              1,
            ),
            setCount: r.sets.length,
          };
        });

      return {
        exerciseId,
        exerciseName: rows[0]?.exercise.name ?? null,
        points,
        personalRecordKg: points.length
          ? Math.max(...points.map((p) => p.maxWeightKg))
          : 0,
        bestEstimatedOneRepMaxKg: points.length
          ? Math.max(...points.map((p) => p.estimatedOneRepMaxKg))
          : 0,
        isEstimate: true,
        improvementKg:
          points.length > 1
            ? round(points[points.length - 1].maxWeightKg - points[0].maxWeightKg, 2)
            : 0,
      };
    }

    // No exercise given: return the personal records across all exercises.
    const rows = await this.prisma.sessionExercise.findMany({
      where: { session: { userId, status: 'COMPLETED' } },
      include: {
        sets: { where: { completed: true } },
        exercise: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            category: { select: { name: true, colorHex: true } },
          },
        },
        session: { select: { sessionDate: true } },
      },
    });

    const records = new Map<string, any>();
    for (const row of rows) {
      for (const set of row.sets) {
        const weight = toNumber(set.weightKg);
        const current = records.get(row.exercise.id);
        if (!current || weight > current.maxWeightKg) {
          records.set(row.exercise.id, {
            exerciseId: row.exercise.id,
            exerciseName: row.exercise.name,
            imageUrl: row.exercise.imageUrl,
            categoryName: row.exercise.category?.name,
            colorHex: row.exercise.category?.colorHex,
            maxWeightKg: weight,
            reps: set.reps,
            estimatedOneRepMaxKg: estimateOneRepMax(weight, set.reps),
            achievedOn: formatDateOnly(row.session.sessionDate),
          });
        }
      }
    }

    return {
      isEstimate: true,
      personalRecords: [...records.values()]
        .sort((a, b) => b.maxWeightKg - a.maxWeightKg)
        .slice(0, limit),
    };
  }

  /** A full month report combining training, body, nutrition and attendance. */
  async monthlyReport(userId: string, month?: string) {
    const reference = month ? toDateOnly(`${month}-01`) : toDateOnly(new Date());
    const from = startOfMonth(reference);
    const to = endOfMonth(reference);

    const [sessions, weights, foods, waters, attendance, sleeps] = await Promise.all([
      this.prisma.workoutSession.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          sessionDate: { gte: from, lte: to },
        },
        include: {
          exercises: { include: { exercise: { select: { name: true } }, sets: true } },
        },
      }),
      this.prisma.weightLog.findMany({
        where: { userId, recordedDate: { gte: from, lte: to } },
        orderBy: { recordedDate: 'asc' },
      }),
      this.prisma.foodLog.findMany({
        where: { userId, loggedDate: { gte: from, lte: to } },
      }),
      this.prisma.waterLog.findMany({
        where: { userId, loggedDate: { gte: from, lte: to } },
      }),
      this.prisma.gymAttendance.findMany({
        where: { userId, attendanceDate: { gte: from, lte: to } },
      }),
      this.prisma.sleepLog.findMany({
        where: { userId, loggedDate: { gte: from, lte: to } },
      }),
    ]);

    const exerciseCount = new Map<string, number>();
    for (const s of sessions) {
      for (const e of s.exercises) {
        exerciseCount.set(
          e.exercise.name,
          (exerciseCount.get(e.exercise.name) || 0) + 1,
        );
      }
    }

    const daysInMonth = eachDay(from, to).length;
    const nutritionDays = new Set(foods.map((f) => formatDateOnly(f.loggedDate))).size;

    return {
      month: formatDateOnly(from).slice(0, 7),
      monthLabel: from.toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      workouts: {
        count: sessions.length,
        totalMinutes: Math.round(
          sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60,
        ),
        totalVolumeKg: round(
          sessions.reduce((sum, s) => sum + toNumber(s.totalVolumeKg), 0),
          1,
        ),
        totalSets: sessions.reduce(
          (sum, s) =>
            sum +
            s.exercises.reduce(
              (c, e) => c + e.sets.filter((x) => x.completed).length,
              0,
            ),
          0,
        ),
        caloriesBurned: sessions.reduce((sum, s) => sum + s.caloriesBurned, 0),
        mostTrained: [...exerciseCount.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      },
      body: {
        startWeightKg: weights.length ? toNumber(weights[0].weightKg) : null,
        endWeightKg: weights.length
          ? toNumber(weights[weights.length - 1].weightKg)
          : null,
        changeKg:
          weights.length > 1
            ? round(
                toNumber(weights[weights.length - 1].weightKg) -
                  toNumber(weights[0].weightKg),
                2,
              )
            : null,
        entriesLogged: weights.length,
      },
      nutrition: {
        daysLogged: nutritionDays,
        totalCalories: round(
          foods.reduce((sum, f) => sum + toNumber(f.calories), 0),
          0,
        ),
        averageDailyCalories: nutritionDays
          ? round(
              foods.reduce((sum, f) => sum + toNumber(f.calories), 0) / nutritionDays,
              0,
            )
          : 0,
        averageDailyProteinG: nutritionDays
          ? round(
              foods.reduce((sum, f) => sum + toNumber(f.proteinG), 0) / nutritionDays,
              1,
            )
          : 0,
      },
      hydration: {
        totalMl: waters.reduce((sum, w) => sum + w.amountMl, 0),
        daysLogged: new Set(waters.map((w) => formatDateOnly(w.loggedDate))).size,
      },
      sleep: {
        nightsLogged: sleeps.length,
        averageHours: sleeps.length
          ? round(
              sleeps.reduce((sum, s) => sum + s.durationMinutes, 0) /
                sleeps.length /
                60,
              1,
            )
          : 0,
      },
      attendance: {
        daysAttended: attendance.length,
        daysInMonth,
        consistencyPercentage: round((attendance.length / daysInMonth) * 100, 1),
        totalMinutes: attendance.reduce((sum, a) => sum + a.durationMinutes, 0),
      },
    };
  }

  private greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
}
