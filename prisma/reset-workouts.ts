/**
 * Resets the workout side of the database.
 *
 * Deletes every workout plan, recorded session, exercise and category, then
 * restores the built-in categories and exercise library from seed-data.
 *
 * Deliberately does NOT touch: profile, settings, fitness goals, goal types,
 * weight logs, body measurements, progress photos, nutrition, water or sleep.
 *
 * This is destructive and cannot be undone.
 *
 *   npm run reset:workouts                      wipe, restore categories + exercises
 *   npm run reset:workouts -- --no-exercises    wipe, restore categories only
 *   npm run reset:workouts -- --no-categories   wipe, restore nothing
 *   npm run reset:workouts -- --clear-attendance   also clear gym attendance
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { CATEGORIES, EXERCISES } from './seed-data';

dotenv.config();

const prisma = new PrismaClient();
const BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
const img = (file: string) => `${BASE_URL}/uploads/library/${file}`;

async function main() {
  const keepAttendance = !process.argv.includes('--clear-attendance');
  // --no-categories implies no exercises, since every exercise needs one.
  const restoreCategories = !process.argv.includes('--no-categories');
  const restoreExercises =
    restoreCategories && !process.argv.includes('--no-exercises');

  console.log('Resetting workout data ...\n');

  // ---------------------------------------------------------- before
  const before = {
    plans: await prisma.workoutPlan.count(),
    planExercises: await prisma.workoutPlanExercise.count(),
    sessions: await prisma.workoutSession.count(),
    sessionExercises: await prisma.sessionExercise.count(),
    sets: await prisma.sessionSet.count(),
    exercises: await prisma.exercise.count(),
    categories: await prisma.workoutCategory.count(),
    favourites: await prisma.exerciseFavourite.count(),
    attendance: await prisma.gymAttendance.count(),
  };
  console.log('  before:', JSON.stringify(before));

  // ---------------------------------------------------------- delete
  // Ordered child-first. Cascades would cover most of this, but doing it
  // explicitly keeps the counts honest and survives schema changes.
  await prisma.$transaction(async (tx) => {
    await tx.sessionSet.deleteMany({});
    await tx.sessionExercise.deleteMany({});
    await tx.workoutSession.deleteMany({});
    await tx.workoutPlanExercise.deleteMany({});
    await tx.workoutPlan.deleteMany({});
    await tx.exerciseFavourite.deleteMany({});
    await tx.exercise.deleteMany({});
    // Categories restrict on exercises, so they can only go once those have.
    await tx.workoutCategory.deleteMany({});
    if (!keepAttendance) await tx.gymAttendance.deleteMany({});
  });
  console.log('  deleted: plans, sessions, sets, exercises, categories');

  // ------------------------------------------------- restore library
  const categoryIds = new Map<string, string>();
  for (const c of restoreCategories ? CATEGORIES : []) {
    const row = await prisma.workoutCategory.create({
      data: {
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

  let exerciseCount = 0;
  for (const e of restoreExercises ? EXERCISES : []) {
    const categoryId = categoryIds.get(e.categorySlug);
    if (!categoryId) continue;
    await prisma.exercise.create({
      data: {
        userId: null,
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
      },
    });
    exerciseCount += 1;
  }

  // ----------------------------------------------------------- after
  const after = {
    plans: await prisma.workoutPlan.count(),
    sessions: await prisma.workoutSession.count(),
    sets: await prisma.sessionSet.count(),
    exercises: await prisma.exercise.count(),
    categories: await prisma.workoutCategory.count(),
    attendance: await prisma.gymAttendance.count(),
  };

  console.log(`  restored: ${categoryIds.size} categories, ${exerciseCount} exercises\n`);
  console.log('  after:', JSON.stringify(after));
  console.log(
    keepAttendance
      ? '\n  Gym attendance was kept. Re-run with --clear-attendance to remove it too.'
      : '\n  Gym attendance cleared.',
  );
  console.log('\nDone. Your profile, goals, weight, measurements, photos,');
  console.log('nutrition, water and sleep records were not touched.');
}

main()
  .catch((e) => {
    console.error('Reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
