import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INCREMENT_KG,
  LB_INCREMENT_KG,
  nextWeight,
  repRangeBottom,
  suggestProgression,
} from '../utils/progression';
import type { SetPerformance } from '../types/workout';

const TARGET = 10;

describe('suggestProgression', () => {
  it('gives the target when there is no history', () => {
    const s = suggestProgression({ targetReps: TARGET });
    expect(s.action).toBe('baseline');
    expect(s.reason).toBe('noHistory');
    expect(s.reps).toBe(TARGET);
    expect(s.weightKg).toBeUndefined();
    expect(s.changed).toBe(false);
  });

  it('keeps an already-typed weight when reps were never logged', () => {
    const s = suggestProgression({ last: { weightKg: 40 }, targetReps: TARGET });
    expect(s.action).toBe('baseline');
    expect(s.weightKg).toBe(40);
    expect(s.reps).toBe(TARGET);
  });

  it('adds one rep while short of the target', () => {
    const s = suggestProgression({ last: { weightKg: 60, reps: 8 }, targetReps: TARGET });
    expect(s.action).toBe('addReps');
    expect(s.reason).toBe('missedTarget');
    expect(s.weightKg).toBe(60);
    expect(s.reps).toBe(9);
    expect(s.changed).toBe(true);
  });

  it('never overshoots the target when adding reps', () => {
    const s = suggestProgression({ last: { weightKg: 60, reps: 9 }, targetReps: TARGET });
    expect(s.reps).toBe(TARGET);
  });

  it('adds weight and drops back down the range once the target is hit', () => {
    const s = suggestProgression({ last: { weightKg: 60, reps: 10 }, targetReps: TARGET });
    expect(s.action).toBe('addWeight');
    expect(s.reason).toBe('hitTarget');
    expect(s.weightKg).toBe(62.5);
    expect(s.reps).toBe(repRangeBottom(TARGET));
    expect(s.changed).toBe(true);
  });

  it('adds weight when the target was exceeded', () => {
    const s = suggestProgression({ last: { weightKg: 60, reps: 12 }, targetReps: TARGET });
    expect(s.action).toBe('addWeight');
    expect(s.weightKg).toBe(62.5);
  });

  it('holds after the weight went back down', () => {
    const s = suggestProgression({
      last: { weightKg: 60, reps: 8 },
      previous: { weightKg: 62.5, reps: 6 },
      targetReps: TARGET,
    });
    expect(s.action).toBe('hold');
    expect(s.reason).toBe('stalled');
    expect(s.weightKg).toBe(60);
    expect(s.reps).toBe(9); // still working up to the target
  });

  it('holds when the same weight produced no extra reps', () => {
    const s = suggestProgression({
      last: { weightKg: 60, reps: 8 },
      previous: { weightKg: 60, reps: 9 },
      targetReps: TARGET,
    });
    expect(s.action).toBe('hold');
    expect(s.reason).toBe('stalled');
    expect(s.weightKg).toBe(60);
    expect(s.reps).toBe(9);
  });

  it('holds at the target when reps are already there but nothing improved', () => {
    const s = suggestProgression({
      last: { weightKg: 60, reps: 12 },
      previous: { weightKg: 60, reps: 13 },
      targetReps: TARGET,
    });
    expect(s.action).toBe('hold');
    expect(s.reps).toBe(TARGET);
  });

  it('does not stall when the last session beat the previous one', () => {
    const s = suggestProgression({
      last: { weightKg: 62.5, reps: 8 },
      previous: { weightKg: 62.5, reps: 6 },
      targetReps: TARGET,
    });
    expect(s.action).toBe('addReps');
    expect(s.reps).toBe(9);
  });

  it('pushes reps on unloaded work, even past the target', () => {
    const s = suggestProgression({ last: { reps: 12 }, targetReps: TARGET });
    expect(s.action).toBe('addReps');
    expect(s.reason).toBe('bodyweight');
    expect(s.weightKg).toBeUndefined();
    expect(s.reps).toBe(13);
  });

  it('works toward the target on unloaded work', () => {
    const s = suggestProgression({ last: { reps: 6 }, targetReps: TARGET });
    expect(s.reason).toBe('bodyweight');
    expect(s.reps).toBe(7);
  });

  it('respects a smaller increment (lb plates)', () => {
    const s = suggestProgression({
      last: { weightKg: 61.23, reps: 10 },
      targetReps: TARGET,
      incrementKg: LB_INCREMENT_KG,
    });
    expect(s.weightKg).toBeCloseTo(63.5, 1); // 135 lb → 140 lb
  });

  it('never suggests a weight lower than last time', () => {
    const weights = [20, 21.5, 30.5, 47.5, 60, 61.3, 100];
    for (const w of weights) {
      const s = suggestProgression({ last: { weightKg: w, reps: TARGET }, targetReps: TARGET });
      expect(s.weightKg!).toBeGreaterThan(w);
      expect(s.weightKg!).toBeLessThanOrEqual(w + DEFAULT_INCREMENT_KG);
    }
  });

  it('survives junk input: zero and negative numbers count as no history', () => {
    expect(suggestProgression({ last: { weightKg: 0, reps: 0 }, targetReps: TARGET }).action).toBe('baseline');
    expect(suggestProgression({ last: { reps: -3 }, targetReps: TARGET }).action).toBe('baseline');
    expect(suggestProgression({ targetReps: 0 }).reps).toBe(1);
  });

  it('leaves the history it read untouched', () => {
    const last: SetPerformance = { weightKg: 60, reps: 10 };
    const previous: SetPerformance = { weightKg: 60, reps: 8 };
    Object.freeze(last);
    Object.freeze(previous);
    const s = suggestProgression({ last, previous, targetReps: TARGET });
    expect(last).toEqual({ weightKg: 60, reps: 10 });
    expect(previous).toEqual({ weightKg: 60, reps: 8 });
    expect(s.weightKg).toBe(62.5);
  });
});

describe('nextWeight', () => {
  it('snaps to plate boundaries when the bar is already loaded on them', () => {
    expect(nextWeight(60)).toBe(62.5);
    expect(nextWeight(60, 5)).toBe(65);
  });

  it('keeps a clean jump when the bar is not on a boundary', () => {
    expect(nextWeight(61)).toBe(63.5); // not 62.5, not 60
    expect(nextWeight(61.25)).toBe(63.75);
  });

  it('always increases', () => {
    for (let w = 5; w <= 120; w += 0.25) {
      expect(nextWeight(w)).toBeGreaterThan(w);
    }
  });
});

describe('repRangeBottom', () => {
  it('drops two reps below the target, never below one', () => {
    expect(repRangeBottom(10)).toBe(8);
    expect(repRangeBottom(5)).toBe(3);
    expect(repRangeBottom(2)).toBe(1);
  });
});
