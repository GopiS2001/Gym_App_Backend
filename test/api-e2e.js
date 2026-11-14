/**
 * End-to-end CRUD / filter / search check against the running API.
 * Exercises every module the mobile app uses.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';
// Credentials come from the environment (.env) — never hard-code them here.
const EMAIL = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (or E2E_EMAIL / E2E_PASSWORD) in .env');
  process.exit(1);
}

let token = '';
let pass = 0;
const failures = [];

async function call(method, path, body, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && !opts.noAuth ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = { raw: 'non-json' };
  }
  return { status: res.status, json };
}

function check(name, cond, detail) {
  if (cond) {
    pass += 1;
  } else {
    failures.push(`${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function section(title) {
  console.log(`\n== ${title}`);
}

(async () => {
  // ------------------------------------------------------------- AUTH
  await section('Auth');
  let r = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD }, { noAuth: true });
  check('login', r.status === 200 && !!r.json?.data?.accessToken, `status ${r.status} ${JSON.stringify(r.json?.message)}`);
  token = r.json?.data?.accessToken || '';
  const refreshToken = r.json?.data?.refreshToken;

  r = await call('POST', '/auth/login', { email: EMAIL, password: 'wrong' }, { noAuth: true });
  check('login rejects bad password', r.status === 401, `status ${r.status}`);

  r = await call('POST', '/auth/login', { email: 'notanemail', password: 'x' }, { noAuth: true });
  check('login validates email', r.status === 400, `status ${r.status}`);

  r = await call('GET', '/auth/me');
  check('auth/me', r.status === 200 && r.json?.data?.email === EMAIL, `status ${r.status}`);

  r = await call('GET', '/auth/me', null, { noAuth: true });
  check('auth/me requires token', r.status === 401, `status ${r.status}`);

  r = await call('POST', '/auth/refresh', { refreshToken }, { noAuth: true });
  check('refresh token', r.status === 200 && !!r.json?.data?.accessToken, `status ${r.status}`);

  r = await call('POST', '/auth/setup', { email: 'x@y.com', password: 'abcdef', fullName: 'X' }, { noAuth: true });
  check('setup blocked once account exists', r.status === 409, `status ${r.status}`);

  // ---------------------------------------------------------- PROFILE
  await section('Profile');
  r = await call('GET', '/users/profile');
  check('get profile', r.status === 200 && !!r.json?.data?.fullName, `status ${r.status}`);
  check('profile computes bmi', typeof r.json?.data?.bmi === 'number', `bmi=${r.json?.data?.bmi}`);
  check('profile computes age', typeof r.json?.data?.age === 'number', `age=${r.json?.data?.age}`);

  r = await call('PUT', '/users/profile', { fullName: 'Gopi', heightCm: 175, experienceLevel: 'INTERMEDIATE' });
  check('update profile', r.status === 200 && r.json?.data?.fullName === 'Gopi', `status ${r.status}`);

  r = await call('PUT', '/users/profile', { heightCm: 999 });
  check('profile validates height', r.status === 400, `status ${r.status}`);

  // ------------------------------------------------------------ GOALS
  await section('Goals');
  r = await call('GET', '/goals?page=1&limit=10');
  check('list goals paginated', r.status === 200 && Array.isArray(r.json?.data?.items), `status ${r.status}`);
  check('goals have meta', !!r.json?.data?.meta?.totalPages, 'no meta');

  r = await call('GET', '/goals/active');
  check('active goal', r.status === 200, `status ${r.status}`);
  check('active goal has progress', typeof r.json?.data?.progressPercentage === 'number', 'no progress');

  r = await call('GET', '/goals/types');
  check('goal types', r.status === 200 && r.json?.data?.items?.length >= 8, `count ${r.json?.data?.items?.length}`);
  const fatLossType = r.json?.data?.items?.find((t) => t.slug === 'fat-loss');
  check('goal type has id and name', !!fatLossType?.id && !!fatLossType?.name, 'missing fields');

  r = await call('POST', '/goals', { goalTypeId: fatLossType.id, title: 'TEST Cut', startingWeightKg: 75, targetWeightKg: 70, startDate: '2026-11-12', targetDate: '2027-01-12', status: 'PAUSED' });
  check('create goal', r.status === 201 && !!r.json?.data?.id, `status ${r.status} ${r.json?.message}`);
  const goalId = r.json?.data?.id;

  r = await call('GET', `/goals/${goalId}`);
  check('get goal by id', r.status === 200 && r.json?.data?.id === goalId, `status ${r.status}`);

  r = await call('GET', '/goals?search=TEST');
  check('goal search', r.status === 200 && r.json?.data?.items?.some((g) => g.title === 'TEST Cut'), 'not found by search');

  r = await call('GET', '/goals?status=PAUSED');
  check('goal status filter', r.status === 200 && r.json?.data?.items?.every((g) => g.status === 'PAUSED'), 'filter leaked');

  r = await call('PATCH', `/goals/${goalId}`, { notes: 'updated note', targetWeightKg: 69 });
  check('update goal', r.status === 200 && r.json?.data?.notes === 'updated note', `status ${r.status}`);

  r = await call('PATCH', `/goals/${goalId}/complete`);
  check('complete goal', r.status === 200 && r.json?.data?.status === 'COMPLETED', `status ${r.status}`);

  r = await call('POST', '/goals', { goalTypeId: 'not-a-uuid', startDate: '2026-11-12' });
  check('goal validates type', r.status === 400, `status ${r.status}`);

  r = await call('DELETE', `/goals/${goalId}`);
  check('delete goal', r.status === 200 && r.json?.data?.deleted, `status ${r.status}`);

  r = await call('GET', `/goals/${goalId}`);
  check('deleted goal is gone', r.status === 404, `status ${r.status}`);

  // ------------------------------------------------------- GOAL TYPES
  await section('Goal Types');
  r = await call('GET', '/goal-types');
  check('list goal types', r.status === 200 && r.json?.data?.items?.length >= 8, `count ${r.json?.data?.items?.length}`);
  check('goal type reports usage count', typeof r.json?.data?.items?.[0]?.goalCount === 'number', 'no goalCount');
  check('goal types in display order', (() => {
    const o = r.json?.data?.items?.map((t) => t.displayOrder) || [];
    return o.every((v, i) => i === 0 || v >= o[i - 1]);
  })(), 'not ordered');

  r = await call('POST', '/goal-types', { name: 'TEST Powerlifting', description: 'meet prep', iconName: 'barbell', colorHex: '#F59E0B' });
  check('create goal type', r.status === 201 && !!r.json?.data?.id, `status ${r.status} ${r.json?.message}`);
  const gtId = r.json?.data?.id;
  check('goal type slug generated', r.json?.data?.slug === 'test-powerlifting', `slug ${r.json?.data?.slug}`);
  check('goal type marked custom', r.json?.data?.isCustom === true, 'not custom');

  r = await call('GET', `/goal-types/${gtId}`);
  check('get goal type by id', r.status === 200 && r.json?.data?.id === gtId, `status ${r.status}`);

  r = await call('GET', '/goal-types?search=Powerlifting');
  check('goal type search', r.status === 200 && r.json?.data?.items?.length >= 1, 'search failed');

  r = await call('GET', '/goal-types?isCustom=true');
  check('goal type custom filter', r.status === 200 && r.json?.data?.items?.every((t) => t.isCustom), 'filter leaked');

  r = await call('PATCH', `/goal-types/${gtId}`, { name: 'TEST Meet Prep', colorHex: '#EF4444' });
  check('update goal type', r.status === 200 && r.json?.data?.name === 'TEST Meet Prep', `status ${r.status}`);
  check('slug follows rename', r.json?.data?.slug === 'test-meet-prep', `slug ${r.json?.data?.slug}`);

  r = await call('POST', '/goal-types', { name: 'X' });
  check('goal type validates name length', r.status === 400, `status ${r.status}`);

  // a goal using the type should force archive-instead-of-delete
  r = await call('POST', '/goals', { goalTypeId: gtId, title: 'TEST Typed Goal', startDate: '2026-11-12', status: 'PAUSED' });
  check('create goal with custom type', r.status === 201, `status ${r.status} ${r.json?.message}`);
  const typedGoalId = r.json?.data?.id;
  check('goal exposes type label', r.json?.data?.goalTypeLabel === 'TEST Meet Prep', `label ${r.json?.data?.goalTypeLabel}`);
  check('goal exposes type colour', r.json?.data?.goalTypeColor === '#EF4444', `colour ${r.json?.data?.goalTypeColor}`);

  r = await call('GET', `/goals?goalTypeId=${gtId}`);
  check('goal filter by type', r.status === 200 && r.json?.data?.items?.length >= 1, 'filter failed');

  r = await call('DELETE', `/goal-types/${gtId}`);
  check('in-use goal type archives', r.status === 200 && r.json?.data?.archived === true, `archived ${r.json?.data?.archived}`);

  r = await call('GET', '/goal-types?search=TEST Meet');
  check('archived type hidden by default', r.json?.data?.items?.length === 0, `found ${r.json?.data?.items?.length}`);

  r = await call('GET', '/goal-types?search=TEST Meet&includeInactive=true');
  check('archived type visible when asked', r.json?.data?.items?.length === 1, `found ${r.json?.data?.items?.length}`);

  r = await call('POST', '/goals', { goalTypeId: gtId, startDate: '2026-11-12' });
  check('cannot use archived type', r.status === 400, `status ${r.status}`);

  r = await call('PATCH', `/goal-types/${gtId}/restore`);
  check('restore goal type', r.status === 200 && r.json?.data?.isActive === true, `active ${r.json?.data?.isActive}`);

  await call('DELETE', `/goals/${typedGoalId}`);
  r = await call('DELETE', `/goal-types/${gtId}`);
  check('unused goal type deletes', r.status === 200 && r.json?.data?.archived === false, `archived ${r.json?.data?.archived}`);

  r = await call('GET', `/goal-types/${gtId}`);
  check('deleted goal type is gone', r.status === 404, `status ${r.status}`);

  // ------------------------------------------------------- CATEGORIES
  await section('Categories');

  // Remove anything a previously aborted run left behind, otherwise the slug
  // uniquifier appends a suffix and the assertion below fails for the wrong
  // reason.
  r = await call('GET', '/categories?search=TEST&limit=50');
  for (const stale of r.json?.data?.items || []) {
    if (stale.name.startsWith('TEST')) await call('DELETE', `/categories/${stale.id}`);
  }

  r = await call('GET', '/categories?limit=50');
  check('list categories', r.status === 200 && r.json?.data?.items?.length >= 10, `count ${r.json?.data?.items?.length}`);
  check('categories have exercise counts', r.json?.data?.items?.[0]?.exerciseCount >= 0, 'no counts');
  const chestCat = r.json?.data?.items?.find((c) => c.slug === 'chest');

  r = await call('GET', '/categories?search=Chest');
  check('category search', r.status === 200 && r.json?.data?.items?.length >= 1, 'search failed');

  const catName = 'TEST Cat ' + Date.now();
  r = await call('POST', '/categories', { name: catName, description: 'test', colorHex: '#123456' });
  check('create category', r.status === 201 && !!r.json?.data?.id, `status ${r.status} ${r.json?.message}`);
  const catId = r.json?.data?.id;
  check('category slug generated', r.json?.data?.slug === catName.toLowerCase().replace(/ /g, '-'), `slug ${r.json?.data?.slug}`);

  r = await call('PATCH', `/categories/${catId}`, { description: 'updated' });
  check('update category', r.status === 200 && r.json?.data?.description === 'updated', `status ${r.status}`);

  r = await call('DELETE', `/categories/${chestCat.id}`);
  check('cannot delete non-empty category', r.status === 400, `status ${r.status}`);

  // -------------------------------------------------------- EXERCISES
  await section('Exercises');
  r = await call('GET', '/exercises?limit=100');
  check('list exercises', r.status === 200 && r.json?.data?.items?.length >= 40, `count ${r.json?.data?.items?.length}`);
  check('exercise has category', !!r.json?.data?.items?.[0]?.category?.name, 'no category');
  check('exercise has image', !!r.json?.data?.items?.[0]?.imageUrl, 'no image');

  r = await call('GET', '/exercises?search=bench');
  check('exercise search', r.status === 200 && r.json?.data?.items?.length >= 1, `count ${r.json?.data?.items?.length}`);

  r = await call('GET', `/exercises?categorySlug=chest`);
  check('exercise category filter', r.status === 200 && r.json?.data?.items?.every((e) => e.category.slug === 'chest'), 'filter leaked');

  r = await call('GET', '/exercises?difficultyLevel=ADVANCED');
  check('exercise difficulty filter', r.status === 200 && r.json?.data?.items?.every((e) => e.difficultyLevel === 'ADVANCED'), 'filter leaked');

  r = await call('GET', '/exercises?equipment=Barbell');
  check('exercise equipment filter', r.status === 200 && r.json?.data?.items?.length >= 1, 'no results');

  r = await call('GET', '/exercises/filters');
  check('filter options', r.status === 200 && r.json?.data?.equipment?.length > 0, 'no equipment list');

  r = await call('POST', '/exercises', { name: 'TEST Cable Pullover', categoryId: catId, targetMuscle: 'Lats', equipment: 'Cable', difficultyLevel: 'INTERMEDIATE', secondaryMuscles: ['Triceps'], instructions: 'Test' });
  check('create exercise', r.status === 201 && !!r.json?.data?.id, `status ${r.status} ${r.json?.message}`);
  const exId = r.json?.data?.id;

  r = await call('GET', `/exercises/${exId}`);
  check('get exercise detail', r.status === 200 && r.json?.data?.id === exId, `status ${r.status}`);
  check('exercise detail has history array', Array.isArray(r.json?.data?.history), 'no history');

  r = await call('PATCH', `/exercises/${exId}`, { description: 'updated desc' });
  check('update exercise', r.status === 200 && r.json?.data?.description === 'updated desc', `status ${r.status}`);

  r = await call('POST', `/exercises/${exId}/favourite`);
  check('favourite on', r.status === 201 && r.json?.data?.isFavourite === true, `status ${r.status}`);

  r = await call('GET', '/exercises?favouritesOnly=true');
  check('favourites filter', r.status === 200 && r.json?.data?.items?.some((e) => e.id === exId), 'not in favourites');

  r = await call('POST', `/exercises/${exId}/favourite`);
  check('favourite off', r.status === 201 && r.json?.data?.isFavourite === false, `status ${r.status}`);

  r = await call('POST', '/exercises', { name: 'X', categoryId: 'not-a-uuid' });
  check('exercise validates category', r.status === 400, `status ${r.status}`);

  // ---------------------------------------------------- WORKOUT PLANS
  await section('Workout Plans');
  r = await call('GET', '/workout-plans?search=Push Pull Legs');
  check('list plans', r.status === 200 && r.json?.data?.items?.length >= 1, `count ${r.json?.data?.items?.length}`);
  const seededPlan = r.json?.data?.items?.find((p) => p.planName === 'Push Pull Legs');
  const planId = seededPlan?.id;
  check('plan has training days', Array.isArray(seededPlan?.trainingDays), 'no training days');

  r = await call('GET', `/workout-plans/${planId}`);
  check('plan detail', r.status === 200 && r.json?.data?.schedule?.length === 7, `schedule ${r.json?.data?.schedule?.length}`);
  check('plan schedule has exercises', r.json?.data?.schedule?.some((d) => d.exercises.length > 0), 'empty schedule');
  check('plan estimates minutes', r.json?.data?.schedule?.some((d) => d.estimatedMinutes > 0), 'no estimate');

  r = await call('GET', '/workout-plans/today');
  check('today plan endpoint', r.status === 200, `status ${r.status}`);

  r = await call('GET', '/workout-plans/week-days');
  check('week days', r.status === 200 && r.json?.data?.items?.length === 7, `count ${r.json?.data?.items?.length}`);

  r = await call('GET', '/workout-plans?search=Push');
  check('plan search', r.status === 200 && r.json?.data?.items?.length >= 1, 'search failed');

  r = await call('POST', '/workout-plans', {
    planName: 'TEST Upper Lower', description: 'test plan', status: 'DRAFT', difficultyLevel: 'BEGINNER',
    exercises: [{ exerciseId: exId, scheduledDay: 'MONDAY', targetSets: 3, targetReps: 10, restSeconds: 60 }],
  });
  check('create plan with exercises', r.status === 201 && r.json?.data?.exerciseCount === 1, `status ${r.status} ${r.json?.message}`);
  const newPlanId = r.json?.data?.id;

  r = await call('POST', `/workout-plans/${newPlanId}/exercises`, { exerciseId: exId, scheduledDay: 'WEDNESDAY', targetSets: 4, targetReps: 8 });
  check('add exercise to plan', r.status === 201 && r.json?.data?.exerciseCount === 2, `count ${r.json?.data?.exerciseCount}`);
  const planExIds = r.json?.data?.exercises?.map((e) => e.id);

  r = await call('PATCH', `/workout-plans/${newPlanId}/exercises/${planExIds[0]}`, { targetSets: 5 });
  check('update plan exercise', r.status === 200, `status ${r.status}`);

  r = await call('PATCH', `/workout-plans/${newPlanId}/exercises/reorder`, { orderedIds: planExIds });
  check('reorder plan exercises', r.status === 200, `status ${r.status} ${r.json?.message}`);

  r = await call('POST', `/workout-plans/${newPlanId}/duplicate`);
  check('duplicate plan', r.status === 201 && r.json?.data?.planName?.includes('Copy'), `name ${r.json?.data?.planName}`);
  const dupPlanId = r.json?.data?.id;

  r = await call('PUT', `/workout-plans/${newPlanId}`, { description: 'updated plan' });
  check('update plan', r.status === 200 && r.json?.data?.description === 'updated plan', `status ${r.status}`);

  r = await call('DELETE', `/workout-plans/${newPlanId}/exercises/${planExIds[1]}`);
  check('remove plan exercise', r.status === 200 && r.json?.data?.exerciseCount === 1, `count ${r.json?.data?.exerciseCount}`);

  r = await call('DELETE', `/workout-plans/${dupPlanId}`);
  check('delete plan', r.status === 200, `status ${r.status}`);

  // ------------------------------------------------- WORKOUT SESSIONS
  await section('Workout Sessions');
  r = await call('GET', '/workout-sessions?limit=5');
  check('session history', r.status === 200 && r.json?.data?.items?.length >= 1, `count ${r.json?.data?.items?.length}`);
  check('session has volume', typeof r.json?.data?.items?.[0]?.totalVolumeKg === 'number', 'no volume');
  check('session has completion %', typeof r.json?.data?.items?.[0]?.completionPercentage === 'number', 'no completion');
  const histSessionId = r.json?.data?.items?.[0]?.id;

  r = await call('GET', `/workout-sessions/${histSessionId}`);
  check('session detail', r.status === 200 && r.json?.data?.exercises?.length > 0, `status ${r.status}`);
  check('session exercise has sets', r.json?.data?.exercises?.[0]?.sets?.length > 0, 'no sets');
  check('session shows previous performance', 'previousPerformance' in (r.json?.data?.exercises?.[0] || {}), 'no previousPerformance');

  r = await call('GET', '/workout-sessions?fromDate=2020-01-01&toDate=2030-01-01');
  check('session date range filter', r.status === 200 && r.json?.data?.items?.length >= 1, 'no results');

  r = await call('GET', '/workout-sessions?status=COMPLETED');
  check('session status filter', r.status === 200 && r.json?.data?.items?.every((s) => s.status === 'COMPLETED'), 'filter leaked');

  r = await call('GET', '/workout-sessions?search=Chest');
  check('session search', r.status === 200, `status ${r.status}`);

  // Start a live session and run the full set lifecycle
  r = await call('POST', '/workout-sessions/start', { title: 'TEST Session', exerciseIds: [exId], clientOpId: 'test-op-001' });
  check('start session', r.status === 201 && r.json?.data?.status === 'IN_PROGRESS', `status ${r.status} ${r.json?.message}`);
  const sessionId = r.json?.data?.id;
  const sessionExId = r.json?.data?.exercises?.[0]?.id;

  r = await call('POST', '/workout-sessions/start', { title: 'DUP', exerciseIds: [exId], clientOpId: 'test-op-001' });
  check('idempotent start (offline retry)', r.status === 201 && r.json?.data?.id === sessionId, `got ${r.json?.data?.id}`);

  r = await call('POST', '/workout-sessions/start', { title: 'Second' });
  check('blocks concurrent session', r.status === 400, `status ${r.status}`);

  r = await call('GET', '/workout-sessions/active');
  check('active session restore', r.status === 200 && r.json?.data?.id === sessionId, `status ${r.status}`);

  r = await call('POST', `/workout-sessions/${sessionId}/sets`, { sessionExerciseId: sessionExId, reps: 12, weightKg: 40, completed: true });
  check('record set 1', r.status === 201 && r.json?.data?.totalVolumeKg === 480, `volume ${r.json?.data?.totalVolumeKg}`);

  r = await call('POST', `/workout-sessions/${sessionId}/sets`, { sessionExerciseId: sessionExId, reps: 10, weightKg: 45, completed: true });
  check('record set 2 (volume accumulates)', r.status === 201 && r.json?.data?.totalVolumeKg === 930, `volume ${r.json?.data?.totalVolumeKg}`);

  const setId = r.json?.data?.exercises?.[0]?.sets?.[0]?.id;
  r = await call('PATCH', `/workout-sessions/${sessionId}/sets/${setId}`, { reps: 15, weightKg: 40 });
  check('update set', r.status === 200 && r.json?.data?.totalVolumeKg === 1050, `volume ${r.json?.data?.totalVolumeKg}`);

  r = await call('POST', `/workout-sessions/${sessionId}/pause`);
  check('pause session', r.status === 200 && r.json?.data?.status === 'PAUSED', `status ${r.json?.data?.status}`);

  r = await call('POST', `/workout-sessions/${sessionId}/resume`);
  check('resume session', r.status === 200 && r.json?.data?.status === 'IN_PROGRESS', `status ${r.json?.data?.status}`);

  r = await call('POST', `/workout-sessions/${sessionId}/exercises`, { exerciseId: exId, targetSets: 3, targetReps: 10 });
  check('add exercise mid-session', r.status === 201 && r.json?.data?.exercises?.length === 2, `count ${r.json?.data?.exercises?.length}`);
  const secondSessionExId = r.json?.data?.exercises?.[1]?.id;

  r = await call('PATCH', `/workout-sessions/${sessionId}/exercises/${secondSessionExId}/skip`);
  check('skip exercise', r.status === 200, `status ${r.status}`);

  r = await call('DELETE', `/workout-sessions/${sessionId}/exercises/${secondSessionExId}`);
  check('remove exercise mid-session', r.status === 200 && r.json?.data?.exercises?.length === 1, `count ${r.json?.data?.exercises?.length}`);

  r = await call('DELETE', `/workout-sessions/${sessionId}/sets/${setId}`);
  check('delete set', r.status === 200 && r.json?.data?.totalVolumeKg === 450, `volume ${r.json?.data?.totalVolumeKg}`);

  r = await call('POST', `/workout-sessions/${sessionId}/complete`, { durationSeconds: 1800 });
  check('complete session', r.status === 200 && r.json?.data?.status === 'COMPLETED', `status ${r.json?.data?.status}`);
  check('completion computes calories', r.json?.data?.caloriesBurned > 0, `cal ${r.json?.data?.caloriesBurned}`);
  check('completion sets duration', r.json?.data?.durationMinutes === 30, `min ${r.json?.data?.durationMinutes}`);

  r = await call('POST', `/workout-sessions/${sessionId}/sets`, { sessionExerciseId: sessionExId, reps: 1, weightKg: 1 });
  check('can still edit completed session', r.status === 201, `status ${r.status}`);

  r = await call('DELETE', `/workout-sessions/${sessionId}`);
  check('delete session', r.status === 200, `status ${r.status}`);

  // --------------------------------------------------------- PROGRESS
  await section('Progress');
  r = await call('POST', '/progress/weight', { weightKg: 72.8, recordedDate: '2026-11-12', notes: 'TEST weigh-in' });
  check('add weight', r.status === 201 && !!r.json?.data?.id, `status ${r.status} ${r.json?.message}`);
  const weightId = r.json?.data?.id;

  r = await call('POST', '/progress/weight', { weightKg: 72.9, recordedDate: '2026-11-12' });
  check('same-day weight upserts', r.status === 201 && r.json?.data?.id === weightId, 'created duplicate');

  r = await call('GET', '/progress/weight?limit=10');
  check('weight history', r.status === 200 && r.json?.data?.items?.length >= 1, `count ${r.json?.data?.items?.length}`);
  check('weight history has summary', typeof r.json?.data?.summary?.currentWeightKg === 'number', 'no summary');

  r = await call('GET', '/progress/weight/summary');
  check('weight summary', r.status === 200 && 'totalChangeKg' in r.json?.data, 'no totalChangeKg');

  r = await call('GET', '/progress/weight/chart?days=90');
  check('weight chart', r.status === 200 && r.json?.data?.points?.length > 0, `points ${r.json?.data?.points?.length}`);

  r = await call('PATCH', `/progress/weight/${weightId}`, { notes: 'updated' });
  check('update weight', r.status === 200 && r.json?.data?.notes === 'updated', `status ${r.status}`);

  r = await call('POST', '/progress/weight', { weightKg: 5 });
  check('weight validates range', r.status === 400, `status ${r.status}`);

  r = await call('DELETE', `/progress/weight/${weightId}`);
  check('delete weight', r.status === 200, `status ${r.status}`);

  r = await call('POST', '/progress/measurements', { recordedDate: '2026-11-12', chestCm: 100, waistCm: 80, leftArmCm: 35, rightArmCm: 35.2, bodyFatPercentage: 15 });
  check('add measurements', r.status === 201 && !!r.json?.data?.id, `status ${r.status}`);
  const measId = r.json?.data?.id;

  r = await call('GET', '/progress/measurements');
  check('measurement history', r.status === 200 && r.json?.data?.items?.length >= 1, 'no items');
  check('measurement summary changes', Array.isArray(r.json?.data?.summary?.changes), 'no changes');

  r = await call('PATCH', `/progress/measurements/${measId}`, { chestCm: 101 });
  check('update measurement', r.status === 200, `status ${r.status}`);

  r = await call('DELETE', `/progress/measurements/${measId}`);
  check('delete measurement', r.status === 200, `status ${r.status}`);

  r = await call('GET', '/progress/photos');
  check('photo timeline', r.status === 200 && r.json?.data?.items?.length >= 3, `count ${r.json?.data?.items?.length}`);
  check('photos grouped into timeline', Array.isArray(r.json?.data?.timeline), 'no timeline');
  const photos = r.json?.data?.items;

  r = await call('POST', '/progress/photos/compare', { firstPhotoId: photos[0].id, secondPhotoId: photos[1].id });
  check('compare photos', r.status === 201 && typeof r.json?.data?.daysBetween === 'number', `status ${r.status}`);

  r = await call('POST', '/progress/photos', { photoUrl: 'http://localhost:3000/uploads/library/onboarding-1.jpg', photoType: 'BACK', capturedDate: '2026-11-12', weightKg: 72 });
  check('add photo', r.status === 201, `status ${r.status}`);
  const photoId = r.json?.data?.id;

  r = await call('GET', '/progress/photos?photoType=BACK');
  check('photo type filter', r.status === 200 && r.json?.data?.items?.every((p) => p.photoType === 'BACK'), 'filter leaked');

  r = await call('PATCH', `/progress/photos/${photoId}`, { notes: 'updated' });
  check('update photo', r.status === 200, `status ${r.status}`);

  r = await call('DELETE', `/progress/photos/${photoId}`);
  check('delete photo', r.status === 200, `status ${r.status}`);

  // -------------------------------------------------------- NUTRITION
  await section('Nutrition');
  r = await call('GET', '/nutrition/daily');
  check('daily nutrition', r.status === 200 && 'totals' in r.json?.data, `status ${r.status}`);
  check('nutrition has meals breakdown', r.json?.data?.meals?.length === 6, `meals ${r.json?.data?.meals?.length}`);
  check('nutrition has targets', !!r.json?.data?.targets?.calories, 'no targets');
  check('nutrition macro split', 'proteinPct' in (r.json?.data?.macroSplit || {}), 'no macroSplit');

  r = await call('GET', '/nutrition/history?days=7');
  check('nutrition history', r.status === 200 && r.json?.data?.points?.length === 7, `points ${r.json?.data?.points?.length}`);

  r = await call('GET', '/nutrition/meal-types');
  check('meal types', r.status === 200 && r.json?.data?.items?.length === 6, `count ${r.json?.data?.items?.length}`);

  r = await call('GET', '/nutrition/frequent');
  check('frequent foods', r.status === 200 && r.json?.data?.items?.length >= 1, `count ${r.json?.data?.items?.length}`);

  r = await call('POST', '/nutrition/food', { foodName: 'TEST Protein Bar', mealType: 'SNACKS', calories: 220, proteinG: 20, carbsG: 24, fatG: 7 });
  check('create food log', r.status === 201 && !!r.json?.data?.id, `status ${r.status} ${r.json?.message}`);
  const foodId = r.json?.data?.id;

  r = await call('GET', '/nutrition/food?search=TEST Protein');
  check('food search', r.status === 200 && r.json?.data?.items?.length >= 1, 'search failed');

  r = await call('GET', '/nutrition/food?mealType=SNACKS');
  check('food meal filter', r.status === 200 && r.json?.data?.items?.every((f) => f.mealType === 'SNACKS'), 'filter leaked');

  r = await call('GET', '/nutrition/food?minCalories=200&maxCalories=300');
  check('food calorie range filter', r.status === 200 && r.json?.data?.items?.every((f) => f.calories >= 200 && f.calories <= 300), 'filter leaked');

  r = await call('GET', `/nutrition/food/${foodId}`);
  check('get food by id', r.status === 200 && r.json?.data?.id === foodId, `status ${r.status}`);

  r = await call('PUT', `/nutrition/food/${foodId}`, { calories: 250 });
  check('update food', r.status === 200 && r.json?.data?.calories === 250, `status ${r.status}`);

  r = await call('POST', '/nutrition/food', { foodName: 'X', mealType: 'INVALID', calories: 1 });
  check('food validates meal type', r.status === 400, `status ${r.status}`);

  r = await call('DELETE', `/nutrition/food/${foodId}`);
  check('delete food', r.status === 200, `status ${r.status}`);

  // ------------------------------------------------------------ WATER
  await section('Water');
  r = await call('GET', '/water/daily');
  check('daily water', r.status === 200 && typeof r.json?.data?.totalMl === 'number', `status ${r.status}`);
  check('water has target + progress', typeof r.json?.data?.progressPercentage === 'number', 'no progress');
  check('water quick-add options', r.json?.data?.quickAddOptions?.length > 0, 'no quick add');
  const waterBefore = r.json?.data?.totalMl;

  r = await call('POST', '/water', { amountMl: 500 });
  check('add water', r.status === 201, `status ${r.status}`);
  const waterId = r.json?.data?.id;

  r = await call('GET', '/water/daily');
  check('water total increased', r.json?.data?.totalMl === waterBefore + 500, `${waterBefore} -> ${r.json?.data?.totalMl}`);

  r = await call('GET', '/water/history?days=7');
  check('water history', r.status === 200 && r.json?.data?.points?.length === 7, `points ${r.json?.data?.points?.length}`);

  r = await call('PATCH', `/water/${waterId}`, { amountMl: 300 });
  check('update water', r.status === 200 && r.json?.data?.amountMl === 300, `status ${r.status}`);

  r = await call('POST', '/water', { amountMl: 99999 });
  check('water validates max', r.status === 400, `status ${r.status}`);

  r = await call('DELETE', `/water/${waterId}`);
  check('delete water', r.status === 200, `status ${r.status}`);

  // Undo removes the most recent entry of the day, so make sure one exists
  // rather than depending on seeded data still falling on today's date.
  await call('POST', '/water', { amountMl: 200 });
  r = await call('DELETE', '/water/undo');
  check('water undo last', r.status === 200, `status ${r.status}`);

  // ------------------------------------------------------------ SLEEP
  await section('Sleep');
  r = await call('GET', '/sleep?limit=10');
  check('sleep history', r.status === 200 && r.json?.data?.items?.length >= 1, `count ${r.json?.data?.items?.length}`);
  check('sleep has duration label', !!r.json?.data?.items?.[0]?.durationLabel, 'no label');

  r = await call('GET', '/sleep/summary?days=7');
  check('sleep summary', r.status === 200 && r.json?.data?.points?.length === 7, `points ${r.json?.data?.points?.length}`);
  check('sleep average', typeof r.json?.data?.averageHours === 'number', 'no average');

  r = await call('GET', '/sleep/quality-options');
  check('sleep quality options', r.status === 200 && r.json?.data?.items?.length === 4, `count ${r.json?.data?.items?.length}`);

  r = await call('POST', '/sleep', { sleepStart: '2026-11-10T23:00:00.000Z', sleepEnd: '2026-11-11T07:00:00.000Z', sleepQuality: 'GOOD' });
  check('create sleep', r.status === 201 && r.json?.data?.durationMinutes === 480, `min ${r.json?.data?.durationMinutes}`);
  const sleepId = r.json?.data?.id;

  r = await call('GET', '/sleep?sleepQuality=GOOD');
  check('sleep quality filter', r.status === 200 && r.json?.data?.items?.every((s) => s.sleepQuality === 'GOOD'), 'filter leaked');

  r = await call('PATCH', `/sleep/${sleepId}`, { sleepQuality: 'EXCELLENT' });
  check('update sleep', r.status === 200 && r.json?.data?.sleepQuality === 'EXCELLENT', `status ${r.status}`);

  r = await call('POST', '/sleep', { sleepStart: '2026-11-11T07:00:00.000Z', sleepEnd: '2026-11-10T23:00:00.000Z' });
  check('sleep rejects reversed times', r.status === 400, `status ${r.status}`);

  r = await call('DELETE', `/sleep/${sleepId}`);
  check('delete sleep', r.status === 200, `status ${r.status}`);

  // ------------------------------------------------------- ATTENDANCE
  await section('Attendance');
  r = await call('GET', '/attendance/calendar');
  check('attendance calendar', r.status === 200 && r.json?.data?.days?.length >= 28, `days ${r.json?.data?.days?.length}`);
  check('calendar has summary', typeof r.json?.data?.summary?.consistencyPercentage === 'number', 'no summary');
  check('calendar marks workout days', r.json?.data?.days?.some((d) => d.status === 'WORKOUT'), 'no workout days');

  r = await call('GET', '/attendance/stats');
  check('attendance stats', r.status === 200 && typeof r.json?.data?.currentStreak === 'number', `status ${r.status}`);
  check('longest streak computed', typeof r.json?.data?.longestStreak === 'number', 'no longestStreak');

  r = await call('GET', '/attendance/today');
  check('attendance today', r.status === 200 && 'checkedIn' in r.json?.data, `status ${r.status}`);

  r = await call('POST', '/attendance/check-in', { attendanceDate: '2026-11-12' });
  check('check in', r.status === 200 && !!r.json?.data?.id, `status ${r.status}`);
  const attId = r.json?.data?.id;

  r = await call('POST', '/attendance/check-out', { attendanceDate: '2026-11-12' });
  check('check out', r.status === 200 && r.json?.data?.checkOutAt, `status ${r.status}`);

  r = await call('GET', '/attendance?fromDate=2026-01-01&toDate=2027-01-01');
  check('attendance date filter', r.status === 200 && r.json?.data?.items?.length >= 1, 'no items');

  r = await call('PATCH', `/attendance/${attId}`, { notes: 'test note' });
  check('update attendance', r.status === 200 && r.json?.data?.notes === 'test note', `status ${r.status}`);

  r = await call('DELETE', `/attendance/${attId}`);
  check('delete attendance', r.status === 200, `status ${r.status}`);

  // -------------------------------------------------------- ANALYTICS
  await section('Analytics');
  r = await call('GET', '/analytics/dashboard');
  const dash = r.json?.data;
  check('dashboard', r.status === 200 && !!dash, `status ${r.status} ${r.json?.message}`);
  check('dashboard greeting', !!dash?.greeting, 'no greeting');
  check('dashboard profile', !!dash?.profile?.fullName, 'no profile');
  check('dashboard todays progress', typeof dash?.todaysProgress?.overallPercentage === 'number', 'no progress');
  check('dashboard weight block', 'currentKg' in (dash?.weight || {}), 'no weight');
  check('dashboard weekly activity (7 bars)', dash?.weeklySummary?.activity?.length === 7, `bars ${dash?.weeklySummary?.activity?.length}`);
  check('dashboard recent activity', Array.isArray(dash?.recentActivity), 'no recentActivity');
  check('dashboard totals', typeof dash?.totals?.totalWorkouts === 'number', 'no totals');

  r = await call('GET', '/analytics/workouts?days=30');
  check('workout analytics', r.status === 200 && r.json?.data?.points?.length === 30, `points ${r.json?.data?.points?.length}`);
  check('muscle distribution', r.json?.data?.muscleDistribution?.length > 0, 'no distribution');
  check('workout totals', r.json?.data?.totals?.sessionCount > 0, 'no sessions');

  r = await call('GET', '/analytics/strength');
  check('personal records', r.status === 200 && r.json?.data?.personalRecords?.length > 0, `count ${r.json?.data?.personalRecords?.length}`);
  check('PRs flagged as estimates', r.json?.data?.isEstimate === true, 'not flagged');
  const prExId = r.json?.data?.personalRecords?.[0]?.exerciseId;

  r = await call('GET', `/analytics/strength?exerciseId=${prExId}`);
  check('strength progression', r.status === 200 && r.json?.data?.points?.length > 0, `points ${r.json?.data?.points?.length}`);

  r = await call('GET', '/analytics/weight?days=90');
  check('weight analytics', r.status === 200 && Array.isArray(r.json?.data?.points), 'no points');

  r = await call('GET', '/analytics/monthly');
  check('monthly report', r.status === 200 && !!r.json?.data?.workouts, `status ${r.status}`);
  check('monthly has nutrition', !!r.json?.data?.nutrition, 'no nutrition');
  check('monthly has attendance', !!r.json?.data?.attendance, 'no attendance');

  // --------------------------------------------------------- SETTINGS
  await section('Settings');
  r = await call('GET', '/settings');
  check('get settings', r.status === 200 && !!r.json?.data?.theme, `status ${r.status}`);

  r = await call('GET', '/settings/options');
  check('settings options', r.status === 200 && r.json?.data?.themes?.length === 3, `count ${r.json?.data?.themes?.length}`);

  r = await call('PUT', '/settings', { theme: 'DARK', dailyWaterTargetMl: 3500, weeklyWorkoutTarget: 6 });
  check('update settings', r.status === 200 && r.json?.data?.theme === 'DARK' && r.json?.data?.dailyWaterTargetMl === 3500, `status ${r.status}`);

  r = await call('PUT', '/settings', { dailyWaterTargetMl: 100 });
  check('settings validates range', r.status === 400, `status ${r.status}`);

  await call('PUT', '/settings', { theme: 'SYSTEM', dailyWaterTargetMl: 3000, weeklyWorkoutTarget: 5 });

  // ------------------------------------------------------------ MEDIA
  await section('Media / static');
  r = await call('GET', '/media');
  check('list media', r.status === 200, `status ${r.status}`);

  // Derive the origin from BASE so the suite works on any port.
  const ORIGIN = BASE.replace(/\/api\/v\d+\/?$/, '');
  const imgRes = await fetch(`${ORIGIN}/uploads/library/auth-background.jpg`);
  check('static image served', imgRes.status === 200 && imgRes.headers.get('content-type')?.includes('image'), `status ${imgRes.status} type ${imgRes.headers.get('content-type')}`);

  // --------------------------------------------------------- CLEAN UP
  await section('Cleanup');
  r = await call('DELETE', `/workout-plans/${newPlanId}`);
  check('delete test plan', r.status === 200, `status ${r.status}`);

  // Remove any plans left behind by an earlier run of this script.
  r = await call('GET', '/workout-plans?search=TEST&limit=50');
  for (const stale of r.json?.data?.items || []) {
    if (stale.planName.startsWith('TEST')) {
      await call('DELETE', `/workout-plans/${stale.id}`);
    }
  }

  r = await call('DELETE', `/exercises/${exId}`);
  check('delete test exercise', r.status === 200, `status ${r.status}`);
  r = await call('DELETE', `/categories/${catId}`);
  check('delete test category', r.status === 200, `status ${r.status}`);

  // ---------------------------------------------------------- SUMMARY
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PASSED: ${pass}`);
  console.log(`FAILED: ${failures.length}`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log('='.repeat(60));
  process.exit(failures.length ? 1 : 0);
})().catch((e) => {
  console.error('TEST RUNNER CRASHED:', e);
  console.log(`\nPASSED so far: ${pass}`);
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
});
