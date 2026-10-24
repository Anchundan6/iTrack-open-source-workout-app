export interface Exercise {
 id: string;
 name: string;
 sets: Set[];
 reps: number;
 type: 'reps' | 'time';
 videoUrl?: string;
 targetMuscles: string[];
 description?: string;
 /** Which round of the routine this copy belongs to (1-based). Older workouts
 * encode it in the id (`<id>-set-N`) and name (`Name (Set N)`) instead. */
 setNumber?: number;
}

export interface Set {
 id: string;
 reps: number;
 weight: number;
 completed: boolean;
}

export interface Workout {
 id: string;
 name: string;
 exercises: Exercise[];
 date: string;
 duration: number;
 completionPercentage: number;
 completed: boolean;
 /** Ids of the exercises ticked off during the session. Missing on workouts
 * logged before per-exercise tracking existed. */
 completedExerciseIds?: string[];
 /** The routine this session was started from, when known. */
 templateId?: string;
}

export interface WorkoutTemplate {
 id: string;
 name: string;
 exercises: Omit<Exercise, 'sets'>[];
 numberOfSets: number; // New field to store the number of sets
}

// --- Exercise library -------------------------------------------------------

/** Equipment needed; drives the library's filter chips. */
export type Equipment = 'barbell' | 'dumbbell' | 'kettlebell' | 'machine' | 'cable' | 'bodyweight' | 'band' | 'other';

/** Broad body-part bucket used for filtering and grouping. */
export type ExerciseCategory = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'fullBody' | 'cardio';

/**
 * One entry of the offline exercise library. Content stays in English (the
 * library is not translated); only the surrounding UI is localized.
 */
export interface ExerciseDef {
  /** Stable kebab-case id, referenced by `substitutions`. */
  id: string;
  name: string;
  /** Alternative English names people search for ("pullups", "ohp"). */
  aliases?: string[];
  equipment: Equipment;
  category: ExerciseCategory;
  /** Canonical muscle names, matching `ALL_MUSCLES`. */
  primary: string[];
  secondary?: string[];
  /** Trains one side at a time. */
  unilateral?: boolean;
  /** How the set is recorded by default. */
  type: 'reps' | 'time';
  /** Suggested reps, or seconds when `type` is 'time'. */
  defaultReps: number;
  /** Short English how-to, 3 steps. */
  steps: string[];
  /** Form cues shown under the name. */
  tips?: string[];
  /** Ids of exercises that can stand in for this one. */
  substitutions?: string[];
}

/** Actual numbers logged for one expanded exercise instance (one set). */
export interface SetPerformance {
  /** Stored in kg regardless of display unit. */
  weightKg?: number;
  reps?: number;
}

/**
 * A workout in progress. Kept in the persisted store so a refresh, a lock
 * screen or a killed process never loses the session. Elapsed time is
 * `activeMs` plus the segment running since `lastTickAt`, which lets a
 * backgrounded or dead session avoid silently banking hours.
 */
export interface ActiveSession {
  templateId: string;
  /** Snapshot of the routine at start time — later edits can't break a session. */
  template: WorkoutTemplate;
  /** Epoch ms when the session started. */
  startedAt: number;
  /** Elapsed time already committed, in ms. */
  activeMs: number;
  /** Anchor of the running segment: elapsed = activeMs + (now − lastTickAt). */
  lastTickAt: number;
  completedIds: string[];
  logs: Record<string, SetPerformance>;
  /** Expanded exercise id currently on screen. */
  currentId?: string;
}

/**
 * A Notion-style bookmark attached to a routine: either a video/link card
 * or a plain text note (e.g. "watch minute 5:17 for form").
 */
export interface RoutineBookmark {
 id: string;
 type: 'video' | 'note';
 /** For 'video': the URL. For 'note': the note text. */
 content: string;
 /** Link metadata fetched best-effort when the bookmark is added. */
 title?: string;
 author?: string;
 createdAt: string;
}

