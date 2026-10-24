import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import type { Workout } from '../types/workout';
import { useI18n } from '../i18n';
import { useUnits } from '../utils/units';
import { baseName, groupBySet, workoutVolume } from '../utils/workout';

/**
 * Post-finish summary screen: duration, completion, volume and what was
 * actually logged per set. Shown after a session is saved.
 */
export function WorkoutSummary({
 workout,
 weekCount,
 onClose,
}: {
 workout: Workout;
 /** Sessions completed this week including this one. */
 weekCount: number;
 onClose: () => void;
}) {
 const { t, tp, clock } = useI18n();
 const { format } = useUnits();
 const groups = groupBySet(workout.exercises);
 const volume = workoutVolume(workout);
 const done = workout.completedExerciseIds?.length ?? 0;
 const total = workout.exercises.length;

 return createPortal(
 <div className="fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-gray-950">
 <div className="mx-auto flex min-h-full max-w-2xl flex-col px-5 pb-8 pt-safe">
 <div className="pt-10">
 <p className="cap">{t('summary.weekCount', { n: weekCount })}</p>
 <h1 className="mt-1 text-[40px] font-semibold leading-none tracking-[-.03em] text-gray-900 dark:text-white">
 {t('summary.title')}
 </h1>
 <p className="mt-2 text-[15px] text-gray-500 dark:text-gray-400">{workout.name}</p>
 </div>

 <div className="mt-6 divide-y divide-gray-100 border-y border-gray-100 dark:divide-white/[0.06] dark:border-white/[0.06]">
 <Row label={t('session.duration')} value={clock(workout.duration)} />
 <Row label={t('session.completion')} value={`${Math.round(workout.completionPercentage)}%`} />
 <Row label={t('session.exercisesLabel')} value={t('session.ofTotal', { done, total })} />
 {volume > 0 && <Row label={t('summary.volume')} value={format(volume, 0)} />}
 </div>

 <div className="mt-6 flex-1">
 {groups.map(({ set, items }) => (
 <section key={set} className="pt-4">
 <p className="cap">{t('session.set', { n: set })}</p>
 {items.map((e) => {
 const logged = e.sets?.[0];
 const isDone = workout.completedExerciseIds?.includes(e.id) ?? false;
 const actual =
 logged && isDone
 ? e.type === 'time'
 ? clock(logged.reps)
 : logged.weight > 0
 ? `${format(logged.weight)} × ${logged.reps}`
 : tp('session.reps', logged.reps)
 : '';
 return (
 <div key={e.id} className="flex items-center gap-3 border-b border-gray-100 py-3 dark:border-white/[0.06]">
 <span
 className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
 isDone ? 'bg-accent text-accent-contrast' : 'border-[1.5px] border-gray-300 dark:border-white/20'
 }`}
 >
 {isDone && <Check className="h-3 w-3" strokeWidth={3} />}
 </span>
 <span
 className={`min-w-0 flex-1 truncate text-[15px] ${
 isDone ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
 }`}
 >
 {baseName(e)}
 </span>
 <span className="flex-shrink-0 text-[13px] tabular-nums text-gray-500 dark:text-gray-400">
 {isDone ? actual : t('history.skipped')}
 </span>
 </div>
 );
 })}
 </section>
 ))}
 </div>

 <button onClick={onClose} className="pill-primary mt-8 h-14 w-full text-[17px]">
 {t('summary.done')}
 </button>
 </div>
 </div>,
 document.body
 );
}

function Row({ label, value }: { label: string; value: string }) {
 return (
 <div className="flex justify-between py-3">
 <span className="text-[15px] text-gray-500 dark:text-gray-400">{label}</span>
 <span className="text-[15px] font-semibold tabular-nums text-gray-900 dark:text-white">{value}</span>
 </div>
 );
}
