import { describe, expect, it } from 'vitest';
import type { ActiveSession, Workout, WorkoutTemplate } from '../types/workout';
import {
  baseName,
  completionFrom,
  computeStreak,
  dayKey,
  expandTemplate,
  groupBySet,
  lastSetPerformance,
  latestWorkout,
  nextRoutine,
  setNumberOf,
  startOfWeek,
  workoutsForTemplate,
  workoutVolume,
  buildSessionExercises,
  commitSessionTime,
  sessionElapsed,
  MAX_UNCOMMITTED_MS,
} from '../utils/workout';

const tpl: WorkoutTemplate = {
  id: 't1',
  name: 'Push',
  numberOfSets: 3,
  exercises: [
    { id: 'e1', name: 'Bench Press', reps: 10, type: 'reps', targetMuscles: ['chest'] },
    { id: 'e2', name: 'Plank', reps: 60, type: 'time', targetMuscles: ['core'] },
  ],
};

const workoutOn = (isoDate: string, over: Partial<Workout> = {}): Workout => ({
  id: isoDate,
  name: 'Push',
  exercises: [],
  date: isoDate,
  duration: 1800,
  completionPercentage: 100,
  completed: true,
  ...over,
});

describe('expandTemplate', () => {
  it('creates one exercise copy per set, in set order', () => {
    const expanded = expandTemplate(tpl);
    expect(expanded).toHaveLength(6);
    expect(expanded.map((e) => e.setNumber)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(expanded.map((e) => e.id)).toEqual([
      'e1-set-1', 'e2-set-1', 'e1-set-2', 'e2-set-2', 'e1-set-3', 'e2-set-3',
    ]);
  });

  it('defaults to a single set when numberOfSets is missing', () => {
    expect(expandTemplate({ ...tpl, numberOfSets: 0 })).toHaveLength(2);
  });
});

describe('legacy set encoding', () => {
  it('reads the set number from id or name suffix', () => {
    expect(setNumberOf({ id: 'e1-set-2', name: 'Bench Press' })).toBe(2);
    expect(setNumberOf({ id: 'e1', name: 'Bench Press (Set 3)' })).toBe(3);
    expect(setNumberOf({ id: 'e1', name: 'Bench Press' })).toBe(1);
  });

  it('strips the legacy suffix from the name', () => {
    expect(baseName({ name: 'Bench Press (Set 2)' })).toBe('Bench Press');
    expect(baseName({ name: 'Plank' })).toBe('Plank');
  });
});

describe('groupBySet', () => {
  it('groups expanded exercises by set number in order', () => {
    const groups = groupBySet(expandTemplate(tpl));
    expect(groups.map((g) => g.set)).toEqual([1, 2, 3]);
    expect(groups.every((g) => g.items.length === 2)).toBe(true);
  });
});

describe('completionFrom', () => {
  it('computes percentages and guards against zero total', () => {
    expect(completionFrom(3, 4)).toBe(75);
    expect(completionFrom(0, 0)).toBe(0);
  });
});

describe('dayKey / startOfWeek', () => {
  it('formats the local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('returns Monday 00:00 of the containing week', () => {
    // 2026-10-24 is a Saturday; its week starts Monday 2026-10-19.
    const monday = startOfWeek(new Date(2026, 9, 24, 15, 30));
    expect(dayKey(monday)).toBe('2026-10-19');
    expect(monday.getHours()).toBe(0);
  });
});

describe('computeStreak', () => {
  it('counts consecutive trained days back from today', () => {
    const today = new Date(2026, 9, 24);
    const workouts = [workoutOn('2026-10-24T10:00:00'), workoutOn('2026-10-23T10:00:00')];
    expect(computeStreak(workouts, today)).toBe(2);
  });

  it('does not break on a rest day that is still today', () => {
    const today = new Date(2026, 9, 24);
    const workouts = [workoutOn('2026-10-23T10:00:00'), workoutOn('2026-10-22T10:00:00')];
    expect(computeStreak(workouts, today)).toBe(2);
  });

  it('breaks after a missed day', () => {
    const today = new Date(2026, 9, 24);
    const workouts = [workoutOn('2026-10-22T10:00:00')];
    expect(computeStreak(workouts, today)).toBe(0);
  });

  it('is 0 with no history', () => {
    expect(computeStreak([], new Date())).toBe(0);
  });
});

describe('routine/history helpers', () => {
  it('matches workouts to a template by id first, then name', () => {
    const byId = workoutOn('2026-10-01T10:00:00', { id: 'a', templateId: 't1', name: 'Renamed' });
    const byName = workoutOn('2026-10-02T10:00:00', { id: 'b', name: 'Push' });
    const other = workoutOn('2026-10-03T10:00:00', { id: 'c', name: 'Legs' });
    expect(workoutsForTemplate(tpl, [byId, byName, other]).map((w) => w.id)).toEqual(['a', 'b']);
  });

  it('picks the latest workout and the next routine in rotation', () => {
    const older = workoutOn('2026-10-01T10:00:00', { id: 'a' });
    const newer = workoutOn('2026-10-10T10:00:00', { id: 'b' });
    expect(latestWorkout([older, newer])?.id).toBe('b');

    const legs: WorkoutTemplate = { ...tpl, id: 't2', name: 'Legs' };
    // Legs never done -> suggested immediately.
    expect(nextRoutine([tpl, legs], [newer])?.template.id).toBe('t2');
    // Both done -> the one done longest ago.
    expect(nextRoutine([tpl, legs], [newer, workoutOn('2026-10-05T10:00:00', { id: 'c', templateId: 't2', name: 'Legs' })])?.template.id).toBe('t2');
    expect(nextRoutine([tpl, legs], [newer, workoutOn('2026-10-20T10:00:00', { id: 'c', templateId: 't2', name: 'Legs' })])?.template.id).toBe('t1');
  });
});

describe('lastSetPerformance', () => {
  const logged: Workout = workoutOn('2026-10-20T10:00:00', {
    templateId: 't1',
    exercises: [
      {
        id: 'e1-set-1',
        name: 'Bench Press',
        setNumber: 1,
        reps: 10,
        type: 'reps',
        targetMuscles: [],
        sets: [{ id: 'l1', reps: 8, weight: 60, completed: true }],
      },
    ],
  });

  it('returns the latest logged weight/reps for the same exercise and set', () => {
    expect(lastSetPerformance([logged], 't1', 'Bench Press', 1)).toEqual({ weightKg: 60, reps: 8 });
  });

  it('returns undefined when no history matches', () => {
    expect(lastSetPerformance([logged], 't1', 'Squat', 1)).toBeUndefined();
    expect(lastSetPerformance([logged], 't1', 'Bench Press', 2)).toBeUndefined();
    expect(lastSetPerformance([logged], 'other', 'Bench Press', 1)).toBeUndefined();
    expect(lastSetPerformance([], 't1', 'Bench Press', 1)).toBeUndefined();
  });

  it('ignores exercises without logged sets', () => {
    const noSets = workoutOn('2026-10-22T10:00:00', {
      templateId: 't1',
      exercises: [{ id: 'e1-set-1', name: 'Bench Press', setNumber: 1, reps: 10, type: 'reps', targetMuscles: [], sets: [] }],
    });
    // Newer workout has no set logs → falls back to the older one that does.
    expect(lastSetPerformance([noSets, logged], 't1', 'Bench Press', 1)).toEqual({ weightKg: 60, reps: 8 });
  });
});

describe('workoutVolume', () => {
  it('sums weight × reps over completed sets only, in kg', () => {
    const w = workoutOn('2026-10-20T10:00:00', {
      exercises: [
        { id: 'a', name: 'A', reps: 10, type: 'reps', targetMuscles: [], sets: [{ id: 's1', reps: 10, weight: 60, completed: true }] },
        { id: 'b', name: 'B', reps: 10, type: 'reps', targetMuscles: [], sets: [{ id: 's2', reps: 10, weight: 60, completed: false }] },
        { id: 'c', name: 'C', reps: 60, type: 'time', targetMuscles: [], sets: [{ id: 's3', reps: 60, weight: 0, completed: true }] },
        { id: 'd', name: 'D', reps: 10, type: 'reps', targetMuscles: [], sets: [] },
      ],
    });
    expect(workoutVolume(w)).toBe(600);
  });
});

const sessionAt = (lastTickAt: number, over: Partial<ActiveSession> = {}): ActiveSession => ({
  templateId: 't1',
  template: tpl,
  startedAt: lastTickAt,
  activeMs: 0,
  lastTickAt,
  completedIds: [],
  logs: {},
  ...over,
});

describe('sessionElapsed', () => {
  it('counts the committed time plus the running segment', () => {
    const s = sessionAt(1_000_000, { activeMs: 60_000 });
    expect(sessionElapsed(s, 1_000_000 + 30_000)).toBe(90_000);
  });

  it('caps the uncommitted segment so a killed session cannot bank hours', () => {
    const s = sessionAt(1_000_000, { activeMs: 60_000 });
    // Three days later: only the cap is credited on top.
    expect(sessionElapsed(s, 1_000_000 + 3 * 24 * 3600_000)).toBe(60_000 + MAX_UNCOMMITTED_MS);
  });

  it('never reports negative time after a clock change', () => {
    const s = sessionAt(1_000_000, { activeMs: 60_000 });
    expect(sessionElapsed(s, 900_000)).toBe(60_000);
  });
});

describe('commitSessionTime', () => {
  it('banks the running segment and keeps the elapsed total continuous', () => {
    const s = sessionAt(1_000_000, { activeMs: 60_000 });
    const now = 1_000_000 + 45_000;
    const committed = commitSessionTime(s, now);
    expect(committed.activeMs).toBe(105_000);
    expect(committed.lastTickAt).toBe(now);
    // No jump across the commit boundary.
    expect(sessionElapsed(committed, now)).toBe(sessionElapsed(s, now));
    // And it keeps accruing afterwards.
    expect(sessionElapsed(committed, now + 10_000)).toBe(115_000);
  });

  it('is idempotent when called twice at the same instant', () => {
    const once = commitSessionTime(sessionAt(1_000_000), 1_010_000);
    const twice = commitSessionTime(once, 1_010_000);
    expect(twice.activeMs).toBe(once.activeMs);
  });
});

describe('buildSessionExercises', () => {
  const expanded = expandTemplate(tpl);

  it('attaches the logged weight and reps to the matching set', () => {
    const out = buildSessionExercises(tpl, { 'e1-set-2': { weightKg: 60, reps: 8 } }, ['e1-set-2']);
    const target = out.find((e) => e.id === 'e1-set-2')!;
    expect(target.sets).toEqual([{ id: 'e1-set-2-log', reps: 8, weight: 60, completed: true }]);
  });

  it('logs a timed hold even when no numbers were typed', () => {
    const out = buildSessionExercises(tpl, {}, ['e2-set-1']);
    const plank = out.find((e) => e.id === 'e2-set-1')!;
    expect(plank.sets).toEqual([{ id: 'e2-set-1-log', reps: 60, weight: 0, completed: true }]);
    expect(plank.reps).toBe(60);
  });

  it('leaves untouched sets without a log entry', () => {
    const out = buildSessionExercises(tpl, {}, []);
    expect(out).toHaveLength(expanded.length);
    expect(out.every((e) => e.sets.length === 0)).toBe(true);
  });

  it('keeps a logged set as not completed when it was unticked again', () => {
    const out = buildSessionExercises(tpl, { 'e1-set-1': { weightKg: 50, reps: 10 } }, []);
    expect(out.find((e) => e.id === 'e1-set-1')!.sets[0].completed).toBe(false);
  });
});
