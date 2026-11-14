/** Fitness calculations shared by the analytics, session and progress modules. */

export function toNumber(value: any, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return value;
  const n = Number(value.toString());
  return Number.isNaN(n) ? fallback : n;
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** BMI = kg / m^2. Returns null when height or weight is unknown. */
export function calculateBmi(weightKg?: number | null, heightCm?: number | null): number | null {
  const w = toNumber(weightKg, 0);
  const h = toNumber(heightCm, 0);
  if (w <= 0 || h <= 0) return null;
  const metres = h / 100;
  return round(w / (metres * metres), 2);
}

export function bmiCategory(bmi: number | null): string | null {
  if (bmi === null) return null;
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

/** Volume of one set = reps x weight. Only completed sets should be passed in. */
export function setVolume(reps: number, weightKg: number): number {
  return round(toNumber(reps) * toNumber(weightKg), 2);
}

export function totalVolume(
  sets: Array<{ reps: number | any; weightKg: number | any; completed: boolean }>,
): number {
  return round(
    sets
      .filter((s) => s.completed)
      .reduce((sum, s) => sum + toNumber(s.reps) * toNumber(s.weightKg), 0),
    2,
  );
}

/**
 * Epley one-rep-max estimate. This is an ESTIMATE and should be labelled as
 * such wherever it is displayed. Only meaningful for roughly 1-10 reps.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  const w = toNumber(weightKg);
  const r = toNumber(reps);
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return round(w, 2);
  return round(w * (1 + r / 30), 2);
}

/**
 * Completion percentage of a session.
 * Skipped exercises count against the total; pending ones do too, because an
 * unfinished exercise is not a completed one.
 */
export function completionPercentage(completed: number, total: number): number {
  if (total <= 0) return 0;
  return round((completed / total) * 100, 1);
}

/** Rough calorie estimate from active minutes and body weight (MET-based). */
export function estimateCaloriesBurned(
  durationSeconds: number,
  bodyWeightKg: number,
  met = 5,
): number {
  const minutes = toNumber(durationSeconds) / 60;
  const weight = toNumber(bodyWeightKg, 70) || 70;
  if (minutes <= 0) return 0;
  return Math.round(((met * 3.5 * weight) / 200) * minutes);
}

/** Age in whole years from a date of birth. */
export function calculateAge(dateOfBirth?: Date | string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

/** Mifflin-St Jeor basal metabolic rate. */
export function calculateBmr(
  weightKg?: number | null,
  heightCm?: number | null,
  age?: number | null,
  gender?: string | null,
): number | null {
  const w = toNumber(weightKg, 0);
  const h = toNumber(heightCm, 0);
  if (w <= 0 || h <= 0 || !age) return null;
  const base = 10 * w + 6.25 * h - 5 * age;
  const adjusted = gender === 'FEMALE' ? base - 161 : base + 5;
  return Math.round(adjusted);
}

/** Percentage of a goal achieved, based on start -> target -> current weight. */
export function goalProgressPercentage(
  startingWeight?: number | null,
  targetWeight?: number | null,
  currentWeight?: number | null,
): number {
  const start = toNumber(startingWeight, NaN);
  const target = toNumber(targetWeight, NaN);
  const current = toNumber(currentWeight, NaN);
  if ([start, target, current].some(Number.isNaN)) return 0;
  const totalChange = target - start;
  if (totalChange === 0) return current === target ? 100 : 0;
  const achieved = current - start;
  const pct = (achieved / totalChange) * 100;
  return round(Math.min(100, Math.max(0, pct)), 1);
}

/** Longest run of consecutive calendar days present in the supplied set. */
export function currentStreak(dates: Date[]): number {
  if (!dates.length) return 0;
  const days = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  // Allow the streak to still be alive if today has not been logged yet.
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
