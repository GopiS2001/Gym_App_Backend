/**
 * One-off import of gym_workout_plans_exercise_library.md into the live
 * database. Not part of the seed: run it manually, it is safe to re-run.
 *
 *   node scripts/import-gym-library.js            # dry run, prints the plan
 *   node scripts/import-gym-library.js --apply    # writes to the database
 *
 * - Categories are matched by slug; missing ones are created.
 * - Exercises are matched by name (case/punctuation-insensitive). Existing
 *   ones are kept, only their empty fields are filled.
 * - Plans are matched by name. An existing plan that has no exercises gets
 *   filled; a plan that already has exercises is left alone. New plans are
 *   created as DRAFT so the current active plan is not replaced.
 * - Numbered instructions are read from the markdown file itself.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const APPLY = process.argv.includes('--apply');
const MD_PATH = path.join(__dirname, '..', '..', 'gym_workout_plans_exercise_library.md');

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// ------------------------------------------------------------ categories

const NEW_CATEGORIES = {
  'hip-abductors': { name: 'Hip Abductors', colorHex: '#2DD4BF', iconName: 'move-horizontal' },
  cardio: { name: 'Cardio', colorHex: '#F87171', iconName: 'heart-pulse' },
};

// ---------------------------------------------------------- exercises
// [name, level, target, secondary, equipment]
// Levels: B = Beginner, BI = Beginner–Intermediate, I = Intermediate, A = Advanced.

const LIBRARY = {
  chest: [
    ['Machine Chest Press', 'B', 'Pectoralis major', 'Triceps, Front deltoids', 'Chest press machine'],
    ['Push-up', 'B', 'Pectoralis major', 'Triceps, Front deltoids, Core', 'Bodyweight'],
    ['Dumbbell Bench Press', 'BI', 'Pectoralis major', 'Triceps, Front deltoids', 'Dumbbells, bench'],
    ['Incline Dumbbell Press', 'I', 'Upper chest', 'Triceps, Front deltoids', 'Dumbbells, incline bench'],
    ['Cable Crossover', 'I', 'Pectoralis major', 'Front deltoids', 'Cable machine'],
    ['Pec Deck Fly', 'BI', 'Pectoralis major', 'Front deltoids', 'Pec deck machine'],
    ['Decline Press', 'I', 'Lower chest emphasis', 'Triceps, Front deltoids', 'Bench, barbell/dumbbells'],
    ['Weighted Dip', 'A', 'Chest emphasis', 'Triceps, Front deltoids', 'Dip station, optional weight'],
  ],
  back: [
    ['Lat Pulldown', 'B', 'Latissimus dorsi', 'Biceps, Rhomboids', 'Pulldown machine'],
    ['Seated Cable Row', 'B', 'Mid-back, lats', 'Biceps, Rear deltoids', 'Cable row'],
    ['One-Arm Dumbbell Row', 'BI', 'Lats, mid-back', 'Biceps, Rear deltoids', 'Dumbbell, bench'],
    ['Chest-Supported Row', 'I', 'Mid-back', 'Lats, Biceps', 'Bench, dumbbells/machine'],
    ['Assisted Pull-up', 'BI', 'Lats', 'Biceps, Mid-back', 'Assisted pull-up machine'],
    ['Pull-up', 'A', 'Lats', 'Biceps, Forearms, Core', 'Pull-up bar'],
    ['Straight-Arm Pulldown', 'I', 'Lats', 'Teres major, Core stabilisers', 'Cable machine'],
    ['Face Pull', 'BI', 'Rear deltoids, upper back', 'Rotator cuff, Traps', 'Rope cable'],
  ],
  shoulders: [
    ['Seated Dumbbell Shoulder Press', 'BI', 'Front and side deltoids', 'Triceps, Upper chest', 'Dumbbells, bench'],
    ['Machine Shoulder Press', 'B', 'Front and side deltoids', 'Triceps', 'Shoulder press machine'],
    ['Dumbbell Lateral Raise', 'BI', 'Side deltoids', 'Supraspinatus, Upper traps', 'Dumbbells'],
    ['Front Raise', 'BI', 'Front deltoids', 'Upper chest', 'Dumbbells/plate'],
    ['Reverse Pec Deck', 'BI', 'Rear deltoids', 'Rhomboids, Middle traps', 'Reverse pec deck'],
    ['Cable Lateral Raise', 'I', 'Side deltoids', 'Supraspinatus', 'Cable machine'],
    ['Arnold Press', 'I', 'Front and side deltoids', 'Triceps', 'Dumbbells'],
    ['Upright Row', 'I', 'Side deltoids, upper traps', 'Biceps', 'Cable/barbell'],
    ['Rear Delt Cable Fly', 'I', 'Rear deltoids', 'Rhomboids, Traps', 'Cable machine'],
  ],
  biceps: [
    ['Dumbbell Biceps Curl', 'B', 'Biceps brachii', 'Brachialis, Brachioradialis', 'Dumbbells'],
    ['EZ-Bar Curl', 'BI', 'Biceps brachii', 'Brachialis, Forearms', 'EZ bar'],
    ['Hammer Curl', 'B', 'Brachialis, brachioradialis', 'Biceps', 'Dumbbells'],
    ['Preacher Curl', 'I', 'Biceps brachii', 'Brachialis', 'Preacher bench, EZ bar/dumbbell'],
    ['Incline Dumbbell Curl', 'I', 'Biceps brachii', 'Brachialis', 'Incline bench, dumbbells'],
    ['Cable Curl', 'BI', 'Biceps brachii', 'Forearms', 'Cable machine'],
    ['Concentration Curl', 'I', 'Biceps brachii', 'Brachialis', 'Dumbbell'],
    ['Reverse Curl', 'I', 'Brachioradialis', 'Brachialis, Forearm extensors', 'EZ bar/dumbbells'],
  ],
  triceps: [
    ['Rope Triceps Pushdown', 'B', 'Triceps brachii', 'Forearm stabilisers', 'Cable, rope'],
    ['Straight-Bar Pushdown', 'B', 'Triceps brachii', 'Forearm stabilisers', 'Cable, bar'],
    ['Overhead Dumbbell Extension', 'BI', 'Triceps, long head emphasis', 'Core stabilisers', 'Dumbbell'],
    ['Overhead Cable Extension', 'I', 'Triceps, long head emphasis', 'Core stabilisers', 'Cable, rope'],
    ['Close-Grip Push-up', 'BI', 'Triceps', 'Chest, Front deltoids', 'Bodyweight'],
    ['Skull Crusher', 'I', 'Triceps brachii', 'Forearm stabilisers', 'EZ bar/dumbbells, bench'],
    ['Assisted Dip', 'I', 'Triceps', 'Chest, Front deltoids', 'Assisted dip machine'],
    ['Cable Kickback', 'I', 'Triceps', 'Shoulder stabilisers', 'Cable'],
  ],
  quadriceps: [
    ['Bodyweight Squat', 'B', 'Quadriceps, glutes', 'Core, Adductors', 'Bodyweight'],
    ['Goblet Squat', 'B', 'Quadriceps, glutes', 'Core, Adductors', 'Dumbbell/kettlebell'],
    ['Leg Press', 'B', 'Quadriceps', 'Glutes, Hamstrings', 'Leg press machine'],
    ['Leg Extension', 'B', 'Quadriceps', '', 'Leg extension machine'],
    ['Barbell Back Squat', 'I', 'Quadriceps, glutes', 'Core, Adductors, Hamstrings', 'Barbell, rack'],
    ['Bulgarian Split Squat', 'I', 'Quadriceps, glutes', 'Hamstrings, Core', 'Dumbbells, bench'],
    ['Front Squat', 'A', 'Quadriceps', 'Glutes, Core, Upper back', 'Barbell, rack'],
    ['Walking Lunge', 'I', 'Quadriceps, glutes', 'Hamstrings, Core', 'Bodyweight/dumbbells'],
  ],
  hamstrings: [
    ['Seated Leg Curl', 'B', 'Hamstrings', 'Calves', 'Leg curl machine'],
    ['Lying Leg Curl', 'B', 'Hamstrings', 'Calves', 'Leg curl machine'],
    ['Dumbbell Romanian Deadlift', 'BI', 'Hamstrings, glutes', 'Lower back, Core', 'Dumbbells'],
    ['Barbell Romanian Deadlift', 'I', 'Hamstrings, glutes', 'Spinal erectors, Core', 'Barbell'],
    ['Good Morning', 'A', 'Hamstrings, glutes', 'Spinal erectors, Core', 'Barbell'],
    ['Single-Leg Romanian Deadlift', 'I', 'Hamstrings, glutes', 'Core, Balance stabilisers', 'Dumbbell'],
    ['Glute-Ham Raise', 'A', 'Hamstrings', 'Glutes, Calves', 'GHD machine'],
  ],
  glutes: [
    ['Glute Bridge', 'B', 'Gluteus maximus', 'Hamstrings, Core', 'Bodyweight'],
    ['Hip Thrust', 'BI', 'Gluteus maximus', 'Hamstrings, Core', 'Bench, barbell'],
    ['Cable Glute Kickback', 'BI', 'Gluteus maximus', 'Hamstrings, Core', 'Cable, ankle strap'],
    ['Step-up', 'BI', 'Glutes, quadriceps', 'Hamstrings, Calves', 'Box/bench'],
    ['Cable Hip Abduction', 'B', 'Gluteus medius/minimus', 'Tensor fasciae latae', 'Cable, ankle strap'],
    ['Sumo Squat', 'I', 'Glutes, adductors', 'Quadriceps, Core', 'Dumbbell/kettlebell'],
  ],
  calves: [
    ['Standing Calf Raise', 'B', 'Gastrocnemius', 'Soleus', 'Bodyweight/machine'],
    ['Seated Calf Raise', 'B', 'Soleus', 'Gastrocnemius', 'Seated calf machine'],
    ['Leg Press Calf Press', 'BI', 'Gastrocnemius, soleus', 'Foot stabilisers', 'Leg press'],
    ['Single-Leg Calf Raise', 'I', 'Gastrocnemius, soleus', 'Ankle stabilisers', 'Step/bodyweight'],
    ['Donkey Calf Raise', 'I', 'Gastrocnemius', 'Soleus', 'Donkey calf machine'],
  ],
  'abs-core': [
    ['Plank', 'B', 'Deep core, rectus abdominis', 'Shoulders, Glutes', 'Bodyweight'],
    ['Dead Bug', 'B', 'Deep core', 'Hip flexors, Obliques', 'Bodyweight'],
    ['Crunch', 'B', 'Rectus abdominis', 'Obliques', 'Bodyweight'],
    ['Reverse Crunch', 'BI', 'Rectus abdominis', 'Hip flexors', 'Bodyweight'],
    ['Side Plank', 'BI', 'Obliques', 'Gluteus medius, Shoulders', 'Bodyweight'],
    ['Cable Crunch', 'I', 'Rectus abdominis', 'Obliques', 'Cable, rope'],
    ['Hanging Knee Raise', 'I', 'Rectus abdominis', 'Hip flexors, Grip', 'Pull-up bar'],
    ['Pallof Press', 'BI', 'Core anti-rotation muscles', 'Shoulders, Glutes', 'Cable/band'],
    ['Cable Wood Chop', 'I', 'Obliques', 'Shoulders, Hips', 'Cable'],
  ],
  forearms: [
    ['Wrist Curl', 'B', 'Wrist flexors', 'Finger flexors', 'Dumbbell/barbell'],
    ['Reverse Wrist Curl', 'BI', 'Wrist extensors', 'Forearm stabilisers', 'Dumbbell/barbell'],
    ['Farmer Carry', 'BI', 'Grip and forearms', 'Traps, Core, Shoulders', 'Dumbbells'],
    ['Dead Hang', 'I', 'Grip muscles', 'Lats, Shoulders', 'Pull-up bar'],
  ],
  traps: [
    ['Dumbbell Shrug', 'B', 'Upper trapezius', 'Levator scapulae, Forearms', 'Dumbbells'],
    ['Barbell Shrug', 'I', 'Upper trapezius', 'Forearms', 'Barbell'],
    ['Prone Y Raise', 'BI', 'Lower trapezius', 'Rear deltoids', 'Bench, light weights'],
    ['Cable Shrug', 'I', 'Upper trapezius', 'Forearms', 'Cable machine'],
  ],
  'hip-adductors': [
    ['Hip Adduction Machine', 'B', 'Hip adductors', 'Core stabilisers', 'Adductor machine'],
    ['Cable Hip Adduction', 'I', 'Hip adductors', 'Core stabilisers', 'Cable, ankle strap'],
  ],
  'hip-abductors': [
    ['Hip Abduction Machine', 'B', 'Gluteus medius/minimus', 'Tensor fasciae latae', 'Abductor machine'],
    ['Side-Lying Leg Raise', 'B', 'Gluteus medius', 'Gluteus minimus', 'Bodyweight'],
    ['Lateral Band Walk', 'BI', 'Gluteus medius/minimus', 'Hip stabilisers', 'Resistance band'],
  ],
};

// Used by the plans but missing from the library section of the file.
// Their instructions are written here, not taken from the markdown.
const EXTRA = {
  chest: [
    ['Barbell Bench Press', 'I', 'Pectoralis major', 'Triceps, Front deltoids', 'Barbell, flat bench, rack', [
      'Lie on the bench with eyes under the bar and feet flat on the floor.',
      'Grip the bar slightly wider than shoulder width and unrack it with straight arms.',
      'Lower the bar under control to the mid-chest.',
      'Press back up over the shoulders without bouncing off the chest.',
      'Use safety pins or a spotter for heavy sets.',
    ]],
    ['Incline Barbell Press', 'I', 'Upper chest', 'Triceps, Front deltoids', 'Barbell, incline bench, rack', [
      'Set the bench to a modest incline and lie with eyes under the bar.',
      'Grip slightly wider than shoulder width and unrack with straight arms.',
      'Lower the bar to the upper chest under control.',
      'Press back up in a smooth line.',
      'Use safety pins or a spotter for heavy sets.',
    ]],
    ['Incline Push-up', 'B', 'Pectoralis major', 'Triceps, Front deltoids, Core', 'Bench/box', [
      'Place hands slightly wider than shoulder width on a stable bench or box.',
      'Step back so your body forms a straight line from head to heels.',
      'Lower your chest toward the edge under control.',
      'Push away to return to the start.',
      'Use a higher surface to make it easier, a lower one to make it harder.',
    ]],
  ],
  hamstrings: [
    ['Deadlift', 'I', 'Hamstrings, glutes, lower back', 'Quadriceps, Traps, Forearms, Core', 'Barbell', [
      'Stand with mid-foot under the bar, feet about hip-width apart.',
      'Hinge and grip the bar just outside your legs with a neutral back.',
      'Brace your core and push the floor away to stand up, keeping the bar close.',
      'Lower the bar by pushing hips back, then bending the knees.',
      'Only load heavily once technique is consistent.',
    ]],
  ],
  shoulders: [
    ['Overhead Press', 'I', 'Front and side deltoids', 'Triceps, Upper chest, Core', 'Barbell', [
      'Hold the bar at shoulder height with hands just outside the shoulders.',
      'Brace your core and squeeze your glutes.',
      'Press the bar overhead, moving your head back slightly to clear it.',
      'Lower under control to the shoulders.',
      'Avoid leaning back or over-arching the lower back.',
    ]],
  ],
  biceps: [
    ['Cable Hammer Curl', 'BI', 'Brachialis, brachioradialis', 'Biceps', 'Cable, rope', [
      'Attach a rope to a low pulley and hold it with palms facing each other.',
      'Stand tall with elbows close to your sides.',
      'Curl the rope toward your shoulders without rotating your wrists.',
      'Lower slowly while keeping cable tension.',
      'Avoid swinging your torso.',
    ]],
  ],
  quadriceps: [
    ['Split Squat', 'B', 'Quadriceps, glutes', 'Hamstrings, Core', 'Bodyweight/dumbbells', [
      'Stand in a long staggered stance with both feet on the floor.',
      'Keep your torso upright and core braced.',
      'Lower the back knee toward the floor under control.',
      'Push through the front foot to rise.',
      'Complete all repetitions, then switch legs.',
    ]],
    ['Reverse Lunge', 'B', 'Quadriceps, glutes', 'Hamstrings, Core', 'Bodyweight/dumbbells', [
      'Stand tall with feet hip-width apart.',
      'Step one foot back and lower both knees under control.',
      'Keep the front knee in line with the foot.',
      'Push through the front foot to return to standing.',
      'Alternate legs or complete one side at a time.',
    ]],
  ],
  cardio: [
    ['Stationary Bike', 'B', 'Cardiovascular endurance', 'Quadriceps, Glutes, Hamstrings, Calves', 'Stationary bike', [
      'Adjust the seat so your knee stays slightly bent at the bottom of the pedal stroke.',
      'Start with 2–3 minutes of easy pedalling.',
      'Ride at the planned pace or interval pattern.',
      'Keep your upper body relaxed and posture upright.',
      'Finish with a few minutes of easy pedalling.',
    ]],
  ],
};

const LEVEL = { B: 'BEGINNER', BI: 'BEGINNER', I: 'INTERMEDIATE', A: 'ADVANCED' };

// ---------------------------------------------------------------- plans
// Shorthand names used in the plans → library name.
const ALIAS = {
  'Dumbbell Shoulder Press': 'Seated Dumbbell Shoulder Press',
  'Seated Shoulder Press': 'Seated Dumbbell Shoulder Press',
  'Shoulder Press': 'Machine Shoulder Press',
  'Cable Triceps Pushdown': 'Rope Triceps Pushdown',
  'Triceps Pushdown': 'Rope Triceps Pushdown',
  'Lateral Raise': 'Dumbbell Lateral Raise',
  'Romanian Deadlift': 'Barbell Romanian Deadlift',
  'Leg Curl': 'Lying Leg Curl',
  'Calf Raise': 'Standing Calf Raise',
  'Overhead Cable Triceps Extension': 'Overhead Cable Extension',
  'Overhead Triceps Extension': 'Overhead Dumbbell Extension',
  Squat: 'Barbell Back Squat',
  'Bench Press': 'Barbell Bench Press',
  'Chest Press': 'Machine Chest Press',
  'Dumbbell Curl': 'Dumbbell Biceps Curl',
  'Biceps Curl': 'Dumbbell Biceps Curl',
  'Cable Row': 'Seated Cable Row',
  'Seated Row': 'Seated Cable Row',
};

// Exercise line: [name, sets, reps (number stored), detail shown in notes]
const W = {
  p1A: [
    ['Bodyweight Squat', 2, 10, '10–12 reps'],
    ['Machine Chest Press', 2, 10, '10–12 reps'],
    ['Lat Pulldown', 2, 10, '10–12 reps'],
    ['Dumbbell Shoulder Press', 2, 10, '10 reps'],
    ['Seated Leg Curl', 2, 12, '12 reps'],
    ['Plank', 2, 20, '20–30 sec hold'],
  ],
  p1B: [
    ['Goblet Squat', 2, 10, '10 reps'],
    ['Seated Cable Row', 2, 10, '10–12 reps'],
    ['Incline Push-up', 2, 8, '8–12 reps'],
    ['Dumbbell Romanian Deadlift', 2, 10, '10 reps'],
    ['Dumbbell Biceps Curl', 2, 12, '12 reps'],
    ['Cable Triceps Pushdown', 2, 12, '12 reps'],
  ],
  p2A: [
    ['Goblet Squat', 3, 10, '10 reps'],
    ['Machine Chest Press', 3, 10, '10 reps'],
    ['Lat Pulldown', 3, 10, '10 reps'],
    ['Dumbbell Shoulder Press', 2, 10, '10 reps'],
    ['Dumbbell Biceps Curl', 2, 12, '12 reps'],
    ['Cable Triceps Pushdown', 2, 12, '12 reps'],
  ],
  p2B: [
    ['Leg Press', 3, 10, '10 reps'],
    ['Incline Dumbbell Press', 3, 10, '10 reps'],
    ['Seated Cable Row', 3, 10, '10 reps'],
    ['Dumbbell Romanian Deadlift', 3, 10, '10 reps'],
    ['Lateral Raise', 2, 12, '12 reps'],
    ['Plank', 3, 20, '20–40 sec hold'],
  ],
  p3UA: [
    ['Barbell Bench Press', 3, 8, '8–10 reps'],
    ['Lat Pulldown', 3, 10, '10 reps'],
    ['Seated Dumbbell Shoulder Press', 3, 10, '10 reps'],
    ['Seated Cable Row', 3, 10, '10 reps'],
    ['Dumbbell Biceps Curl', 2, 12, '12 reps'],
    ['Rope Triceps Pushdown', 2, 12, '12 reps'],
  ],
  p3LA: [
    ['Goblet Squat', 3, 8, '8–10 reps · or Barbell Back Squat'],
    ['Leg Press', 3, 10, '10 reps'],
    ['Romanian Deadlift', 3, 10, '10 reps'],
    ['Leg Curl', 2, 12, '12 reps'],
    ['Standing Calf Raise', 3, 12, '12–15 reps'],
    ['Plank', 3, 30, '30 sec hold'],
  ],
  p3UB: [
    ['Incline Dumbbell Press', 3, 10, '10 reps'],
    ['Chest-Supported Row', 3, 10, '10 reps'],
    ['Dumbbell Lateral Raise', 3, 12, '12–15 reps'],
    ['Face Pull', 2, 12, '12–15 reps'],
    ['Hammer Curl', 2, 12, '12 reps'],
    ['Overhead Cable Triceps Extension', 2, 12, '12 reps'],
  ],
  p3LB: [
    ['Deadlift', 3, 5, '5–8 reps · deadlift variation, only with sound technique'],
    ['Bulgarian Split Squat', 2, 8, '8 reps each leg'],
    ['Hip Thrust', 3, 10, '10 reps'],
    ['Seated Leg Curl', 2, 12, '12 reps'],
    ['Seated Calf Raise', 3, 15, '15 reps'],
    ['Dead Bug', 3, 10, '10 reps each side'],
  ],
  p4PushA: [
    ['Barbell Bench Press', 3, 8, '8–10 reps'],
    ['Incline Dumbbell Press', 3, 10, '10 reps'],
    ['Seated Shoulder Press', 2, 10, '10 reps'],
    ['Dumbbell Lateral Raise', 3, 12, '12–15 reps'],
    ['Rope Triceps Pushdown', 3, 12, '12 reps'],
  ],
  p4PullA: [
    ['Lat Pulldown', 3, 10, '10 reps'],
    ['Seated Cable Row', 3, 10, '10 reps'],
    ['One-Arm Dumbbell Row', 2, 10, '10 reps each side'],
    ['Face Pull', 2, 15, '15 reps'],
    ['EZ-Bar Curl', 3, 10, '10–12 reps'],
    ['Hammer Curl', 2, 12, '12 reps'],
  ],
  p4LegsA: [
    ['Squat', 3, 8, '8–10 reps'],
    ['Leg Press', 3, 10, '10 reps'],
    ['Romanian Deadlift', 3, 10, '10 reps'],
    ['Leg Curl', 2, 12, '12 reps'],
    ['Calf Raise', 3, 15, '15 reps'],
    ['Plank', 3, 30, '30 sec hold'],
  ],
  p4PushB: [
    ['Incline Barbell Press', 3, 8, '8–10 reps'],
    ['Machine Chest Press', 2, 10, '10–12 reps'],
    ['Arnold Press', 2, 10, '10 reps'],
    ['Cable Lateral Raise', 3, 12, '12 reps'],
    ['Overhead Triceps Extension', 3, 12, '12 reps'],
  ],
  p4PullB: [
    ['Assisted Pull-up', 3, 6, '6–10 reps'],
    ['Chest-Supported Row', 3, 10, '10 reps'],
    ['Straight-Arm Pulldown', 2, 12, '12 reps'],
    ['Reverse Pec Deck', 2, 15, '15 reps'],
    ['Preacher Curl', 2, 10, '10–12 reps'],
    ['Cable Hammer Curl', 2, 12, '12 reps'],
  ],
  p4LegsB: [
    ['Front Squat', 3, 8, '8–10 reps · or Goblet Squat'],
    ['Bulgarian Split Squat', 2, 8, '8 reps each leg'],
    ['Hip Thrust', 3, 10, '10 reps'],
    ['Seated Leg Curl', 2, 12, '12 reps'],
    ['Seated Calf Raise', 3, 15, '15 reps'],
    ['Reverse Crunch', 3, 12, '12 reps'],
  ],
  p5A: [
    ['Leg Press', 3, 10, '10–12 reps'],
    ['Chest Press', 3, 10, '10–12 reps'],
    ['Lat Pulldown', 3, 10, '10–12 reps'],
    ['Dumbbell Romanian Deadlift', 2, 10, '10 reps'],
    ['Lateral Raise', 2, 12, '12–15 reps'],
    ['Plank', 3, 20, '20–40 sec hold'],
  ],
  p5B: [
    ['Goblet Squat', 3, 10, '10 reps'],
    ['Incline Dumbbell Press', 3, 10, '10 reps'],
    ['Seated Cable Row', 3, 10, '10 reps'],
    ['Step-up', 2, 10, '10 reps each leg'],
    ['Dumbbell Curl', 2, 12, '12 reps'],
    ['Triceps Pushdown', 2, 12, '12 reps'],
  ],
  p5Cardio: [['Stationary Bike', 1, 20, 'Moderate cardio, 20–30 minutes']],
  p5CardioMob: [['Stationary Bike', 1, 20, 'Moderate cardio 20–30 minutes, then mobility']],
  p6Mon: [
    ['Squat', 3, 5, '5 reps'],
    ['Bench Press', 3, 5, '5 reps'],
    ['Lat Pulldown', 3, 8, '8 reps'],
    ['Plank', 3, 30, '30 sec hold'],
  ],
  p6Wed: [
    ['Deadlift', 3, 5, '5 reps · deadlift variation'],
    ['Overhead Press', 3, 6, '6 reps'],
    ['Seated Cable Row', 3, 8, '8 reps'],
    ['Split Squat', 2, 8, '8 reps each leg'],
  ],
  p6Fri: [
    ['Leg Press', 3, 8, '8 reps'],
    ['Dumbbell Bench Press', 3, 8, '8 reps'],
    ['Chest-Supported Row', 3, 8, '8 reps'],
    ['Hip Thrust', 2, 10, '10 reps'],
    ['Farmer Carry', 3, 20, '20 metres'],
  ],
  p7Upper: [
    ['Incline Dumbbell Press', 3, 10, '10 reps'],
    ['Lat Pulldown', 3, 10, '10 reps'],
    ['Shoulder Press', 2, 10, '10 reps'],
    ['Cable Row', 2, 12, '12 reps'],
    ['Biceps Curl', 2, 12, '12 reps'],
    ['Triceps Pushdown', 2, 12, '12 reps'],
  ],
  p7Lower: [
    ['Goblet Squat', 3, 10, '10 reps'],
    ['Romanian Deadlift', 3, 10, '10 reps'],
    ['Reverse Lunge', 2, 10, '10 reps each leg'],
    ['Leg Curl', 2, 12, '12 reps'],
    ['Calf Raise', 3, 15, '15 reps'],
  ],
  p7Full: [
    ['Leg Press', 3, 12, '12 reps'],
    ['Push-up', 3, 8, '8–12 reps'],
    ['Seated Row', 3, 12, '12 reps'],
    ['Hip Thrust', 3, 10, '10 reps'],
    ['Dead Bug', 3, 10, '10 reps each side'],
  ],
  p7Cond: [
    ['Stationary Bike', 1, 10, '10–15 minutes, moderate pace'],
    ['Step-up', 2, 10, '10 reps each leg'],
    ['Cable Wood Chop', 2, 12, '12 reps each side'],
    ['Side Plank', 2, 20, '20–30 sec each side'],
  ],
  p8Strength: [
    ['Goblet Squat', 3, 10, '10 reps'],
    ['Push-up', 3, 8, '8–12 reps'],
    ['Cable Row', 3, 12, '12 reps'],
    ['Dumbbell Romanian Deadlift', 3, 10, '10 reps'],
    ['Farmer Carry', 3, 20, '20 metres'],
  ],
  p8Steady: [['Stationary Bike', 1, 25, 'Steady cardio, 25–35 minutes']],
  p8Circuit: [
    ['Step-up', 2, 10, 'Circuit · 10 each leg · 2–3 rounds'],
    ['Incline Push-up', 2, 10, 'Circuit · 10 reps'],
    ['Lat Pulldown', 2, 12, 'Circuit · 12 reps'],
    ['Bodyweight Squat', 2, 12, 'Circuit · 12 reps'],
    ['Dead Bug', 2, 10, 'Circuit · 10 each side'],
  ],
  p8Intervals: [['Stationary Bike', 1, 20, 'Cardio intervals at a manageable pace']],
};

// days: [weekday, session label, workout key]
const PLANS = [
  {
    name: 'Beginner Full Body Foundation',
    level: 'BEGINNER', rest: 75,
    meta: 'General fitness · Beginner · Full body · 6 weeks · 3 days/week',
    goal: 'Learn safe movement patterns and build a consistent training habit.',
    schedule: 'Mon Full Body A · Tue rest / easy walk · Wed Full Body B · Thu rest · Fri Full Body A · Sat optional easy cardio + mobility · Sun rest',
    days: [['MONDAY', 'Full Body A', 'p1A'], ['WEDNESDAY', 'Full Body B', 'p1B'], ['FRIDAY', 'Full Body A', 'p1A']],
  },
  {
    name: 'Beginner Muscle Builder',
    level: 'BEGINNER', rest: 90,
    meta: 'Muscle gain · Beginner · Full body · 8 weeks · 3 days/week',
    goal: 'Build foundational muscle and improve exercise technique.',
    schedule: 'Mon Full Body A · Wed Full Body B · Fri Full Body A. Next week alternate B / A / B.',
    days: [['MONDAY', 'Full Body A', 'p2A'], ['WEDNESDAY', 'Full Body B', 'p2B'], ['FRIDAY', 'Full Body A', 'p2A']],
  },
  {
    name: 'Upper / Lower Muscle Growth',
    level: 'INTERMEDIATE', rest: 90,
    meta: 'Muscle gain · Intermediate · Upper / Lower · 8 weeks · 4 days/week',
    goal: 'Train upper and lower body twice weekly with recovery between sessions.',
    schedule: 'Mon Upper A · Tue Lower A · Wed rest · Thu Upper B · Fri Lower B · Sat optional light cardio / mobility · Sun rest',
    days: [['MONDAY', 'Upper A', 'p3UA'], ['TUESDAY', 'Lower A', 'p3LA'], ['THURSDAY', 'Upper B', 'p3UB'], ['FRIDAY', 'Lower B', 'p3LB']],
  },
  {
    name: 'Classic Push Pull Legs',
    level: 'INTERMEDIATE', rest: 90,
    meta: 'Muscle gain · Intermediate · PPL · 8–12 weeks · 5–6 days/week',
    goal: 'Muscle development using push, pull, and leg sessions. Use a 3-day version if recovery or experience is limited; the 6-day version is for suitably conditioned trainees.',
    schedule: 'Mon Push A · Tue Pull A · Wed Legs A · Thu rest · Fri Push B · Sat Pull B · Sun Legs B or rest',
    days: [
      ['MONDAY', 'Push A', 'p4PushA'], ['TUESDAY', 'Pull A', 'p4PullA'], ['WEDNESDAY', 'Legs A', 'p4LegsA'],
      ['FRIDAY', 'Push B', 'p4PushB'], ['SATURDAY', 'Pull B', 'p4PullB'], ['SUNDAY', 'Legs B (or rest)', 'p4LegsB'],
    ],
  },
  {
    name: 'Lean Muscle & Fat Loss',
    level: 'BEGINNER', rest: 75,
    meta: 'Fat loss + muscle retention · Beginner–Intermediate · Full body + cardio · 8 weeks · 4 days/week',
    goal: 'Support fat loss while maintaining muscle. Nutrition and overall daily activity also matter.',
    schedule: 'Mon Strength A · Tue moderate cardio 20–30 min · Wed Strength B · Thu rest / walking · Fri Strength A · Sat cardio + mobility · Sun rest',
    days: [
      ['MONDAY', 'Full Body Strength A', 'p5A'], ['TUESDAY', 'Cardio', 'p5Cardio'], ['WEDNESDAY', 'Full Body Strength B', 'p5B'],
      ['FRIDAY', 'Full Body Strength A', 'p5A'], ['SATURDAY', 'Cardio + Mobility', 'p5CardioMob'],
    ],
  },
  {
    name: 'Strength Foundation',
    level: 'BEGINNER', rest: 150,
    meta: 'Strength · Beginner–Intermediate · Full body compound · 8 weeks · 3 days/week',
    goal: 'Develop strength with controlled compound lifts and adequate rest.',
    schedule: 'Mon squat + upper push + core · Wed hinge + upper pull · Fri full body strength',
    days: [['MONDAY', 'Squat + Push + Core', 'p6Mon'], ['WEDNESDAY', 'Hinge + Pull', 'p6Wed'], ['FRIDAY', 'Full Body Strength', 'p6Fri']],
  },
  {
    name: 'Body Toning & Conditioning',
    level: 'INTERMEDIATE', rest: 60,
    meta: 'Fitness + muscle definition · Intermediate · Upper / Lower + conditioning · 8 weeks · 4 days/week',
    goal: 'Improve strength, work capacity, and overall muscle definition.',
    schedule: 'Mon Upper Body · Tue Lower Body · Wed rest / walk · Thu Full Body · Fri Conditioning + Core · Sat optional mobility · Sun rest',
    days: [['MONDAY', 'Upper Body', 'p7Upper'], ['TUESDAY', 'Lower Body', 'p7Lower'], ['THURSDAY', 'Full Body', 'p7Full'], ['FRIDAY', 'Conditioning + Core', 'p7Cond']],
  },
  {
    name: 'Athletic Endurance Builder',
    level: 'INTERMEDIATE', rest: 60,
    meta: 'Stamina + conditioning · Intermediate · Full body + cardio · 6–8 weeks · 4 days/week',
    goal: 'Improve general cardiovascular endurance and movement capacity.',
    schedule: 'Mon Full Body Strength · Tue steady cardio 25–35 min · Wed rest · Thu Full Body Circuit · Fri rest / easy walk · Sat cardio intervals · Sun rest',
    days: [
      ['MONDAY', 'Full Body Strength', 'p8Strength'], ['TUESDAY', 'Steady Cardio', 'p8Steady'],
      ['THURSDAY', 'Full Body Circuit', 'p8Circuit'], ['SATURDAY', 'Cardio Intervals', 'p8Intervals'],
    ],
  },
];

// ------------------------------------------------- markdown instructions

function readInstructions() {
  const md = fs.readFileSync(MD_PATH, 'utf8');
  const map = new Map();
  // Only paragraphs inside "### ... instructions" sections.
  const sections = md.split(/^### /m).slice(1).filter((s) => /^[^\n]*instructions/i.test(s));
  for (const section of sections) {
    const body = section.split(/^## |^# /m)[0];
    for (const para of body.split(/\n\s*\n/)) {
      const text = para.replace(/\s*\n\s*/g, ' ').trim();
      const m = /^\*\*(.+?)\*\*\s*(.*)$/.exec(text);
      if (!m) continue;
      const steps = m[2]
        .split(/(?:^|\s)\d+\.\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (steps.length && !map.has(norm(m[1]))) map.set(norm(m[1]), steps);
    }
  }
  return map;
}

// ------------------------------------------------------------------ run

async function main() {
  const prisma = new PrismaClient();
  const log = [];
  const say = (s) => log.push(s);

  const instructions = readInstructions();
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error('No user in the database');

  // Categories
  const cats = await prisma.workoutCategory.findMany();
  const catBySlug = new Map(cats.map((c) => [c.slug, c]));
  for (const slug of [...Object.keys(LIBRARY), ...Object.keys(EXTRA)]) {
    if (catBySlug.has(slug)) continue;
    const def = NEW_CATEGORIES[slug];
    if (!def) throw new Error(`Unknown category slug ${slug}`);
    say(`+ category ${def.name}`);
    const created = APPLY
      ? await prisma.workoutCategory.create({
          data: { ...def, slug, userId: user.id, isCustom: true, displayOrder: 99 },
        })
      : { id: `dry-${slug}`, slug, ...def };
    catBySlug.set(slug, created);
  }

  // Exercises
  const existing = await prisma.exercise.findMany();
  const exByName = new Map(existing.map((e) => [norm(e.name), e]));
  let added = 0;
  let filled = 0;
  const missingInstructions = [];

  const rows = [];
  for (const [slug, list] of Object.entries(LIBRARY)) for (const r of list) rows.push([slug, ...r, null]);
  for (const [slug, list] of Object.entries(EXTRA)) for (const r of list) rows.push([slug, ...r]);

  for (const [slug, name, lvl, target, secondary, equipment, ownSteps] of rows) {
    const steps = ownSteps || instructions.get(norm(name));
    if (!steps) missingInstructions.push(name);
    const data = {
      categoryId: catBySlug.get(slug).id,
      name,
      difficultyLevel: LEVEL[lvl],
      targetMuscle: target,
      secondaryMuscles: secondary ? secondary.split(/,\s*/) : [],
      equipment,
      instructions: steps ? steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : null,
      description: lvl === 'BI' ? 'Suitable for beginner to intermediate trainees.' : null,
    };

    const found = exByName.get(norm(name));
    if (found) {
      // Fill only what is empty; never overwrite the user's own edits.
      const patch = {};
      if (!found.targetMuscle) patch.targetMuscle = data.targetMuscle;
      const sec = Array.isArray(found.secondaryMuscles) ? found.secondaryMuscles : [];
      if (!sec.length && data.secondaryMuscles.length) patch.secondaryMuscles = data.secondaryMuscles;
      if (!found.equipment) patch.equipment = data.equipment;
      if (!found.instructions && data.instructions) patch.instructions = data.instructions;
      if (Object.keys(patch).length) {
        filled++;
        say(`~ exercise ${name}: fill ${Object.keys(patch).join(', ')}`);
        if (APPLY) await prisma.exercise.update({ where: { id: found.id }, data: patch });
      }
      continue;
    }

    added++;
    const created = APPLY
      ? await prisma.exercise.create({ data: { ...data, isCustom: false, isActive: true } })
      : { id: `dry-${norm(name)}`, name };
    exByName.set(norm(name), created);
  }
  say(`+ ${added} exercises, ~ ${filled} existing filled`);

  // Plans
  const plans = await prisma.workoutPlan.findMany({
    where: { userId: user.id },
    include: { _count: { select: { exercises: true } } },
  });
  const planByName = new Map(plans.map((p) => [norm(p.planName), p]));

  for (const plan of PLANS) {
    const lines = [];
    for (const [day, label, key] of plan.days) {
      W[key].forEach(([rawName, sets, reps, detail], order) => {
        const name = ALIAS[rawName] || rawName;
        const ex = exByName.get(norm(name));
        if (!ex) throw new Error(`Plan "${plan.name}" uses unknown exercise "${rawName}"`);
        const isCore = /plank|dead bug|crunch|carry|bike/i.test(name);
        lines.push({
          exerciseId: ex.id,
          scheduledDay: day,
          displayOrder: order,
          targetSets: sets,
          targetReps: reps,
          restSeconds: isCore ? 60 : plan.rest,
          notes: `${label} · ${detail}`,
        });
      });
    }

    const description = `${plan.goal}\n\n${plan.meta}\n\nWeekly schedule: ${plan.schedule}`;
    const found = planByName.get(norm(plan.name));

    if (found && found._count.exercises > 0) {
      say(`= plan ${plan.name}: already has exercises, left unchanged`);
      continue;
    }
    if (found) {
      say(`~ plan ${found.planName}: fill ${lines.length} exercises (status stays ${found.status})`);
      if (APPLY) {
        await prisma.$transaction([
          prisma.workoutPlan.update({
            where: { id: found.id },
            data: { description: found.description || description, difficultyLevel: plan.level },
          }),
          prisma.workoutPlanExercise.createMany({
            data: lines.map((l) => ({ ...l, workoutPlanId: found.id })),
          }),
        ]);
      }
      continue;
    }

    say(`+ plan ${plan.name}: ${lines.length} exercises, DRAFT`);
    if (APPLY) {
      await prisma.workoutPlan.create({
        data: {
          userId: user.id,
          planName: plan.name,
          description,
          difficultyLevel: plan.level,
          status: 'DRAFT',
          exercises: { create: lines },
        },
      });
    }
  }

  if (missingInstructions.length) say(`! no instructions found for: ${missingInstructions.join(', ')}`);
  console.log(`${APPLY ? 'APPLIED' : 'DRY RUN (use --apply to write)'}\n` + log.join('\n'));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
