import { useState } from 'react';
import { Play, Trash2 } from 'lucide-react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { ActiveWorkout, type WorkoutResult } from './ActiveWorkout';
import { WorkoutSummary } from './WorkoutSummary';
import { Dialog } from './ui';
import { useI18n } from '../i18n';
import type { Workout } from '../types/workout';
import { completionFrom, expandTemplate, sessionElapsed, startOfWeek } from '../utils/workout';

/**
 * Owns the in-progress session for the whole app: the resume prompt after a
 * reload or kill, the workout overlay itself, and the summary once it ends.
 * Rendered once at the root so navigating between tabs can't drop a session.
 */
export function SessionHost() {
  const { t, clock } = useI18n();
  const session = useWorkoutStore((s) => s.session);
  const sessionOpen = useWorkoutStore((s) => s.sessionOpen);
  const workouts = useWorkoutStore((s) => s.workouts);
  const addWorkout = useWorkoutStore((s) => s.addWorkout);
  const openSession = useWorkoutStore((s) => s.openSession);
  const discardSession = useWorkoutStore((s) => s.discardSession);
  const endSession = useWorkoutStore((s) => s.endSession);

  const [summary, setSummary] = useState<{ workout: Workout; weekCount: number } | null>(null);

  const finish = (result: WorkoutResult) => {
    // A session where nothing was ticked off isn't worth logging.
    if (session && result.completionPercentage > 0) {
      const workout: Workout = {
        id: crypto.randomUUID(),
        name: session.template.name,
        templateId: session.templateId,
        exercises: result.exercises,
        date: result.startedAt,
        duration: result.duration,
        completionPercentage: result.completionPercentage,
        completed: true,
        completedExerciseIds: result.completedExerciseIds,
      };
      const monday = startOfWeek(new Date());
      const weekCount = workouts.filter((w) => new Date(w.date) >= monday).length + 1;
      addWorkout(workout);
      setSummary({ workout, weekCount });
    }
    endSession();
  };

  const closeSummary = () => setSummary(null);

  if (!session) return summary ? <WorkoutSummary workout={summary.workout} weekCount={summary.weekCount} onClose={closeSummary} /> : null;

  // Recovered from storage (refresh / lock screen / killed process): the
  // session never reopens by itself — it waits behind this prompt.
  if (!sessionOpen) {
    const total = expandTemplate(session.template).length;
    const done = session.completedIds.length;
    const elapsed = Math.floor(sessionElapsed(session) / 1000);
    return (
      <Dialog
        open
        onClose={openSession}
        title={t('session.resumeTitle')}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <button onClick={discardSession} className="pill-secondary py-2.5">
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              {t('session.discard')}
            </button>
            <button onClick={openSession} className="pill-primary py-2.5">
              <Play className="h-4 w-4 fill-current" />
              {t('session.resumeConfirm')}
            </button>
          </div>
        }
      >
        <p>
          {t('session.resumeBody', {
            name: session.template.name,
            done,
            total,
            pct: Math.round(completionFrom(done, total)),
            time: clock(elapsed),
          })}
        </p>
        <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">{t('session.resumeNote')}</p>
      </Dialog>
    );
  }

  return (
    <>
      <ActiveWorkout session={session} onFinish={finish} />
      {summary && <WorkoutSummary workout={summary.workout} weekCount={summary.weekCount} onClose={closeSummary} />}
    </>
  );
}
