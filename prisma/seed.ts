/**
 * Seeds the database.
 *
 * Everything here goes through normal Prisma CRUD operations — the admin
 * account is created as a real `users` row with a hashed password, not wired
 * into the auth code. Change the password through the API afterwards and the
 * new one takes effect immediately.
 *
 * Safe to re-run: records are upserted by a natural key.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as dotenv from 'dotenv';
import { CATEGORIES, EXERCISES, FOODS, GOAL_TYPES } from './seed-data';

dotenv.config();

const prisma = new PrismaClient();

// The admin login comes only from .env, so no real credentials live in the repo.
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before seeding.');
}
const ADMIN_EMAIL = process.env.ADMIN_EMAIL.toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';
const BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

const img = (file: string) => `${BASE_URL}/uploads/library/${file}`;

function dateOnly(value: string | Date): Date {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return dateOnly(d);
}

async function main() {
  console.log('Seeding personal_gym_db ...');

  // ---------------------------------------------------------------- user
  const passwordHash = await argon2.hash(ADMIN_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, isActive: true, role: 'ADMIN' },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log(`  user           : ${user.email}`);

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      fullName: ADMIN_NAME,
      gender: 'MALE',
      dateOfBirth: dateOnly('1999-05-20'),
      heightCm: 175,
      currentWeightKg: 72.5,
      gymJoiningDate: daysAgo(180),
      experienceLevel: 'INTERMEDIATE',
      profileImageUrl: img('avatar-placeholder.jpg'),
      notes: 'Personal gym tracking account.',
    },
  });

  await prisma.userSetting.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      theme: 'SYSTEM',
      dailyWaterTargetMl: 3000,
      dailyCalorieTarget: 2400,
      dailyProteinTargetG: 150,
      dailyCarbsTargetG: 260,
      dailyFatTargetG: 70,
      weeklyWorkoutTarget: 5,
      defaultRestSeconds: 75,
    },
  });

  // ---------------------------------------------------------- categories
  const categoryIds = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.workoutCategory.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        description: c.description,
        imageUrl: img(c.image),
        iconName: c.iconName,
        colorHex: c.colorHex,
        displayOrder: c.displayOrder,
      },
      create: {
        userId: null, // built-in
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: img(c.image),
        iconName: c.iconName,
        colorHex: c.colorHex,
        displayOrder: c.displayOrder,
        isCustom: false,
      },
    });
    categoryIds.set(c.slug, row.id);
  }
  console.log(`  categories     : ${categoryIds.size}`);

  // ----------------------------------------------------------- exercises
  const exerciseIds = new Map<string, string>();
  for (const e of EXERCISES) {
    const categoryId = categoryIds.get(e.categorySlug);
    if (!categoryId) {
      console.warn(`  ! skipped "${e.name}": unknown category ${e.categorySlug}`);
      continue;
    }

    // `name` is not unique in the schema, so find-then-write keeps the seed
    // idempotent without forcing a unique constraint on exercise names.
    const existing = await prisma.exercise.findFirst({
      where: { name: e.name, userId: null },
      select: { id: true },
    });

    const data = {
      categoryId,
      name: e.name,
      description: e.description,
      instructions: e.instructions,
      targetMuscle: e.targetMuscle,
      secondaryMuscles: e.secondaryMuscles,
      equipment: e.equipment,
      difficultyLevel: e.difficultyLevel,
      imageUrl: img(e.image),
      videoUrl: e.videoUrl ?? null,
      caloriesPerMin: e.caloriesPerMin,
      isCustom: false,
      isActive: true,
    };

    const row = existing
      ? await prisma.exercise.update({ where: { id: existing.id }, data })
      : await prisma.exercise.create({ data: { ...data, userId: null } });

    exerciseIds.set(e.name, row.id);
  }
  console.log(`  exercises      : ${exerciseIds.size}`);

  const ex = (name: string): string => {
    const id = exerciseIds.get(name);
    if (!id) throw new Error(`Seed error: exercise "${name}" was not created`);
    return id;
  };

  // ----------------------------------------------------------- goal types
  // Goal types are rows, not a hardcoded enum, so they can be managed in-app.
  const goalTypeIds = new Map<string, string>();
  for (const t of GOAL_TYPES) {
    const row = await prisma.goalType.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        description: t.description,
        iconName: t.iconName,
        colorHex: t.colorHex,
        displayOrder: t.displayOrder,
      },
      create: {
        userId: null, // built-in
        name: t.name,
        slug: t.slug,
        description: t.description,
        iconName: t.iconName,
        colorHex: t.colorHex,
        displayOrder: t.displayOrder,
        isCustom: false,
      },
    });
    goalTypeIds.set(t.slug, row.id);
  }
  console.log(`  goal types     : ${goalTypeIds.size}`);

  // ---------------------------------------------------------------- goal
  const existingGoal = await prisma.fitnessGoal.findFirst({
    where: { userId: user.id },
  });
  if (!existingGoal) {
    await prisma.fitnessGoal.create({
      data: {
        userId: user.id,
        goalTypeId: goalTypeIds.get('muscle-gain')!,
        title: 'Lean Muscle Gain',
        startingWeightKg: 70,
        targetWeightKg: 78,
        targetBodyFatPercentage: 14,
        startDate: daysAgo(60),
        targetDate: daysAgo(-120),
        status: 'ACTIVE',
        notes: 'Progressive overload with a slight calorie surplus.',
      },
    });
    console.log('  goal           : Lean Muscle Gain');
  }

  // ---------------------------------------------------------------- plan
  let plan = await prisma.workoutPlan.findFirst({
    where: { userId: user.id, planName: 'Push Pull Legs' },
  });

  if (!plan) {
    plan = await prisma.workoutPlan.create({
      data: {
        userId: user.id,
        planName: 'Push Pull Legs',
        description:
          'Six-day push / pull / legs split with one rest day. Progressive overload each week.',
        coverImageUrl: img('plan-cover-push.jpg'),
        startDate: daysAgo(60),
        status: 'ACTIVE',
        difficultyLevel: 'INTERMEDIATE',
        exercises: {
          create: [
            // MONDAY — Push (Chest + Shoulders + Triceps)
            { exerciseId: ex('Barbell Bench Press'), scheduledDay: 'MONDAY', displayOrder: 0, targetSets: 4, targetReps: 8, targetWeightKg: 60, restSeconds: 90 },
            { exerciseId: ex('Incline Dumbbell Press'), scheduledDay: 'MONDAY', displayOrder: 1, targetSets: 3, targetReps: 10, targetWeightKg: 22, restSeconds: 75 },
            { exerciseId: ex('Overhead Barbell Press'), scheduledDay: 'MONDAY', displayOrder: 2, targetSets: 3, targetReps: 8, targetWeightKg: 35, restSeconds: 90 },
            { exerciseId: ex('Dumbbell Lateral Raise'), scheduledDay: 'MONDAY', displayOrder: 3, targetSets: 3, targetReps: 15, targetWeightKg: 8, restSeconds: 45 },
            { exerciseId: ex('Cable Tricep Pushdown'), scheduledDay: 'MONDAY', displayOrder: 4, targetSets: 3, targetReps: 12, targetWeightKg: 25, restSeconds: 60 },

            // TUESDAY — Pull (Back + Biceps)
            { exerciseId: ex('Deadlift'), scheduledDay: 'TUESDAY', displayOrder: 0, targetSets: 4, targetReps: 6, targetWeightKg: 100, restSeconds: 120 },
            { exerciseId: ex('Pull Ups'), scheduledDay: 'TUESDAY', displayOrder: 1, targetSets: 3, targetReps: 10, restSeconds: 90 },
            { exerciseId: ex('Bent Over Barbell Row'), scheduledDay: 'TUESDAY', displayOrder: 2, targetSets: 3, targetReps: 10, targetWeightKg: 50, restSeconds: 75 },
            { exerciseId: ex('Seated Cable Row'), scheduledDay: 'TUESDAY', displayOrder: 3, targetSets: 3, targetReps: 12, targetWeightKg: 45, restSeconds: 60 },
            { exerciseId: ex('Barbell Bicep Curl'), scheduledDay: 'TUESDAY', displayOrder: 4, targetSets: 3, targetReps: 12, targetWeightKg: 25, restSeconds: 60 },

            // WEDNESDAY — Legs
            { exerciseId: ex('Barbell Back Squat'), scheduledDay: 'WEDNESDAY', displayOrder: 0, targetSets: 4, targetReps: 8, targetWeightKg: 80, restSeconds: 120 },
            { exerciseId: ex('Romanian Deadlift'), scheduledDay: 'WEDNESDAY', displayOrder: 1, targetSets: 3, targetReps: 10, targetWeightKg: 60, restSeconds: 90 },
            { exerciseId: ex('Leg Press'), scheduledDay: 'WEDNESDAY', displayOrder: 2, targetSets: 3, targetReps: 12, targetWeightKg: 120, restSeconds: 75 },
            { exerciseId: ex('Leg Curl'), scheduledDay: 'WEDNESDAY', displayOrder: 3, targetSets: 3, targetReps: 12, targetWeightKg: 35, restSeconds: 60 },
            { exerciseId: ex('Standing Calf Raise'), scheduledDay: 'WEDNESDAY', displayOrder: 4, targetSets: 4, targetReps: 15, targetWeightKg: 50, restSeconds: 45 },

            // THURSDAY — Shoulders + Abs
            { exerciseId: ex('Arnold Press'), scheduledDay: 'THURSDAY', displayOrder: 0, targetSets: 4, targetReps: 10, targetWeightKg: 16, restSeconds: 75 },
            { exerciseId: ex('Face Pull'), scheduledDay: 'THURSDAY', displayOrder: 1, targetSets: 3, targetReps: 15, targetWeightKg: 20, restSeconds: 45 },
            { exerciseId: ex('Hanging Leg Raise'), scheduledDay: 'THURSDAY', displayOrder: 2, targetSets: 3, targetReps: 12, restSeconds: 60 },
            { exerciseId: ex('Cable Crunch'), scheduledDay: 'THURSDAY', displayOrder: 3, targetSets: 3, targetReps: 15, targetWeightKg: 30, restSeconds: 45 },
            { exerciseId: ex('Plank'), scheduledDay: 'THURSDAY', displayOrder: 4, targetSets: 3, targetReps: 1, restSeconds: 45 },

            // FRIDAY — Chest + Back
            { exerciseId: ex('Incline Dumbbell Press'), scheduledDay: 'FRIDAY', displayOrder: 0, targetSets: 4, targetReps: 10, targetWeightKg: 24, restSeconds: 75 },
            { exerciseId: ex('Cable Chest Fly'), scheduledDay: 'FRIDAY', displayOrder: 1, targetSets: 3, targetReps: 15, targetWeightKg: 15, restSeconds: 60 },
            { exerciseId: ex('Lat Pulldown'), scheduledDay: 'FRIDAY', displayOrder: 2, targetSets: 4, targetReps: 10, targetWeightKg: 55, restSeconds: 75 },
            { exerciseId: ex('Seated Cable Row'), scheduledDay: 'FRIDAY', displayOrder: 3, targetSets: 3, targetReps: 12, targetWeightKg: 50, restSeconds: 60 },

            // SATURDAY — Arms + Cardio
            { exerciseId: ex('Dumbbell Hammer Curl'), scheduledDay: 'SATURDAY', displayOrder: 0, targetSets: 4, targetReps: 12, targetWeightKg: 12, restSeconds: 60 },
            { exerciseId: ex('Close Grip Bench Press'), scheduledDay: 'SATURDAY', displayOrder: 1, targetSets: 4, targetReps: 10, targetWeightKg: 45, restSeconds: 75 },
            { exerciseId: ex('Incline Dumbbell Curl'), scheduledDay: 'SATURDAY', displayOrder: 2, targetSets: 3, targetReps: 12, targetWeightKg: 10, restSeconds: 60 },
            { exerciseId: ex('Overhead Tricep Extension'), scheduledDay: 'SATURDAY', displayOrder: 3, targetSets: 3, targetReps: 12, targetWeightKg: 20, restSeconds: 60 },
            { exerciseId: ex('Treadmill Running'), scheduledDay: 'SATURDAY', displayOrder: 4, targetSets: 1, targetReps: 1, restSeconds: 0 },

            // SUNDAY — rest (no exercises scheduled)
          ],
        },
      },
    });
    console.log('  workout plan   : Push Pull Legs (6 training days)');
  }

  // ------------------------------------------------------- weight logs
  const weightCount = await prisma.weightLog.count({ where: { userId: user.id } });
  if (weightCount === 0) {
    // A gentle upward trend with realistic daily noise.
    const entries: { recordedDate: Date; weightKg: number }[] = [];
    for (let i = 60; i >= 0; i -= 2) {
      const progress = (60 - i) / 60;
      const noise = (Math.sin(i * 1.7) + Math.cos(i * 0.8)) * 0.25;
      entries.push({
        recordedDate: daysAgo(i),
        weightKg: Number((70 + progress * 2.5 + noise).toFixed(1)),
      });
    }
    await prisma.weightLog.createMany({
      data: entries.map((e) => ({ userId: user.id, ...e })),
      skipDuplicates: true,
    });

    const newest = entries[entries.length - 1];
    await prisma.profile.update({
      where: { userId: user.id },
      data: { currentWeightKg: newest.weightKg },
    });
    console.log(`  weight logs    : ${entries.length}`);
  }

  // ------------------------------------------------- body measurements
  const measurementCount = await prisma.bodyMeasurement.count({
    where: { userId: user.id },
  });
  if (measurementCount === 0) {
    const rows = [60, 40, 20, 0].map((d, i) => ({
      userId: user.id,
      recordedDate: daysAgo(d),
      chestCm: 98 + i * 1.2,
      waistCm: 82 - i * 0.6,
      hipsCm: 96 + i * 0.3,
      leftArmCm: 33 + i * 0.5,
      rightArmCm: 33.2 + i * 0.5,
      leftThighCm: 55 + i * 0.7,
      rightThighCm: 55.2 + i * 0.7,
      leftCalfCm: 36 + i * 0.2,
      rightCalfCm: 36.1 + i * 0.2,
      neckCm: 38 + i * 0.1,
      shouldersCm: 118 + i * 1.0,
      bodyFatPercentage: Number((19 - i * 0.7).toFixed(1)),
    }));
    await prisma.bodyMeasurement.createMany({ data: rows, skipDuplicates: true });
    console.log(`  measurements   : ${rows.length}`);
  }

  // ---------------------------------------------------- workout history
  const sessionCount = await prisma.workoutSession.count({
    where: { userId: user.id },
  });
  if (sessionCount === 0 && plan) {
    const planExercises = await prisma.workoutPlanExercise.findMany({
      where: { workoutPlanId: plan.id },
      include: { exercise: { include: { category: true } } },
    });

    const DAY_NAMES = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];

    let created = 0;
    // Four weeks of history, skipping Sundays, with weights creeping upward.
    for (let d = 28; d >= 1; d -= 1) {
      const date = daysAgo(d);
      const dayName = DAY_NAMES[date.getUTCDay()];
      if (dayName === 'SUNDAY') continue;

      const dayExercises = planExercises.filter((e) => e.scheduledDay === dayName);
      if (!dayExercises.length) continue;

      const weekIndex = Math.floor((28 - d) / 7);
      const startedAt = new Date(date);
      startedAt.setUTCHours(18, 0, 0, 0);
      const durationSeconds = 3300 + Math.round(Math.sin(d) * 600);
      const completedAt = new Date(startedAt.getTime() + durationSeconds * 1000);

      const groups = [
        ...new Set(dayExercises.map((e) => e.exercise.category?.name).filter(Boolean)),
      ];

      const session = await prisma.workoutSession.create({
        data: {
          userId: user.id,
          workoutPlanId: plan.id,
          title: groups.join(' + ') || 'Workout',
          sessionDate: date,
          startedAt,
          completedAt,
          durationSeconds,
          status: 'COMPLETED',
          caloriesBurned: Math.round((durationSeconds / 60) * 7.5),
        },
      });

      let totalVolume = 0;
      for (const [index, pe] of dayExercises.entries()) {
        const sessionExercise = await prisma.sessionExercise.create({
          data: {
            workoutSessionId: session.id,
            exerciseId: pe.exerciseId,
            displayOrder: index,
            targetSets: pe.targetSets,
            targetReps: pe.targetReps,
            restSeconds: pe.restSeconds,
            status: 'COMPLETED',
          },
        });

        const baseWeight = pe.targetWeightKg ? Number(pe.targetWeightKg) : 0;
        for (let s = 1; s <= pe.targetSets; s += 1) {
          // Progressive overload: +2.5% per week, minus a little per set.
          const weight = baseWeight
            ? Number(
                (baseWeight * (1 + weekIndex * 0.025) - (s - 1) * baseWeight * 0.02).toFixed(1),
              )
            : 0;
          const reps = Math.max(4, pe.targetReps - (s - 1));

          await prisma.sessionSet.create({
            data: {
              sessionExerciseId: sessionExercise.id,
              setNumber: s,
              reps,
              weightKg: weight,
              completed: true,
              restSeconds: pe.restSeconds,
            },
          });
          totalVolume += reps * weight;
        }
      }

      await prisma.workoutSession.update({
        where: { id: session.id },
        data: { totalVolumeKg: Number(totalVolume.toFixed(2)) },
      });

      await prisma.gymAttendance.upsert({
        where: {
          userId_attendanceDate: { userId: user.id, attendanceDate: date },
        },
        update: {},
        create: {
          userId: user.id,
          attendanceDate: date,
          checkInAt: startedAt,
          checkOutAt: completedAt,
          durationMinutes: Math.round(durationSeconds / 60),
        },
      });

      created += 1;
    }
    console.log(`  workouts       : ${created} completed sessions`);
  }

  // --------------------------------------------------------- nutrition
  const foodCount = await prisma.foodLog.count({ where: { userId: user.id } });
  if (foodCount === 0) {
    const template = [
      { foodName: 'Oatmeal with Fruits', mealType: 'BREAKFAST', calories: 450, proteinG: 18, carbsG: 68, fatG: 10, hour: 8, image: 'meal-breakfast.jpg' },
      { foodName: 'Whey Protein Shake', mealType: 'POST_WORKOUT', calories: 160, proteinG: 30, carbsG: 5, fatG: 2, hour: 10, image: 'meal-snack.jpg' },
      { foodName: 'Grilled Chicken Salad', mealType: 'LUNCH', calories: 550, proteinG: 48, carbsG: 32, fatG: 20, hour: 13, image: 'meal-lunch.jpg' },
      { foodName: 'Greek Yogurt', mealType: 'SNACKS', calories: 150, proteinG: 15, carbsG: 12, fatG: 4, hour: 16, image: 'meal-snack.jpg' },
      { foodName: 'Salmon with Veggies', mealType: 'DINNER', calories: 620, proteinG: 45, carbsG: 38, fatG: 28, hour: 20, image: 'meal-dinner.jpg' },
    ];

    const rows: any[] = [];
    for (let d = 6; d >= 0; d -= 1) {
      const day = daysAgo(d);
      for (const t of template) {
        const consumedAt = new Date(day);
        consumedAt.setUTCHours(t.hour, 0, 0, 0);
        rows.push({
          userId: user.id,
          foodName: t.foodName,
          mealType: t.mealType as any,
          quantity: 1,
          quantityUnit: 'serving',
          calories: t.calories,
          proteinG: t.proteinG,
          carbsG: t.carbsG,
          fatG: t.fatG,
          imageUrl: img(t.image),
          consumedAt,
          loggedDate: day,
        });
      }
    }
    await prisma.foodLog.createMany({ data: rows });
    console.log(`  food logs      : ${rows.length}`);
  }

  // ------------------------------------------------------------- water
  const waterCount = await prisma.waterLog.count({ where: { userId: user.id } });
  if (waterCount === 0) {
    const rows: any[] = [];
    for (let d = 6; d >= 0; d -= 1) {
      const day = daysAgo(d);
      for (const hour of [8, 10, 12, 14, 16, 18, 20]) {
        const recordedAt = new Date(day);
        recordedAt.setUTCHours(hour, 0, 0, 0);
        rows.push({
          userId: user.id,
          amountMl: hour % 4 === 0 ? 500 : 250,
          recordedAt,
          loggedDate: day,
        });
      }
    }
    await prisma.waterLog.createMany({ data: rows });
    console.log(`  water logs     : ${rows.length}`);
  }

  // ------------------------------------------------------------- sleep
  const sleepCount = await prisma.sleepLog.count({ where: { userId: user.id } });
  if (sleepCount === 0) {
    const qualities = ['GOOD', 'EXCELLENT', 'FAIR', 'GOOD', 'GOOD', 'EXCELLENT', 'FAIR'];
    const rows: any[] = [];
    for (let d = 6; d >= 0; d -= 1) {
      const wake = daysAgo(d);
      wake.setUTCHours(6, 30, 0, 0);
      const start = new Date(wake.getTime() - (7 * 60 + 20 + d * 7) * 60000);
      rows.push({
        userId: user.id,
        sleepStart: start,
        sleepEnd: wake,
        durationMinutes: Math.round((wake.getTime() - start.getTime()) / 60000),
        sleepQuality: qualities[d] as any,
        loggedDate: daysAgo(d),
      });
    }
    await prisma.sleepLog.createMany({ data: rows });
    console.log(`  sleep logs     : ${rows.length}`);
  }

  // ---------------------------------------------------- progress photos
  const photoCount = await prisma.progressPhoto.count({ where: { userId: user.id } });
  if (photoCount === 0) {
    await prisma.progressPhoto.createMany({
      data: [
        {
          userId: user.id,
          photoUrl: img('onboarding-1.jpg'),
          photoType: 'FRONT',
          capturedDate: daysAgo(60),
          weightKg: 70,
          notes: 'Starting point.',
        },
        {
          userId: user.id,
          photoUrl: img('onboarding-2.jpg'),
          photoType: 'FRONT',
          capturedDate: daysAgo(30),
          weightKg: 71.4,
          notes: 'One month in.',
        },
        {
          userId: user.id,
          photoUrl: img('onboarding-3.jpg'),
          photoType: 'SIDE',
          capturedDate: daysAgo(1),
          weightKg: 72.5,
          notes: 'Two months in.',
        },
      ],
    });
    console.log('  photos         : 3');
  }

  console.log('\nSeed complete.');
  console.log(`  Sign in with : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
