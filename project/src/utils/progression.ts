import type { SetPerformance } from '../types/workout';

/**
 * Progressive overload as a pure function: history in, suggestion out.
 *
 * The engine never writes anything — it reads the last logged sets and
 * returns what to try next. The suggestion is shown to the user, who accepts
 * it or types something else. History is never rewritten.
 */

/** What the engine asks for: the four branches. */
export type ProgressionAction =
  | 'baseline' // nothing logged yet — just aim for the target
  | 'addReps' // same weight, one more rep
  | 'addWeight' // target reached — load up, drop back down in reps
  | 'hold'; // repeat: the last two attempts didn't improve

/** Why, in one word — drives the wording shown next to the numbers. */
export type ProgressionReason =
  | 'noHistory'
  | 'missedTarget'
  | 'hitTarget'
  | 'stalled'
  | 'bodyweight';

export interface ProgressionInput {
  /** Most recent logged set for this exercise + set number. */
  last?: SetPerformance;
  /** The attempt before `last`, when there is one — used to spot a stall. */
  previous?: SetPerformance;
  /** Reps to hit before adding weight (top of the rep range). */
  targetReps: number;
  /** Smallest weight jump available, in kg. */
  incrementKg?: number;
}

export interface ProgressionSuggestion {
  action: ProgressionAction;
  reason: ProgressionReason;
  /** Undefined for unloaded work (bodyweight, or no weight typed). */
  weightKg?: number;
  reps: number;
  /** False when the suggestion repeats the last set exactly. */
  changed: boolean;
}

/** Default jump: the smallest plate most gyms have. */
export const DEFAULT_INCREMENT_KG = 2.5;
/** 5 lb, converted once — the same idea for lb users (2.268 kg exactly). */
export const LB_INCREMENT_KG = 2.268;
/** How far reps drop back after a weight increase. */
const REP_RANGE_SPAN = 2;

/** Bottom of the rep range: hitting `target` means you can go up in weight. */
export function repRangeBottom(targetReps: number): number {
  return Math.max(1, Math.round(targetReps) - REP_RANGE_SPAN);
}

/**
 * The next weight to load: `current + increment`, snapped to plate boundaries
 * only when the bar was already loaded on them. A 61 kg bar goes to 63.5, not
 * to 62.5 or 60 — the jump is always an increase.
 */
export function nextWeight(currentKg: number, incrementKg = DEFAULT_INCREMENT_KG): number {
  const inc = incrementKg > 0 ? incrementKg : DEFAULT_INCREMENT_KG;
  const raw = currentKg + inc;
  const snapped = Math.round(raw / inc) * inc;
  const value = Math.abs(raw - snapped) <= inc * 0.2 ? snapped : raw;
  return Math.round(value * 100) / 100;
}

export function suggestProgression({
  last,
  previous,
  targetReps,
  incrementKg,
}: ProgressionInput): ProgressionSuggestion {
  const target = Math.max(1, Math.round(targetReps || 1));
  const bottom = repRangeBottom(target);
  const inc = incrementKg && incrementKg > 0 ? incrementKg : DEFAULT_INCREMENT_KG;

  const lastReps = last?.reps != null && last.reps > 0 ? Math.round(last.reps) : undefined;
  const lastWeight = last?.weightKg != null && last.weightKg > 0 ? last.weightKg : undefined;

  // 1. No history — there is nothing to build on.
  if (lastReps === undefined) {
    return { action: 'baseline', reason: 'noHistory', weightKg: lastWeight, reps: target, changed: false };
  }

  const prevReps = previous?.reps != null && previous.reps > 0 ? Math.round(previous.reps) : undefined;
  const prevWeight = previous?.weightKg != null && previous.weightKg > 0 ? previous.weightKg : undefined;

  // 2. Stalled: the last attempt was lighter than the one before (weight went
  // back down), or the same weight with no extra reps. Repeat before piling on.
  const stalled =
    previous !== undefined &&
    ((prevWeight !== undefined && lastWeight !== undefined && prevWeight > lastWeight) ||
      (prevWeight === lastWeight && (prevReps ?? 0) >= lastReps));
  if (stalled) {
    const reps = lastReps >= target ? target : Math.min(target, lastReps + 1);
    return {
      action: 'hold',
      reason: 'stalled',
      weightKg: lastWeight,
      reps,
      changed: reps !== lastReps,
    };
  }

  // 3. No load logged — bodyweight work: reps are the only lever.
  if (lastWeight === undefined) {
    const reps = lastReps < target ? Math.min(target, lastReps + 1) : lastReps + 1;
    return { action: 'addReps', reason: 'bodyweight', reps, changed: reps !== lastReps };
  }

  // 4. Short of the target — same weight, one more rep.
  if (lastReps < target) {
    const reps = Math.min(target, lastReps + 1);
    return {
      action: 'addReps',
      reason: 'missedTarget',
      weightKg: lastWeight,
      reps,
      changed: true,
    };
  }

  // 5. Target reached — add weight and start the range again from the bottom.
  return {
    action: 'addWeight',
    reason: 'hitTarget',
    weightKg: nextWeight(lastWeight, inc),
    reps: bottom,
    changed: true,
  };
}
