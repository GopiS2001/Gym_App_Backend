/**
 * Reference data for the seed: workout categories and the built-in exercise
 * library. Image URLs point at files downloaded into E:\GYM\Images and served
 * by the backend from /uploads/library.
 */

export interface SeedCategory {
  name: string;
  slug: string;
  description: string;
  iconName: string;
  colorHex: string;
  displayOrder: number;
  image: string;
}

export const CATEGORIES: SeedCategory[] = [
  {
    name: 'Chest',
    slug: 'chest',
    description: 'Pressing movements for the pectorals, front delts and triceps.',
    iconName: 'dumbbell',
    colorHex: '#34D399',
    displayOrder: 1,
    image: 'category-chest.jpg',
  },
  {
    name: 'Back',
    slug: 'back',
    description: 'Pulling movements for the lats, traps and rear delts.',
    iconName: 'arrow-down',
    colorHex: '#60A5FA',
    displayOrder: 2,
    image: 'category-back.jpg',
  },
  {
    name: 'Shoulders',
    slug: 'shoulders',
    description: 'Overhead presses and raises for all three deltoid heads.',
    iconName: 'arrow-up',
    colorHex: '#FBBF24',
    displayOrder: 3,
    image: 'category-shoulders.jpg',
  },
  {
    name: 'Biceps',
    slug: 'biceps',
    description: 'Curling movements for the biceps and forearms.',
    iconName: 'zap',
    colorHex: '#F472B6',
    displayOrder: 4,
    image: 'category-biceps.jpg',
  },
  {
    name: 'Triceps',
    slug: 'triceps',
    description: 'Extension movements for all three triceps heads.',
    iconName: 'activity',
    colorHex: '#A78BFA',
    displayOrder: 5,
    image: 'category-triceps.jpg',
  },
  {
    name: 'Legs',
    slug: 'legs',
    description: 'Squats, hinges and isolation work for quads, hamstrings and glutes.',
    iconName: 'trending-up',
    colorHex: '#FB923C',
    displayOrder: 6,
    image: 'category-legs.jpg',
  },
  {
    name: 'Abs',
    slug: 'abs',
    description: 'Core strength and stability work.',
    iconName: 'target',
    colorHex: '#2DD4BF',
    displayOrder: 7,
    image: 'category-abs.jpg',
  },
  {
    name: 'Cardio',
    slug: 'cardio',
    description: 'Conditioning work for endurance and fat loss.',
    iconName: 'heart',
    colorHex: '#F87171',
    displayOrder: 8,
    image: 'category-cardio.jpg',
  },
  {
    name: 'Full Body',
    slug: 'full-body',
    description: 'Compound movements that train several groups at once.',
    iconName: 'layers',
    colorHex: '#818CF8',
    displayOrder: 9,
    image: 'category-fullbody.jpg',
  },
  {
    name: 'Mobility',
    slug: 'mobility',
    description: 'Stretching and mobility work for recovery and range of motion.',
    iconName: 'wind',
    colorHex: '#94A3B8',
    displayOrder: 10,
    image: 'category-mobility.jpg',
  },
];

export interface SeedExercise {
  name: string;
  categorySlug: string;
  targetMuscle: string;
  secondaryMuscles: string[];
  equipment: string;
  difficultyLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  caloriesPerMin: number;
  description: string;
  instructions: string;
  image: string;
  videoUrl?: string;
}

export const EXERCISES: SeedExercise[] = [
  // ---------------------------------------------------------------- CHEST
  {
    name: 'Barbell Bench Press',
    categorySlug: 'chest',
    targetMuscle: 'Pectoralis Major',
    secondaryMuscles: ['Triceps', 'Front Deltoids'],
    equipment: 'Barbell',
    difficultyLevel: 'INTERMEDIATE',
    caloriesPerMin: 8,
    description:
      'The primary horizontal pressing movement for building chest strength and size.',
    instructions:
      '1. Lie flat on the bench with your eyes under the bar.\n2. Grip the bar slightly wider than shoulder width.\n3. Unrack and lower the bar to mid-chest with control.\n4. Keep your elbows at roughly 45 degrees.\n5. Press back to full extension without locking out harshly.',
    image: 'exercise-bench-press.jpg',
  },
  {
    name: 'Incline Dumbbell Press',
    categorySlug: 'chest',
    targetMuscle: 'Upper Pectorals',
    secondaryMuscles: ['Front Deltoids', 'Triceps'],
    equipment: 'Dumbbell',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 7,
    description: 'Targets the upper chest with a greater range of motion than a barbell.',
    instructions:
      '1. Set the bench to 30-45 degrees.\n2. Start with the dumbbells at chest level.\n3. Press up and slightly together.\n4. Lower slowly until you feel a stretch across the chest.',
    image: 'exercise-incline-press.jpg',
  },
  {
    name: 'Push Ups',
    categorySlug: 'chest',
    targetMuscle: 'Pectoralis Major',
    secondaryMuscles: ['Triceps', 'Core'],
    equipment: 'Bodyweight',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 6,
    description: 'A bodyweight pressing movement that needs no equipment.',
    instructions:
      '1. Place hands slightly wider than shoulders.\n2. Keep a straight line from head to heels.\n3. Lower until your chest is just above the floor.\n4. Press back up while bracing your core.',
    image: 'exercise-push-ups.jpg',
  },
  {
    name: 'Cable Chest Fly',
    categorySlug: 'chest',
    targetMuscle: 'Pectoralis Major',
    secondaryMuscles: ['Front Deltoids'],
    equipment: 'Cable Machine',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 5,
    description: 'Isolation movement keeping constant tension across the chest.',
    instructions:
      '1. Set the pulleys to chest height.\n2. Step forward with a slight bend in the elbows.\n3. Bring the handles together in front of your chest.\n4. Return slowly to the stretched position.',
    image: 'exercise-cable-fly.jpg',
  },
  {
    name: 'Chest Dips',
    categorySlug: 'chest',
    targetMuscle: 'Lower Pectorals',
    secondaryMuscles: ['Triceps', 'Front Deltoids'],
    equipment: 'Parallel Bars',
    difficultyLevel: 'ADVANCED',
    caloriesPerMin: 8,
    description: 'Bodyweight dip with a forward lean to bias the lower chest.',
    instructions:
      '1. Support yourself on parallel bars.\n2. Lean your torso forward about 30 degrees.\n3. Lower until your shoulders are just below your elbows.\n4. Press back up without locking the elbows hard.',
    image: 'exercise-dips.jpg',
  },

  // ----------------------------------------------------------------- BACK
  {
    name: 'Deadlift',
    categorySlug: 'back',
    targetMuscle: 'Erector Spinae',
    secondaryMuscles: ['Glutes', 'Hamstrings', 'Lats', 'Traps'],
    equipment: 'Barbell',
    difficultyLevel: 'ADVANCED',
    caloriesPerMin: 10,
    description: 'The strongest full-posterior-chain movement in the gym.',
    instructions:
      '1. Stand with mid-foot under the bar.\n2. Hinge at the hips and grip just outside your knees.\n3. Brace hard, chest up, flat back.\n4. Drive through the floor and stand tall.\n5. Lower under control along the same path.',
    image: 'exercise-deadlift.jpg',
  },
  {
    name: 'Pull Ups',
    categorySlug: 'back',
    targetMuscle: 'Latissimus Dorsi',
    secondaryMuscles: ['Biceps', 'Rear Deltoids'],
    equipment: 'Pull-up Bar',
    difficultyLevel: 'INTERMEDIATE',
    caloriesPerMin: 9,
    description: 'The benchmark vertical pulling movement for back width.',
    instructions:
      '1. Grip the bar slightly wider than shoulders, palms forward.\n2. Start from a full hang.\n3. Pull your chest toward the bar, driving elbows down.\n4. Lower under control to a full hang.',
    image: 'exercise-pull-ups.jpg',
  },
  {
    name: 'Bent Over Barbell Row',
    categorySlug: 'back',
    targetMuscle: 'Latissimus Dorsi',
    secondaryMuscles: ['Rhomboids', 'Biceps', 'Rear Deltoids'],
    equipment: 'Barbell',
    difficultyLevel: 'INTERMEDIATE',
    caloriesPerMin: 8,
    description: 'Horizontal pull that builds back thickness.',
    instructions:
      '1. Hinge forward to roughly 45 degrees with a flat back.\n2. Let the bar hang at arms length.\n3. Row to your lower ribs, squeezing the shoulder blades.\n4. Lower with control.',
    image: 'exercise-barbell-row.jpg',
  },
  {
    name: 'Lat Pulldown',
    categorySlug: 'back',
    targetMuscle: 'Latissimus Dorsi',
    secondaryMuscles: ['Biceps', 'Rhomboids'],
    equipment: 'Cable Machine',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 6,
    description: 'A scalable vertical pull, ideal before pull-ups are possible.',
    instructions:
      '1. Set the thigh pad snugly.\n2. Grip wider than shoulders.\n3. Pull the bar to your upper chest.\n4. Control the bar back to a full stretch.',
    image: 'exercise-lat-pulldown.jpg',
  },
  {
    name: 'Seated Cable Row',
    categorySlug: 'back',
    targetMuscle: 'Middle Back',
    secondaryMuscles: ['Lats', 'Biceps'],
    equipment: 'Cable Machine',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 6,
    description: 'Constant-tension horizontal pull for the mid-back.',
    instructions:
      '1. Sit tall with a slight knee bend.\n2. Pull the handle to your abdomen.\n3. Squeeze the shoulder blades together.\n4. Extend the arms fully without rounding the back.',
    image: 'exercise-seated-row.jpg',
  },

  // ------------------------------------------------------------ SHOULDERS
  {
    name: 'Overhead Barbell Press',
    categorySlug: 'shoulders',
    targetMuscle: 'Anterior Deltoids',
    secondaryMuscles: ['Triceps', 'Upper Chest', 'Core'],
    equipment: 'Barbell',
    difficultyLevel: 'INTERMEDIATE',
    caloriesPerMin: 8,
    description: 'The primary vertical pressing movement for shoulder strength.',
    instructions:
      '1. Start with the bar at collarbone height.\n2. Brace your core and squeeze your glutes.\n3. Press overhead, moving your head back slightly.\n4. Lock out with the bar over mid-foot.',
    image: 'exercise-overhead-press.jpg',
  },
  {
    name: 'Dumbbell Lateral Raise',
    categorySlug: 'shoulders',
    targetMuscle: 'Lateral Deltoids',
    secondaryMuscles: ['Traps'],
    equipment: 'Dumbbell',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 5,
    description: 'Isolation movement that builds shoulder width.',
    instructions:
      '1. Hold dumbbells at your sides with a slight elbow bend.\n2. Raise out to the sides until level with your shoulders.\n3. Lead with the elbows, not the hands.\n4. Lower slowly.',
    image: 'exercise-lateral-raise.jpg',
  },
  {
    name: 'Face Pull',
    categorySlug: 'shoulders',
    targetMuscle: 'Rear Deltoids',
    secondaryMuscles: ['Rotator Cuff', 'Traps'],
    equipment: 'Cable Machine',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 5,
    description: 'Shoulder-health movement for the rear delts and upper back.',
    instructions:
      '1. Set the rope at face height.\n2. Pull toward your forehead, splitting the rope.\n3. Externally rotate so your knuckles face behind you.\n4. Return with control.',
    image: 'exercise-face-pull.jpg',
  },
  {
    name: 'Arnold Press',
    categorySlug: 'shoulders',
    targetMuscle: 'Deltoids',
    secondaryMuscles: ['Triceps'],
    equipment: 'Dumbbell',
    difficultyLevel: 'INTERMEDIATE',
    caloriesPerMin: 7,
    description: 'Rotating press that works all three deltoid heads.',
    instructions:
      '1. Start with palms facing you at chin height.\n2. Rotate the palms outward as you press up.\n3. Lock out overhead.\n4. Reverse the rotation on the way down.',
    image: 'exercise-arnold-press.jpg',
  },

  // --------------------------------------------------------------- BICEPS
  {
    name: 'Barbell Bicep Curl',
    categorySlug: 'biceps',
    targetMuscle: 'Biceps Brachii',
    secondaryMuscles: ['Forearms'],
    equipment: 'Barbell',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 5,
    description: 'The classic mass-builder for the biceps.',
    instructions:
      '1. Stand with the bar at arms length, palms forward.\n2. Curl without swinging the torso.\n3. Squeeze at the top.\n4. Lower slowly to a full stretch.',
    image: 'exercise-barbell-curl.jpg',
  },
  {
    name: 'Dumbbell Hammer Curl',
    categorySlug: 'biceps',
    targetMuscle: 'Brachialis',
    secondaryMuscles: ['Biceps', 'Forearms'],
    equipment: 'Dumbbell',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 5,
    description: 'Neutral-grip curl that builds arm thickness.',
    instructions:
      '1. Hold dumbbells with palms facing each other.\n2. Curl keeping the neutral grip throughout.\n3. Keep the elbows pinned to your sides.\n4. Lower under control.',
    image: 'exercise-hammer-curl.jpg',
  },
  {
    name: 'Incline Dumbbell Curl',
    categorySlug: 'biceps',
    targetMuscle: 'Biceps Long Head',
    secondaryMuscles: ['Forearms'],
    equipment: 'Dumbbell',
    difficultyLevel: 'INTERMEDIATE',
    caloriesPerMin: 5,
    description: 'Stretch-position curl that emphasises the long head.',
    instructions:
      '1. Sit back on a 45-degree incline bench.\n2. Let the arms hang straight down.\n3. Curl without letting the elbows drift forward.\n4. Lower all the way to the stretch.',
    image: 'exercise-incline-curl.jpg',
  },

  // -------------------------------------------------------------- TRICEPS
  {
    name: 'Cable Tricep Pushdown',
    categorySlug: 'triceps',
    targetMuscle: 'Triceps Brachii',
    secondaryMuscles: [],
    equipment: 'Cable Machine',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 5,
    description: 'Constant-tension isolation for the triceps.',
    instructions:
      '1. Set the rope or bar at upper-chest height.\n2. Pin your elbows to your sides.\n3. Extend fully and squeeze.\n4. Return slowly to about 90 degrees.',
    image: 'exercise-tricep-pushdown.jpg',
  },
  {
    name: 'Close Grip Bench Press',
    categorySlug: 'triceps',
    targetMuscle: 'Triceps Brachii',
    secondaryMuscles: ['Chest', 'Front Deltoids'],
    equipment: 'Barbell',
    difficultyLevel: 'INTERMEDIATE',
    caloriesPerMin: 7,
    description: 'Heavy compound press biased toward the triceps.',
    instructions:
      '1. Grip the bar about shoulder width.\n2. Tuck the elbows close to the body.\n3. Lower to the lower chest.\n4. Press back to lockout.',
    image: 'exercise-close-grip-bench.jpg',
  },
  {
    name: 'Overhead Tricep Extension',
    categorySlug: 'triceps',
    targetMuscle: 'Triceps Long Head',
    secondaryMuscles: [],
    equipment: 'Dumbbell',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 5,
    description: 'Stretch-position movement for the triceps long head.',
    instructions:
      '1. Hold one dumbbell overhead with both hands.\n2. Lower behind your head, elbows pointing forward.\n3. Extend back overhead.\n4. Keep the upper arms still.',
    image: 'exercise-overhead-extension.jpg',
  },

  // ----------------------------------------------------------------- LEGS
  {
    name: 'Barbell Back Squat',
    categorySlug: 'legs',
    targetMuscle: 'Quadriceps',
    secondaryMuscles: ['Glutes', 'Hamstrings', 'Core'],
    equipment: 'Barbell',
    difficultyLevel: 'INTERMEDIATE',
    caloriesPerMin: 10,
    description: 'The foundational lower-body strength movement.',
    instructions:
      '1. Set the bar across your upper back.\n2. Feet shoulder width, toes slightly out.\n3. Sit down and back, knees tracking over the toes.\n4. Descend to at least parallel.\n5. Drive up through mid-foot.',
    image: 'exercise-squat.jpg',
  },
  {
    name: 'Romanian Deadlift',
    categorySlug: 'legs',
    targetMuscle: 'Hamstrings',
    secondaryMuscles: ['Glutes', 'Lower Back'],
    equipment: 'Barbell',
    difficultyLevel: 'INTERMEDIATE',
    caloriesPerMin: 8,
    description: 'Hip hinge that loads the hamstrings in the stretched position.',
    instructions:
      '1. Start standing with the bar at your thighs.\n2. Push the hips back, keeping the knees softly bent.\n3. Lower until you feel a strong hamstring stretch.\n4. Drive the hips forward to stand.',
    image: 'exercise-rdl.jpg',
  },
  {
    name: 'Leg Press',
    categorySlug: 'legs',
    targetMuscle: 'Quadriceps',
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    equipment: 'Machine',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 7,
    description: 'Machine press that loads the legs with minimal spinal load.',
    instructions:
      '1. Place feet shoulder width on the platform.\n2. Lower until the knees reach about 90 degrees.\n3. Press through the heels.\n4. Do not lock the knees out hard.',
    image: 'exercise-leg-press.jpg',
  },
  {
    name: 'Walking Lunges',
    categorySlug: 'legs',
    targetMuscle: 'Quadriceps',
    secondaryMuscles: ['Glutes', 'Hamstrings', 'Core'],
    equipment: 'Dumbbell',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 8,
    description: 'Single-leg movement for strength and balance.',
    instructions:
      '1. Hold dumbbells at your sides.\n2. Step forward and lower the back knee toward the floor.\n3. Drive through the front heel to stand.\n4. Step through into the next lunge.',
    image: 'exercise-lunges.jpg',
  },
  {
    name: 'Standing Calf Raise',
    categorySlug: 'legs',
    targetMuscle: 'Gastrocnemius',
    secondaryMuscles: ['Soleus'],
    equipment: 'Machine',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 4,
    description: 'Isolation work for the calves.',
    instructions:
      '1. Place the balls of your feet on the platform.\n2. Drop the heels for a full stretch.\n3. Rise onto the toes and hold briefly.\n4. Lower slowly.',
    image: 'exercise-calf-raise.jpg',
  },
  {
    name: 'Leg Curl',
    categorySlug: 'legs',
    targetMuscle: 'Hamstrings',
    secondaryMuscles: ['Calves'],
    equipment: 'Machine',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 5,
    description: 'Isolation movement for the hamstrings.',
    instructions:
      '1. Position the pad just above the heels.\n2. Curl the weight toward your glutes.\n3. Squeeze at the top.\n4. Lower under control.',
    image: 'exercise-leg-curl.jpg',
  },

  // ------------------------------------------------------------------ ABS
  {
    name: 'Plank',
    categorySlug: 'abs',
    targetMuscle: 'Transverse Abdominis',
    secondaryMuscles: ['Obliques', 'Lower Back'],
    equipment: 'Bodyweight',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 4,
    description: 'Isometric hold that builds core stability.',
    instructions:
      '1. Rest on forearms and toes.\n2. Keep a straight line from head to heels.\n3. Brace the abs and squeeze the glutes.\n4. Hold for the target time without letting the hips sag.',
    image: 'exercise-plank.jpg',
  },
  {
    name: 'Hanging Leg Raise',
    categorySlug: 'abs',
    targetMuscle: 'Lower Abdominals',
    secondaryMuscles: ['Hip Flexors', 'Forearms'],
    equipment: 'Pull-up Bar',
    difficultyLevel: 'ADVANCED',
    caloriesPerMin: 6,
    description: 'Advanced core movement for the lower abs.',
    instructions:
      '1. Hang from the bar with straight arms.\n2. Raise the legs to hip height or above.\n3. Avoid swinging.\n4. Lower slowly.',
    image: 'exercise-leg-raise.jpg',
  },
  {
    name: 'Cable Crunch',
    categorySlug: 'abs',
    targetMuscle: 'Rectus Abdominis',
    secondaryMuscles: ['Obliques'],
    equipment: 'Cable Machine',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 5,
    description: 'Loaded crunch that lets you progress the abs over time.',
    instructions:
      '1. Kneel facing the cable with the rope behind your head.\n2. Crunch down by flexing the spine, not the hips.\n3. Squeeze hard at the bottom.\n4. Return under control.',
    image: 'exercise-cable-crunch.jpg',
  },
  {
    name: 'Russian Twist',
    categorySlug: 'abs',
    targetMuscle: 'Obliques',
    secondaryMuscles: ['Rectus Abdominis'],
    equipment: 'Medicine Ball',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 6,
    description: 'Rotational core movement for the obliques.',
    instructions:
      '1. Sit with knees bent and heels lightly on the floor.\n2. Lean back to about 45 degrees.\n3. Rotate the weight from side to side.\n4. Keep the chest open and the movement controlled.',
    image: 'exercise-russian-twist.jpg',
  },

  // --------------------------------------------------------------- CARDIO
  {
    name: 'Treadmill Running',
    categorySlug: 'cardio',
    targetMuscle: 'Cardiovascular System',
    secondaryMuscles: ['Legs', 'Core'],
    equipment: 'Treadmill',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 11,
    description: 'Steady-state or interval running for conditioning.',
    instructions:
      '1. Warm up for five minutes at an easy pace.\n2. Build to your working pace.\n3. Keep an upright posture and relaxed shoulders.\n4. Cool down for five minutes.',
    image: 'exercise-treadmill.jpg',
  },
  {
    name: 'Jump Rope',
    categorySlug: 'cardio',
    targetMuscle: 'Cardiovascular System',
    secondaryMuscles: ['Calves', 'Shoulders'],
    equipment: 'Jump Rope',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 12,
    description: 'High-intensity conditioning that needs almost no space.',
    instructions:
      '1. Hold the handles at hip height.\n2. Turn the rope from the wrists.\n3. Jump just high enough to clear it.\n4. Land softly on the balls of the feet.',
    image: 'exercise-jump-rope.jpg',
  },
  {
    name: 'Rowing Machine',
    categorySlug: 'cardio',
    targetMuscle: 'Cardiovascular System',
    secondaryMuscles: ['Back', 'Legs', 'Arms'],
    equipment: 'Rowing Machine',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 10,
    description: 'Full-body conditioning with low joint impact.',
    instructions:
      '1. Drive with the legs first.\n2. Then lean back slightly.\n3. Finally pull the handle to the lower ribs.\n4. Reverse the order on the recovery.',
    image: 'exercise-rowing.jpg',
  },
  {
    name: 'Cycling',
    categorySlug: 'cardio',
    targetMuscle: 'Cardiovascular System',
    secondaryMuscles: ['Quadriceps', 'Glutes'],
    equipment: 'Stationary Bike',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 9,
    description: 'Low-impact conditioning that is easy to scale.',
    instructions:
      '1. Set the saddle so the knee is slightly bent at the bottom.\n2. Warm up at low resistance.\n3. Hold your target cadence.\n4. Cool down before stopping.',
    image: 'exercise-cycling.jpg',
  },

  // ------------------------------------------------------------ FULL BODY
  {
    name: 'Burpees',
    categorySlug: 'full-body',
    targetMuscle: 'Full Body',
    secondaryMuscles: ['Chest', 'Legs', 'Core'],
    equipment: 'Bodyweight',
    difficultyLevel: 'INTERMEDIATE',
    caloriesPerMin: 13,
    description: 'High-intensity full-body conditioning movement.',
    instructions:
      '1. Drop into a squat and place your hands down.\n2. Jump the feet back to a plank.\n3. Perform a push-up.\n4. Jump the feet forward and leap upward.',
    image: 'exercise-burpees.jpg',
  },
  {
    name: 'Kettlebell Swing',
    categorySlug: 'full-body',
    targetMuscle: 'Glutes',
    secondaryMuscles: ['Hamstrings', 'Core', 'Shoulders'],
    equipment: 'Kettlebell',
    difficultyLevel: 'INTERMEDIATE',
    caloriesPerMin: 11,
    description: 'Explosive hip hinge for power and conditioning.',
    instructions:
      '1. Hinge at the hips and hike the bell back.\n2. Snap the hips forward to drive it up.\n3. Let the bell float to chest height.\n4. Guide it back down into the next hinge.',
    image: 'exercise-kettlebell-swing.jpg',
  },
  {
    name: 'Mountain Climbers',
    categorySlug: 'full-body',
    targetMuscle: 'Core',
    secondaryMuscles: ['Shoulders', 'Legs'],
    equipment: 'Bodyweight',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 10,
    description: 'Dynamic plank variation that raises the heart rate fast.',
    instructions:
      '1. Start in a high plank.\n2. Drive one knee toward the chest.\n3. Switch legs quickly.\n4. Keep the hips low and the core braced.',
    image: 'exercise-mountain-climbers.jpg',
  },

  // ------------------------------------------------------------- MOBILITY
  {
    name: 'Cat-Cow Stretch',
    categorySlug: 'mobility',
    targetMuscle: 'Spine',
    secondaryMuscles: ['Core'],
    equipment: 'Bodyweight',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 2,
    description: 'Spinal mobility drill, ideal as a warm-up.',
    instructions:
      '1. Start on hands and knees.\n2. Arch the back and look up (cow).\n3. Round the back and tuck the chin (cat).\n4. Move slowly with your breath.',
    image: 'exercise-cat-cow.jpg',
  },
  {
    name: 'Hip Flexor Stretch',
    categorySlug: 'mobility',
    targetMuscle: 'Hip Flexors',
    secondaryMuscles: ['Quadriceps'],
    equipment: 'Bodyweight',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 2,
    description: 'Opens the hips after sitting or heavy leg training.',
    instructions:
      '1. Kneel in a half-kneeling position.\n2. Tuck the pelvis under.\n3. Shift gently forward until you feel the stretch.\n4. Hold for 30 seconds per side.',
    image: 'exercise-hip-stretch.jpg',
  },
  {
    name: 'Shoulder Dislocates',
    categorySlug: 'mobility',
    targetMuscle: 'Shoulders',
    secondaryMuscles: ['Chest', 'Upper Back'],
    equipment: 'Resistance Band',
    difficultyLevel: 'BEGINNER',
    caloriesPerMin: 2,
    description: 'Shoulder mobility drill for overhead pressing.',
    instructions:
      '1. Hold a band wide in front of you.\n2. Keep the arms straight.\n3. Raise it overhead and behind your back.\n4. Return along the same path.',
    image: 'exercise-shoulder-mobility.jpg',
  },
];

export interface SeedGoalType {
  name: string;
  slug: string;
  description: string;
  iconName: string;
  colorHex: string;
  displayOrder: number;
}

/**
 * Built-in goal types. These are ordinary rows with `userId: null`, so they
 * can be renamed, recoloured or archived from the app like any custom type.
 */
export const GOAL_TYPES: SeedGoalType[] = [
  { name: 'Muscle Gain',        slug: 'muscle-gain',        description: 'Add lean muscle through progressive overload and a calorie surplus.', iconName: 'barbell',       colorHex: '#34D399', displayOrder: 1 },
  { name: 'Weight Gain',        slug: 'weight-gain',        description: 'Increase overall body weight steadily.',                              iconName: 'trending-up',   colorHex: '#60A5FA', displayOrder: 2 },
  { name: 'Weight Loss',        slug: 'weight-loss',        description: 'Reduce overall body weight in a calorie deficit.',                    iconName: 'trending-down', colorHex: '#F87171', displayOrder: 3 },
  { name: 'Fat Loss',           slug: 'fat-loss',           description: 'Lower body-fat percentage while holding on to muscle.',               iconName: 'flame',         colorHex: '#FB923C', displayOrder: 4 },
  { name: 'Strength Training',  slug: 'strength-training',  description: 'Push maximal strength on the main lifts.',                            iconName: 'fitness',       colorHex: '#A78BFA', displayOrder: 5 },
  { name: 'Lean Muscle',        slug: 'lean-muscle',        description: 'Build muscle while keeping body fat low.',                            iconName: 'body',          colorHex: '#2DD4BF', displayOrder: 6 },
  { name: 'Weight Maintenance', slug: 'weight-maintenance', description: 'Hold your current weight and composition.',                           iconName: 'remove',        colorHex: '#94A3B8', displayOrder: 7 },
  { name: 'General Fitness',    slug: 'general-fitness',    description: 'Stay healthy, active and consistent.',                                iconName: 'heart',         colorHex: '#F472B6', displayOrder: 8 },
];
