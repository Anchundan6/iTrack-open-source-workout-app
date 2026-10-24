import type { ExerciseCategory, ExerciseDef, Equipment } from '../types/workout';
import { ALL_MUSCLES, muscleKey } from './muscles';

export const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'band', 'other'];

export const CATEGORIES: ExerciseCategory[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'fullBody', 'cardio'];

const KNOWN_MUSCLES = new Set(ALL_MUSCLES.map(muscleKey));
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Every structural problem in the library, as human-readable strings.
 * Intended for a test/CI gate: an empty array means the seed data is sound.
 */
export function validateLibrary(defs: ExerciseDef[]): string[] {
  const errors: string[] = [];
  if (defs.length === 0) errors.push('library is empty');

  const ids = new Set<string>();
  for (const def of defs) {
    const at = `[${def.id || '?'}]`;
    if (!def.id) errors.push(`${at} missing id`);
    else if (!ID_PATTERN.test(def.id)) errors.push(`${at} id must be kebab-case`);
    else if (ids.has(def.id)) errors.push(`${at} duplicate id`);
    else ids.add(def.id);

    if (!def.name?.trim()) errors.push(`${at} missing name`);
    if (!EQUIPMENT.includes(def.equipment)) errors.push(`${at} unknown equipment "${def.equipment}"`);
    if (!CATEGORIES.includes(def.category)) errors.push(`${at} unknown category "${def.category}"`);
    if (!def.primary?.length) errors.push(`${at} needs at least one primary muscle`);
    for (const m of [...(def.primary ?? []), ...(def.secondary ?? [])]) {
      if (!KNOWN_MUSCLES.has(muscleKey(m))) errors.push(`${at} unknown muscle "${m}"`);
    }
    if (def.type !== 'reps' && def.type !== 'time') errors.push(`${at} unknown type "${def.type}"`);
    const ceiling = def.type === 'time' ? 3600 : 500;
    if (!Number.isFinite(def.defaultReps) || def.defaultReps < 1 || def.defaultReps > ceiling) {
      errors.push(`${at} defaultReps ${def.defaultReps} out of range (1-${ceiling})`);
    }
    if (!def.steps?.length || def.steps.length < 2) errors.push(`${at} needs at least 2 steps`);
    if (def.steps?.some((s) => !s.trim())) errors.push(`${at} has an empty step`);
    if (def.tips?.some((s) => !s.trim())) errors.push(`${at} has an empty tip`);
  }

  // Substitutions are cross-references: checked only once every id is known.
  for (const def of defs) {
    for (const sub of def.substitutions ?? []) {
      if (sub === def.id) errors.push(`[${def.id}] substitutes itself`);
      else if (!ids.has(sub)) errors.push(`[${def.id}] unknown substitution "${sub}"`);
    }
  }
  return errors;
}

export interface LibraryFilter {
  query?: string;
  equipment?: Equipment | 'all';
  category?: ExerciseCategory | 'all';
  /** Canonical muscle name; matches primary or secondary. */
  muscle?: string | 'all';
  /** Muscle group (e.g. every muscle of the "legs" group): matches any of them. */
  muscles?: string[];
}

const haystack = (def: ExerciseDef) => [def.name, ...(def.aliases ?? [])].join(' ').toLowerCase();

/** Does the exercise match the free-text query (name or alias)? */
export function matchesQuery(def: ExerciseDef, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = haystack(def);
  // Every whitespace-separated term must appear somewhere.
  return q.split(/\s+/).every((term) => text.includes(term));
}

/**
 * Filter the library. Name matches rank first (prefix before substring),
 * then everything else alphabetically — so typing "bench" surfaces the
 * bench presses instead of a random alphabetical page.
 */
export function searchExercises(defs: ExerciseDef[], filter: LibraryFilter = {}): ExerciseDef[] {
  const { query = '', equipment = 'all', category = 'all', muscle = 'all', muscles } = filter;
  const q = query.trim().toLowerCase();
  const muscleWanted = muscle === 'all' ? undefined : muscleKey(muscle);
  const groupsWanted = muscles?.length ? new Set(muscles.map(muscleKey)) : undefined;

  const hits = defs.filter((def) => {
    if (equipment !== 'all' && def.equipment !== equipment) return false;
    if (category !== 'all' && def.category !== category) return false;
    const trained = [...def.primary, ...(def.secondary ?? [])];
    if (muscleWanted && !trained.some((m) => muscleKey(m) === muscleWanted)) return false;
    if (groupsWanted && !trained.some((m) => groupsWanted.has(muscleKey(m)))) return false;
    return matchesQuery(def, q);
  });

  if (!q) return hits;
  const rank = (def: ExerciseDef) => {
    const name = def.name.toLowerCase();
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (haystack(def).startsWith(q)) return 2;
    return 3;
  };
  return hits.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** Look up a definition by id (substitution lists, deep links). */
export function exerciseById(defs: ExerciseDef[], id: string | undefined): ExerciseDef | undefined {
  return id ? defs.find((def) => def.id === id) : undefined;
}
