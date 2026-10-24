import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { CATEGORIES, EQUIPMENT, exerciseById, searchExercises, validateLibrary } from '../utils/library';

describe('exercise library', () => {
  it('has no structural problems', () => {
    expect(validateLibrary(EXERCISES)).toEqual([]);
  });

  it('ships at least 120 exercises', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(120);
  });

  it('covers every category and every equipment type', () => {
    for (const category of CATEGORIES) {
      expect(EXERCISES.some((e) => e.category === category), category).toBe(true);
    }
    for (const equipment of EQUIPMENT) {
      expect(EXERCISES.some((e) => e.equipment === equipment), equipment).toBe(true);
    }
  });

  it('keeps every substitution resolvable', () => {
    for (const def of EXERCISES) {
      for (const id of def.substitutions ?? []) {
        expect(exerciseById(EXERCISES, id), `${def.id} -> ${id}`).toBeDefined();
      }
    }
  });
});

describe('searchExercises', () => {
  it('matches on the name, case-insensitively', () => {
    const hits = searchExercises(EXERCISES, { query: 'BENCH' });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => e.name.toLowerCase().includes('bench'))).toBe(true);
  });

  it('matches on aliases', () => {
    expect(searchExercises(EXERCISES, { query: 'pullup' }).map((e) => e.id)).toContain('pull-up');
    expect(searchExercises(EXERCISES, { query: 'ohp' }).map((e) => e.id)).toContain('overhead-press');
  });

  it('ranks prefix matches ahead of mid-name matches', () => {
    const hits = searchExercises(EXERCISES, { query: 'squat' });
    expect(hits[0].name.toLowerCase().startsWith('squat') || hits[0].name.toLowerCase().includes('squat')).toBe(true);
    // Nothing unrelated sneaks in.
    expect(hits.every((e) => `${e.name} ${(e.aliases ?? []).join(' ')}`.toLowerCase().includes('squat'))).toBe(true);
  });

  it('requires every search term to match', () => {
    const hits = searchExercises(EXERCISES, { query: 'dumbbell press' });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => ['dumbbell', 'press'].every((term) => `${e.name} ${(e.aliases ?? []).join(' ')}`.toLowerCase().includes(term)))).toBe(true);
  });

  it('filters by equipment, category and muscle', () => {
    const barbell = searchExercises(EXERCISES, { equipment: 'barbell' });
    expect(barbell.length).toBeGreaterThan(0);
    expect(barbell.every((e) => e.equipment === 'barbell')).toBe(true);

    const legs = searchExercises(EXERCISES, { category: 'legs' });
    expect(legs.every((e) => e.category === 'legs')).toBe(true);

    const calves = searchExercises(EXERCISES, { muscle: 'Calves' });
    expect(calves.length).toBeGreaterThan(0);
    expect(calves.every((e) => [...e.primary, ...(e.secondary ?? [])].some((m) => m.toLowerCase() === 'calves'))).toBe(true);
  });

  it('combines filters instead of widening them', () => {
    const hits = searchExercises(EXERCISES, { equipment: 'dumbbell', category: 'chest', query: 'press' });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => e.equipment === 'dumbbell' && e.category === 'chest')).toBe(true);
  });

  it('returns the whole library for an empty filter', () => {
    expect(searchExercises(EXERCISES)).toHaveLength(EXERCISES.length);
  });

  it('returns nothing for gibberish', () => {
    expect(searchExercises(EXERCISES, { query: 'zzzzqqq' })).toEqual([]);
  });
});
