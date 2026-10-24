import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Plus, Search, X } from 'lucide-react';
import { FullScreen } from './ui';
import { useI18n } from '../i18n';
import { EXERCISES } from '../data/exercises';
import { CATEGORIES, EQUIPMENT, exerciseById, searchExercises } from '../utils/library';
import { MUSCLE_GROUPS } from '../utils/muscles';
import type { ExerciseCategory, ExerciseDef, Equipment } from '../types/workout';

/** Muscle-group ids come straight from `MUSCLE_GROUPS`. */
type MuscleGroupId = (typeof MUSCLE_GROUPS)[number]['id'];

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  /** A library exercise was chosen. */
  onPick: (def: ExerciseDef) => void;
  /** The search text should become a custom exercise. */
  onCustom: (name: string) => void;
}

/**
 * Browse the offline library: search by name or alias, filter by equipment,
 * body part or muscle group, read the how-to, then add it to the routine.
 * Falls back to a custom exercise when nothing matches.
 */
export function ExercisePicker({ open, onClose, onPick, onCustom }: ExercisePickerProps) {
  const { t, tp, muscle } = useI18n();
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all');
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all');
  const [group, setGroup] = useState<MuscleGroupId | 'all'>('all');
  const [selected, setSelected] = useState<ExerciseDef | null>(null);

  const muscles = group === 'all' ? undefined : MUSCLE_GROUPS.find((g) => g.id === group)?.muscles;
  const results = useMemo(() => searchExercises(EXERCISES, { query, equipment, category, muscles }), [query, equipment, category, muscles]);

  const close = () => {
    setQuery('');
    setEquipment('all');
    setCategory('all');
    setGroup('all');
    setSelected(null);
    onClose();
  };

  const pick = (def: ExerciseDef) => {
    setSelected(null);
    setQuery('');
    onPick(def);
  };

  const custom = () => {
    const name = query.trim();
    if (!name) return;
    setQuery('');
    onCustom(name);
  };

  const filtered = equipment !== 'all' || category !== 'all' || group !== 'all' || query.trim().length > 0;

  return (
    <FullScreen
      open={open}
      onClose={close}
      z="z-[70]"
      header={
        <div className="bg-white px-4 pb-2 pt-safe dark:bg-gray-950">
          <div className="flex h-14 items-center gap-2">
            {selected ? (
              <button onClick={() => setSelected(null)} aria-label={t('common.back')} className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]">
                <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
              </button>
            ) : (
              <button onClick={close} aria-label={t('common.close')} className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]">
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            )}
            <p className="flex-1 truncate text-center text-[17px] font-semibold text-gray-900 dark:text-white">
              {selected ? selected.name : t('library.title')}
            </p>
            <span className="w-10" />
          </div>

          {!selected && (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-white/10">
                <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('library.search')}
                  aria-label={t('library.search')}
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-white"
                />
                {query && (
                  <button onClick={() => setQuery('')} aria-label={t('common.cancel')} className="text-gray-400">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-2 text-[12px] tabular-nums text-gray-400 dark:text-gray-500">{tp('library.count', results.length)}</p>
            </>
          )}
        </div>
      }
    >
      {selected ? (
        <Detail def={selected} onPick={() => pick(selected)} onOpenSub={(id) => {
            const sub = exerciseById(EXERCISES, id);
            if (sub) setSelected(sub);
          }} />
      ) : (
        <div className="px-4 pb-10">
          <Chips
            options={['all', ...CATEGORIES]}
            value={category}
            onChange={setCategory}
            label={(v) => (v === 'all' ? t('library.all') : t(`library.category.${v}`))}
          />
          <Chips
            options={['all', ...EQUIPMENT]}
            value={equipment}
            onChange={setEquipment}
            label={(v) => (v === 'all' ? t('library.all') : t(`library.equipment.${v}`))}
          />
          <Chips<MuscleGroupId | 'all'>
            options={['all', ...MUSCLE_GROUPS.map((g) => g.id)]}
            value={group}
            onChange={setGroup}
            label={(v) => (v === 'all' ? t('library.all') : t(`muscleGroups.${v}`))}
          />

          <div className="mt-3 overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-900">
            {results.map((def) => (
              <button
                key={def.id}
                onClick={() => setSelected(def)}
                className="flex w-full items-center justify-between gap-3 border-b border-gray-200/70 px-4 py-3 text-left last:border-b-0 dark:border-white/[0.06]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium text-gray-900 dark:text-white">{def.name}</span>
                  <span className="mt-0.5 block truncate text-[12px] text-gray-500 dark:text-gray-400">
                    {t(`library.equipment.${def.equipment}`)} · {def.primary.map(muscle).join(' · ')}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600" />
              </button>
            ))}
            {results.length === 0 && (
              <p className="px-4 py-8 text-center text-[14px] text-gray-500 dark:text-gray-400">{t('library.noMatch')}</p>
            )}
          </div>

          {filtered && query.trim() && (
            <button onClick={custom} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 py-3.5 text-[15px] font-medium text-gray-900 dark:border-white/20 dark:text-white">
              <Plus className="h-4 w-4" strokeWidth={2} />
              {t('library.useCustom', { name: query.trim() })}
            </button>
          )}
        </div>
      )}
    </FullScreen>
  );
}

/** One exercise: how to do it, what it works, what to use instead. */
function Detail({ def, onPick, onOpenSub }: { def: ExerciseDef; onPick: () => void; onOpenSub: (id: string) => void }) {
  const { t, tp, clock, muscle } = useI18n();
  const subs = (def.substitutions ?? []).map((id) => exerciseById(EXERCISES, id)).filter((d): d is ExerciseDef => !!d);
  return (
    <div className="px-4 pb-10">
      <p className="text-[13px] text-gray-500 dark:text-gray-400">
        {t(`library.equipment.${def.equipment}`)} · {t(`library.category.${def.category}`)}
        {def.unilateral ? ` · ${t('library.unilateral')}` : ''}
      </p>

      <div className="mt-3 rounded-2xl bg-gray-50 p-4 dark:bg-gray-900">
        <p className="cap">{t('library.target')}</p>
        <p className="mt-1 text-[14px] font-medium text-gray-900 dark:text-white">{def.primary.map(muscle).join(' · ')}</p>
        {def.secondary?.length ? (
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
            {t('library.secondary')}: {def.secondary.map(muscle).join(' · ')}
          </p>
        ) : null}
        <p className="mt-2 text-[13px] tabular-nums text-gray-500 dark:text-gray-400">
          {def.type === 'time' ? t('library.defaultTime', { time: clock(def.defaultReps) }) : tp('library.defaultReps', def.defaultReps)}
        </p>
      </div>

      <div className="mt-4">
        <p className="cap">{t('library.steps')}</p>
        <ol className="mt-2 space-y-2">
          {def.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-[14px] text-gray-800 dark:text-gray-200">
              <span className="w-4 flex-shrink-0 tabular-nums text-gray-400">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {def.tips?.length ? (
        <div className="mt-4">
          <p className="cap">{t('library.tips')}</p>
          <ul className="mt-2 space-y-1.5">
            {def.tips.map((tip, i) => (
              <li key={i} className="text-[14px] text-gray-600 dark:text-gray-300">· {tip}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {subs.length ? (
        <div className="mt-4">
          <p className="cap">{t('library.substitutes')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {subs.map((sub) => (
              <button
                key={sub.id}
                onClick={() => onOpenSub(sub.id)}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-[13px] text-gray-700 active:bg-gray-100 dark:border-white/10 dark:text-gray-200"
              >
                {sub.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <button onClick={onPick} className="pill-primary mt-6 w-full py-3.5 text-[16px]">
        <Plus className="h-4 w-4" strokeWidth={2} />
        {t('library.add')}
      </button>
    </div>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: T[];
  value: T;
  onChange: (value: T) => void;
  label: (value: T) => string;
}) {
  return (
    <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
            value === option
              ? 'border-accent bg-accent text-accent-contrast'
              : 'border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300'
          }`}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}
