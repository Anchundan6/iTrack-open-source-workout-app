import type { ExerciseDef } from '../types/workout';
import { LEGS_EXERCISES } from './exercises.legs';
import { PULL_EXERCISES } from './exercises.pull';
import { PUSH_EXERCISES } from './exercises.push';

/**
 * The offline exercise library: bundled with the app, no network needed.
 * Content is English-only (see IMPLEMENTATION_PLAN §3); the UI around it is
 * localized. Validated for structure by `npm test`.
 */
export const EXERCISES: ExerciseDef[] = [...PUSH_EXERCISES, ...PULL_EXERCISES, ...LEGS_EXERCISES];
