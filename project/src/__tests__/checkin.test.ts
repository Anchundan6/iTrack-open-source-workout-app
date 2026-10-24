import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Workout } from '../types/workout';
import {
  computeGoalStreak,
  hasCompletedSet,
  recentSetPerformances,
  sessionsInWeek,
  startOfWeek,
} from '../utils/workout';

const day = (offsetDays: number, hour = 10) => {
  const monday = startOfWeek(new Date());
  monday.setDate(monday.getDate() + offsetDays);
  monday.setHours(hour, 0, 0, 0);
  return monday;
};

/** A session with `sets` completed sets on one exercise. */
const session = (offsetDays: number, sets = 1): Workout => ({
  id: `w${offsetDays}-${sets}`,
  name: 'Push',
  templateId: 't1',
  date: day(offsetDays).toISOString(),
  duration: 1800,
  completionPercentage: 100,
  completed: true,
  completedExerciseIds: ['e1-set-1'],
  exercises: [
    {
      id: 'e1-set-1',
      name: 'Bench Press',
      reps: 10,
      type: 'reps',
      targetMuscles: [],
      setNumber: 1,
      sets: Array.from({ length: sets }, (_, i) => ({
        id: `s${i}`,
        reps: 8,
        weight: 60,
        completed: true,
      })),
    },
  ],
});

/** A session that was opened and abandoned — nothing ticked off. */
const abandoned = (offsetDays: number): Workout => ({
  ...session(offsetDays),
  id: `abandoned-${offsetDays}`,
  completedExerciseIds: [],
  completionPercentage: 0,
  exercises: [
    {
      id: 'e1-set-1',
      name: 'Bench Press',
      reps: 10,
      type: 'reps',
      targetMuscles: [],
      setNumber: 1,
      sets: [{ id: 's0', reps: 0, weight: 0, completed: false }],
    },
  ],
});

describe('hasCompletedSet', () => {
  it('counts a session with at least one completed set', () => {
    expect(hasCompletedSet(session(0))).toBe(true);
  });

  it('does not count a session nothing was ticked off in', () => {
    expect(hasCompletedSet(abandoned(0))).toBe(false);
  });

  it('counts workouts recorded before per-set tracking, from the ticked ids', () => {
    const legacy: Workout = { ...session(0), exercises: [], completedExerciseIds: ['e1-set-1'] };
    expect(hasCompletedSet(legacy)).toBe(true);
    expect(hasCompletedSet({ ...legacy, completedExerciseIds: [] })).toBe(false);
  });
});

describe('sessionsInWeek', () => {
  const monday = startOfWeek(new Date());

  it('counts only sessions that qualify', () => {
    expect(sessionsInWeek([session(0), abandoned(1), session(2)], monday)).toBe(2);
  });

  it('ignores days outside the week', () => {
    expect(sessionsInWeek([session(-1), session(7)], monday)).toBe(0);
    expect(sessionsInWeek([session(0), session(6)], monday)).toBe(2);
  });

  it('recomputes when a session is deleted', () => {
    const all = [session(0), session(1), session(2)];
    expect(sessionsInWeek(all, monday)).toBe(3);
    const afterDelete = all.filter((w) => w.id !== all[1].id);
    expect(sessionsInWeek(afterDelete, monday)).toBe(2);
  });
});

describe('computeGoalStreak', () => {
  it('is zero with no history', () => {
    expect(computeGoalStreak([], 3)).toBe(0);
  });

  it('counts the current week once the goal is met', () => {
    expect(computeGoalStreak([session(0), session(1), session(2)], 3)).toBe(1);
  });

  it('does not count the current week until the goal is met', () => {
    expect(computeGoalStreak([session(0), session(1)], 3)).toBe(0);
  });

  it('does not break on a week still in progress', () => {
    // Last week hit 3, this week only has 1 so far.
    const last = [session(-7), session(-6), session(-5)];
    expect(computeGoalStreak([...last, session(0)], 3)).toBe(1);
  });

  it('counts consecutive weeks that hit the goal', () => {
    const weeks = [
      session(-21), session(-20), session(-19),
      session(-14), session(-13), session(-12),
      session(-7), session(-6), session(-5),
    ];
    expect(computeGoalStreak(weeks, 3)).toBe(3);
  });

  it('stops at the first week that missed', () => {
    const weeks = [
      session(-21), session(-20), session(-19),
      session(-14), // only one that week
      session(-7), session(-6), session(-5),
    ];
    expect(computeGoalStreak(weeks, 3)).toBe(1);
  });

  it('follows the goal setting: a higher goal is harder to keep', () => {
    const weeks = [session(0), session(1), session(-7), session(-6)];
    expect(computeGoalStreak(weeks, 2)).toBe(2);
    expect(computeGoalStreak(weeks, 3)).toBe(0);
  });

  it('ignores abandoned sessions when checking the goal', () => {
    expect(computeGoalStreak([session(0), abandoned(1), abandoned(2)], 3)).toBe(0);
  });

  it('treats a missing goal as 1 session per week', () => {
    expect(computeGoalStreak([session(-7)], 0)).toBe(1);
  });
});

describe('recentSetPerformances', () => {
  const w = (iso: string, weight: number, reps: number): Workout => ({
    ...session(0),
    id: iso,
    date: iso,
    exercises: [
      {
        id: 'e1-set-1',
        name: 'Bench Press',
        reps: 10,
        type: 'reps',
        targetMuscles: [],
        setNumber: 1,
        sets: [{ id: 's0', reps, weight, completed: true }],
      },
    ],
  });

  it('returns the newest performances first', () => {
    const history = [
      w('2026-01-01T10:00:00', 55, 8),
      w('2026-01-08T10:00:00', 57.5, 9),
      w('2026-01-15T10:00:00', 60, 6),
    ];
    expect(recentSetPerformances(history, 't1', 'Bench Press', 1, 2)).toEqual([
      { weightKg: 60, reps: 6 },
      { weightKg: 57.5, reps: 9 },
    ]);
  });

  it('ignores other exercises, sets and routines', () => {
    const history = [w('2026-01-01T10:00:00', 60, 8)];
    expect(recentSetPerformances(history, 't2', 'Bench Press', 1)).toEqual([]);
    expect(recentSetPerformances(history, 't1', 'Squat', 1)).toEqual([]);
    expect(recentSetPerformances(history, 't1', 'Bench Press', 2)).toEqual([]);
  });
});

describe('check-in stats follow the store', () => {
  beforeEach(() => {
    const map = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        get length() {
          return map.size;
        },
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k),
        clear: () => map.clear(),
        key: (i: number) => Array.from(map.keys())[i] ?? null,
      },
      configurable: true,
      writable: true,
    });
    vi.resetModules();
  });

  it('recomputes the week count after a workout is deleted', async () => {
    const { useWorkoutStore } = await import('../store/useWorkoutStore');
    const store = useWorkoutStore;
    const monday = startOfWeek(new Date());

    store.getState().addWorkout(session(0));
    store.getState().addWorkout(session(1));
    store.getState().addWorkout(abandoned(2));
    expect(sessionsInWeek(store.getState().workouts, monday)).toBe(2);

    store.getState().deleteWorkout(store.getState().workouts[0].id);
    expect(sessionsInWeek(store.getState().workouts, monday)).toBe(1);
    // Still 1 after a reload — the deleted session is gone from storage.
    vi.resetModules();
    const { useWorkoutStore: reloaded } = await import('../store/useWorkoutStore');
    expect(sessionsInWeek(reloaded.getState().workouts, monday)).toBe(1);
  });
});
