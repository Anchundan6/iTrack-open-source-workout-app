import type { ActiveSession, Exercise, SetPerformance, Workout, WorkoutTemplate } from '../types/workout';

export type { SetPerformance };

const SET_SUFFIX = /\s*\(set\s*\d+\)\s*$/i;

/** Expand a routine into one exercise copy per set, in set order. */
export function expandTemplate(template: WorkoutTemplate): Exercise[] {
 const sets = Math.max(1, template.numberOfSets || 1);
 const exercises: Exercise[] = [];
 for (let set = 1; set <= sets; set++) {
 template.exercises.forEach((exercise) => {
 exercises.push({
 ...exercise,
 id: `${exercise.id}-set-${set}`,
 setNumber: set,
 sets: [],
 });
 });
 }
 return exercises;
}

/** Exercise name without the legacy " (Set N)" suffix. */
export function baseName(exercise: Pick<Exercise, 'name'>): string {
 return exercise.name.replace(SET_SUFFIX, '').trim();
}

/** 1-based set number, from the field or (older data) the id/name. */
export function setNumberOf(exercise: Pick<Exercise, 'id' | 'name' | 'setNumber'>): number {
 if (exercise.setNumber) return exercise.setNumber;
 const fromId = exercise.id.match(/-set-(\d+)$/);
 if (fromId) return Number(fromId[1]);
 const fromName = exercise.name.match(/\(set\s*(\d+)\)\s*$/i);
 return fromName ? Number(fromName[1]) : 1;
}

export interface SetGroup<T> {
 set: number;
 items: T[];
}

/** Group exercises by set number, keeping their original order. */
export function groupBySet<T extends Pick<Exercise, 'id' | 'name' | 'setNumber'>>(exercises: T[]): SetGroup<T>[] {
 const groups = new Map<number, T[]>();
 exercises.forEach((exercise) => {
 const set = setNumberOf(exercise);
 if (!groups.has(set)) groups.set(set, []);
 groups.get(set)!.push(exercise);
 });
 return Array.from(groups.entries())
 .sort(([a], [b]) => a - b)
 .map(([set, items]) => ({ set, items }));
}

export function completionFrom(completed: number, total: number): number {
 return total > 0 ? (completed / total) * 100 : 0;
}

/**
 * The most recent logged performance for one set of one exercise in a routine
 * — used to prefill the set inputs (display only, never written back).
 */
/**
 * The `limit` most recent logged performances for one set of one exercise in
 * a routine, newest first. Two entries are enough to tell progress from a
 * stall, which is all the progression engine needs.
 */
export function recentSetPerformances(
 workouts: Workout[],
 templateId: string | undefined,
 exerciseName: string,
 setNumber: number,
 limit = 2
): SetPerformance[] {
 const candidates = workouts
 .filter((w) => (templateId ? w.templateId === templateId : false))
 .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
 const found: SetPerformance[] = [];
 for (const w of candidates) {
 const match = w.exercises.find(
 (e) => baseName(e) === exerciseName && setNumberOf(e) === setNumber && e.sets?.length > 0
 );
 if (match) {
 const s = match.sets[0];
 found.push({ weightKg: s.weight, reps: s.reps });
 if (found.length >= limit) break;
 }
 }
 return found;
}

export function lastSetPerformance(
 workouts: Workout[],
 templateId: string | undefined,
 exerciseName: string,
 setNumber: number
): SetPerformance | undefined {
 return recentSetPerformances(workouts, templateId, exerciseName, setNumber, 1)[0];
}

/** Total training volume in kg·reps, counting completed sets only. */
export function workoutVolume(workout: Workout): number {
 return workout.exercises.reduce((total, e) => {
 if (!e.sets?.length) return total;
 const s = e.sets[0];
 if (!s.completed || !s.weight || !s.reps || e.type !== 'reps') return total;
 return total + s.weight * s.reps;
 }, 0);
}

/** Local calendar day as YYYY-MM-DD (not UTC). */
export function dayKey(value: Date | string): string {
 const d = new Date(value);
 const y = d.getFullYear();
 const m = String(d.getMonth() + 1).padStart(2, '0');
 const day = String(d.getDate()).padStart(2, '0');
 return `${y}-${m}-${day}`;
}

/** Monday 00:00 of the week containing `value`. */
export function startOfWeek(value: Date): Date {
 const d = new Date(value);
 d.setHours(0, 0, 0, 0);
 const offset = (d.getDay() + 6) % 7; // Monday = 0
 d.setDate(d.getDate() - offset);
 return d;
}

// --- Check-ins ------------------------------------------------------------

/**
 * Whether a session counts: at least one set was ticked off (or logged).
 * Starting a workout and quitting doesn't check you in.
 */
export function hasCompletedSet(workout: Workout): boolean {
 if (workout.exercises?.some((e) => e.sets?.some((s) => s.completed))) return true;
 // Workouts recorded before per-set tracking only carry the ticked ids.
 return (workout.completedExerciseIds?.length ?? 0) > 0;
}

/** Qualifying sessions in the seven days starting at `monday`. */
export function sessionsInWeek(workouts: Workout[], monday: Date): number {
 const start = new Date(monday);
 start.setHours(0, 0, 0, 0);
 const end = new Date(start);
 end.setDate(end.getDate() + 7);
 return workouts.filter((w) => {
 const d = new Date(w.date);
 return d >= start && d < end && hasCompletedSet(w);
 }).length;
}

/**
 * Consecutive weeks that hit the weekly goal, counting back from today. The
 * week in progress doesn't break the streak until it's over.
 */
export function computeGoalStreak(workouts: Workout[], goal: number, today = new Date()): number {
 const target = Math.max(1, Math.round(goal || 1));
 const thisMonday = startOfWeek(today);
 let streak = 0;
 for (let i = 0; i < 52; i++) {
 const monday = new Date(thisMonday);
 monday.setDate(monday.getDate() - i * 7);
 if (sessionsInWeek(workouts, monday) >= target) {
 streak++;
 } else if (i > 0) {
 break;
 }
 }
 return streak;
}

/**
 * Consecutive days with a workout, counting back from today. A rest day today
 * doesn't break the streak until it's over.
 */
export function computeStreak(workouts: Workout[], today = new Date()): number {
 const days = new Set(workouts.map((w) => dayKey(w.date)));
 const cursor = new Date(today);
 cursor.setHours(0, 0, 0, 0);
 let streak = 0;
 for (let i = 0; i < 366; i++) {
 if (days.has(dayKey(cursor))) {
 streak++;
 } else if (i > 0) {
 break;
 }
 cursor.setDate(cursor.getDate() - 1);
 }
 return streak;
}

/** Workouts that belong to a routine (by id when recorded, else by name). */
export function workoutsForTemplate(template: WorkoutTemplate, workouts: Workout[]): Workout[] {
 return workouts.filter((w) => (w.templateId ? w.templateId === template.id : w.name === template.name));
}

export function latestWorkout(workouts: Workout[]): Workout | undefined {
 return workouts.reduce<Workout | undefined>(
 (latest, w) => (!latest || new Date(w.date) > new Date(latest.date) ? w : latest),
 undefined
 );
}

// --- Active session (in-progress workout) ----------------------------------

/**
 * Upper bound on time credited for a segment that was never committed —
 * i.e. the app was killed. A session left open for days reports a few
 * minutes, not several hours.
 */
export const MAX_UNCOMMITTED_MS = 5 * 60 * 1000;

/** Elapsed ms of a session, including the segment running right now. */
export function sessionElapsed(session: ActiveSession, now = Date.now()): number {
  const running = Math.min(Math.max(0, now - session.lastTickAt), MAX_UNCOMMITTED_MS);
  return session.activeMs + running;
}

/** Fold the running segment into `activeMs` and re-anchor at `now`. */
export function commitSessionTime(session: ActiveSession, now = Date.now()): ActiveSession {
  return { ...session, activeMs: sessionElapsed(session, now), lastTickAt: now };
}

/**
 * The routine's exercises with this session's logged numbers attached —
 * what gets written to history when the session ends.
 */
export function buildSessionExercises(
  template: WorkoutTemplate,
  logs: Record<string, SetPerformance>,
  completedIds: string[]
): Exercise[] {
  return expandTemplate(template).map((exercise) => {
    const log = logs[exercise.id];
    const done = completedIds.includes(exercise.id);
    // A timed hold with no typed numbers still counts as one completed set.
    if (!log && !(done && exercise.type === 'time')) return exercise;
    return {
      ...exercise,
      sets: [
        {
          id: `${exercise.id}-log`,
          reps: log?.reps ?? exercise.reps,
          weight: log?.weightKg ?? 0,
          completed: done,
        },
      ],
    };
  });
}

/**
 * The routine to suggest next: one never done yet, otherwise the one done
 * longest ago — a simple rotation through the user's plan.
 */
export function nextRoutine(templates: WorkoutTemplate[], workouts: Workout[]) {
 let best: { template: WorkoutTemplate; last?: Workout } | null = null;
 for (const template of templates) {
 const last = latestWorkout(workoutsForTemplate(template, workouts));
 if (!last) return { template, last: undefined };
 if (!best || (best.last && new Date(last.date) < new Date(best.last.date))) {
 best = { template, last };
 }
 }
 return best;
}
