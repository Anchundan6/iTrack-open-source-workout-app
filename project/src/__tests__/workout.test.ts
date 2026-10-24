import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutTemplate } from '../types/workout';
import {
  baseName,
  completionFrom,
  computeStreak,
  dayKey,
  expandTemplate,
  groupBySet,
  latestWorkout,
  nextRoutine,
  setNumberOf,
  startOfWeek,
  workoutsForTemplate,
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
