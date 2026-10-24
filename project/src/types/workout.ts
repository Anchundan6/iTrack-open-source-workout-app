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

