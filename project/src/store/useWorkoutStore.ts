import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Workout, WorkoutTemplate, RoutineBookmark } from '../types/workout';
import type { LanguagePref } from '../i18n';
import type { WeightUnit } from '../utils/units';
import type { RestSound } from '../utils/sound';

export interface NotificationSettings {
  enabled: boolean;
  days: string[];
  time: string;
}

interface WorkoutStore {
  workouts: Workout[];
  templates: WorkoutTemplate[];
  activeWorkout: Workout | null;
  isWorkoutActive: boolean;
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
  addWorkout: (workout: Workout) => void;
  updateWorkout: (workout: Workout) => void;
  deleteWorkout: (id: string) => void;
  setActiveWorkout: (workout: Workout | null) => void;
  setIsWorkoutActive: (active: boolean) => void;
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
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set) => ({
      workouts: [],
      templates: [],
      activeWorkout: null,
      isWorkoutActive: false,
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
      setActiveWorkout: (workout) => set({ activeWorkout: workout }),
      setIsWorkoutActive: (active) => set({ isWorkoutActive: active }),
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
    }),
    {
      name: 'workout-storage',
      version: 4,
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
        return state as unknown as WorkoutStore;
      },
    }
  )
);
