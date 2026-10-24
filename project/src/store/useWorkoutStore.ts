import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Workout, WorkoutTemplate, RoutineBookmark, ActiveSession, SetPerformance } from '../types/workout';
import type { LanguagePref } from '../i18n';
import type { WeightUnit } from '../utils/units';
import type { RestSound } from '../utils/sound';
import { commitSessionTime } from '../utils/workout';

export interface NotificationSettings {
 enabled: boolean;
 days: string[];
 time: string;
}

interface WorkoutStore {
  workouts: Workout[];
  templates: WorkoutTemplate[];
  /** The workout currently in progress; survives refresh / lock / kill. */
  session: ActiveSession | null;
  /** Whether the session UI is on screen (not persisted — a restored
   * session always starts behind a resume prompt). */
  sessionOpen: boolean;
  darkMode: boolean;
 notificationSettings: NotificationSettings;
 /** Notes & video bookmarks per routine, keyed by template id. */
 routineBookmarks: Record<string, RoutineBookmark[]>;
 // --- Preferences ---
 /** UI language; 'system' follows the device. */
 language: LanguagePref;
 /** Display unit for every weight. Data is always stored in kg. */
 weightUnit: WeightUnit;
 /** Sound played by the rest timer (bundled, works offline). */
 restSound: RestSound;
 /** Vibrate when a rest period ends. */
 restVibrate: boolean;
 /** Weekly check-in goal (sessions per week). */
 weeklyGoal: number;
 addWorkout: (workout: Workout) => void;
 updateWorkout: (workout: Workout) => void;
 deleteWorkout: (id: string) => void;
  toggleDarkMode: () => void;
 addTemplate: (template: WorkoutTemplate) => void;
 updateTemplate: (template: WorkoutTemplate) => void;
 deleteTemplate: (id: string) => void;
 updateNotificationSettings: (settings: NotificationSettings) => void;
 addRoutineBookmark: (templateId: string, bookmark: RoutineBookmark) => void;
 deleteRoutineBookmark: (templateId: string, bookmarkId: string) => void;
 setLanguage: (language: LanguagePref) => void;
 setWeightUnit: (unit: WeightUnit) => void;
 setRestSound: (sound: RestSound) => void;
 setRestVibrate: (vibrate: boolean) => void;
  setWeeklyGoal: (goal: number) => void;
  /** Begin a session from a routine; a running one is replaced. */
  startSession: (template: WorkoutTemplate) => void;
  /** Merge a partial update into the running session (no-op when none). */
  patchSession: (patch: Partial<ActiveSession>) => void;
  /** Store the weight/reps logged for one expanded exercise id. */
  logSet: (exerciseId: string, perf: SetPerformance) => void;
  /** Tick a set on or off. */
  toggleSet: (exerciseId: string) => void;
  /** Bank the time elapsed so far into `activeMs`. */
  commitSessionTime: () => void;
  /** Show the session UI again after a resume prompt. */
  openSession: () => void;
  /** Drop the session without saving anything. */
  discardSession: () => void;
  /** Close and clear the session (after it has been saved). */
  endSession: () => void;
}

export const useWorkoutStore = create<WorkoutStore>()(
 persist(
 (set) => ({
  workouts: [],
  templates: [],
  session: null,
  sessionOpen: false,
  darkMode: false,
 notificationSettings: {
 enabled: true,
 days: ['monday', 'wednesday', 'friday'],
 time: '18:00'
 },
 routineBookmarks: {},
 language: 'system',
 weightUnit: 'kg',
 restSound: 'beep',
 restVibrate: true,
 weeklyGoal: 3,
 addWorkout: (workout) =>
 set((state) => ({ workouts: [...state.workouts, workout] })),
 updateWorkout: (workout) =>
 set((state) => ({
 workouts: state.workouts.map((w) => (w.id === workout.id ? workout : w)),
 })),
 deleteWorkout: (id) =>
 set((state) => ({
 workouts: state.workouts.filter((w) => w.id !== id),
 })),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
 addTemplate: (template) =>
 set((state) => ({
 templates: [...state.templates, {
 ...template,
 numberOfSets: template.numberOfSets || 1 // Default to 1 if not provided
 }],
 })),
 updateTemplate: (template) =>
 set((state) => ({
 templates: state.templates.map((t) =>
 t.id === template.id ? {
 ...template,
 numberOfSets: template.numberOfSets || 1 // Default to 1 if not provided
 } : t
 ),
 })),
 deleteTemplate: (id) =>
 set((state) => {
 // Bookmarks belong to the routine — drop them with it.
 const routineBookmarks = { ...state.routineBookmarks };
 delete routineBookmarks[id];
 return {
 templates: state.templates.filter((t) => t.id !== id),
 routineBookmarks,
 };
 }),
 updateNotificationSettings: (settings) =>
 set({ notificationSettings: settings }),
 addRoutineBookmark: (templateId, bookmark) =>
 set((state) => ({
 routineBookmarks: {
 ...state.routineBookmarks,
 [templateId]: [...(state.routineBookmarks[templateId] ?? []), bookmark],
 },
 })),
 deleteRoutineBookmark: (templateId, bookmarkId) =>
 set((state) => ({
 routineBookmarks: {
 ...state.routineBookmarks,
 [templateId]: (state.routineBookmarks[templateId] ?? []).filter(
 (b) => b.id !== bookmarkId
 ),
 },
 })),
 setLanguage: (language) => set({ language }),
 setWeightUnit: (weightUnit) => set({ weightUnit }),
 setRestSound: (restSound) => set({ restSound }),
 setRestVibrate: (restVibrate) => set({ restVibrate }),
  setWeeklyGoal: (weeklyGoal) => set({ weeklyGoal: Math.max(1, Math.min(14, Math.round(weeklyGoal))) }),
  startSession: (template) =>
    set({
      session: {
        templateId: template.id,
        // Snapshot: editing or deleting the routine mid-session can't break it.
        template,
        startedAt: Date.now(),
        activeMs: 0,
        lastTickAt: Date.now(),
        completedIds: [],
        logs: {},
      },
      sessionOpen: true,
    }),
  patchSession: (patch) =>
    set((state) => (state.session ? { session: { ...state.session, ...patch } } : state)),
  logSet: (exerciseId, perf) =>
    set((state) =>
      state.session
        ? { session: { ...state.session, logs: { ...state.session.logs, [exerciseId]: perf } } }
        : state
    ),
  toggleSet: (exerciseId) =>
    set((state) => {
      if (!state.session) return state;
      const done = state.session.completedIds.includes(exerciseId);
      return {
        session: {
          ...state.session,
          completedIds: done
            ? state.session.completedIds.filter((id) => id !== exerciseId)
            : [...state.session.completedIds, exerciseId],
        },
      };
    }),
  commitSessionTime: () =>
    set((state) => (state.session ? { session: commitSessionTime(state.session) } : state)),
  openSession: () => set({ sessionOpen: true }),
  discardSession: () => set({ session: null, sessionOpen: false }),
  endSession: () => set({ session: null, sessionOpen: false }),
  }),
 {
    name: 'workout-storage',
    version: 6,
    migrate: (persisted) => {
      const state = (persisted ?? {}) as Record<string, unknown>;
      // v4: AI coach, cloud sync, body-weight log and user profile were
      // removed from the product. Strip those persisted fields; everything
      // else (workouts, templates, bookmarks, preferences) carries over.
      delete state.aiCoach;
      delete state.equipment;
      delete state.exerciseWeights;
      delete state.aiOnboarded;
      delete state.userProfile;
      delete state.weightLog;
      delete state.autoBackup;
      // v5: weekly check-in goal, default 3 sessions/week.
      if (typeof state.weeklyGoal !== 'number') state.weeklyGoal = 3;
      // v6: in-progress sessions moved from component state into the store
      // (survives refresh / lock / kill). The old flags are gone.
      delete state.activeWorkout;
      delete state.isWorkoutActive;
      if (!('session' in state)) state.session = null;
      return state as unknown as WorkoutStore;
    },
    // `sessionOpen` is pure UI state: a restored session must never reopen
    // itself without the user asking for it.
    partialize: (state) => ({ ...state, sessionOpen: false }),
  }
 )
);
