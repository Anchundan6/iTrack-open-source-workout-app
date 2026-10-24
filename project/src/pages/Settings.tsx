import { useState } from 'react';
import { Languages, Play, Smartphone } from 'lucide-react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { NotificationSettingsModal, DAY_IDS } from '../components/NotificationSettingsModal';
import { Group, OptionRow, PageTitle, Row, Segmented, Sheet, Switch } from '../components/ui';
import { useI18n, resolveLang, systemLang, type LanguagePref } from '../i18n';
import { previewSound, type RestSound } from '../utils/sound';

const LANGUAGES: { value: LanguagePref; code: string; native: string }[] = [
  { value: 'en', code: 'EN', native: 'English' },
  { value: 'it', code: 'IT', native: 'Italiano' },
];

export function Settings() {
  const { t, weekdays } = useI18n();
  const {
    darkMode,
    toggleDarkMode,
    notificationSettings,
    updateNotificationSettings,
    language,
    setLanguage,
    weightUnit,
    setWeightUnit,
    restSound,
    setRestSound,
    restVibrate,
    setRestVibrate,
  } = useWorkoutStore();

  const [sheet, setSheet] = useState<null | 'language' | 'sound' | 'reminders'>(null);
  const close = () => setSheet(null);

  const languageLabel = (pref: LanguagePref) =>
    pref === 'system' ? t('settings.systemDefault') : LANGUAGES.find((l) => l.value === pref)?.native ?? pref;

  const shortDays = weekdays('short');
  const remindersSummary = notificationSettings.enabled
    ? `${DAY_IDS.filter((d) => notificationSettings.days.includes(d))
        .map((d) => shortDays[DAY_IDS.indexOf(d)].replace('.', ''))
        .join(', ')} · ${notificationSettings.time}`
    : t('settings.off');

  const soundLabel = (s: RestSound) => t(`sound.${s}`);

  return (
    <div>
      <PageTitle title={t('nav.settings')} />

      <Group label={t('settings.general')}>
        <Row label={t('settings.language')} value={languageLabel(language)} onClick={() => setSheet('language')} />
        <Row
          label={t('settings.units')}
          right={
            <Segmented
              label={t('settings.units')}
              value={weightUnit}
              onChange={setWeightUnit}
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
            />
          }
        />
        <Row label={t('settings.darkMode')} right={<Switch checked={darkMode} onChange={toggleDarkMode} label={t('settings.darkMode')} />} />
      </Group>

      <Group label={t('settings.workout')} footnote={t('settings.soundFootnote')}>
        <Row label={t('settings.reminders')} value={remindersSummary} onClick={() => setSheet('reminders')} />
        <Row label={t('settings.restSound')} value={soundLabel(restSound)} onClick={() => setSheet('sound')} />
        <Row label={t('settings.vibrate')} right={<Switch checked={restVibrate} onChange={setRestVibrate} label={t('settings.vibrate')} />} />
      </Group>

      <p className="mt-8 text-center text-[12px] text-gray-400 dark:text-gray-500">{t('settings.footer')}</p>

      {/* Language */}
      <Sheet open={sheet === 'language'} onClose={close} title={t('settings.language')} subtitle={t('settings.languageHint')}>
        <div className="mt-3 divide-y divide-gray-100 border-y border-gray-100 dark:divide-white/[0.06] dark:border-white/[0.06]">
          <OptionRow
            selected={language === 'system'}
            onSelect={() => setLanguage('system')}
            leading={<Smartphone className="h-5 w-5 text-gray-400" strokeWidth={1.75} />}
            label={t('settings.systemDefault')}
            description={t('settings.currently', { lang: languageLabel(systemLang()) })}
          />
          {LANGUAGES.map((l) => (
            <OptionRow
              key={l.value}
              selected={language === l.value}
              onSelect={() => setLanguage(l.value)}
              leading={
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-[10px] font-bold text-gray-500 dark:bg-white/[0.08] dark:text-gray-400">
                  {l.code}
                </span>
              }
              label={l.native}
              description={resolveLang(language) !== l.value ? t(`settings.lang.${l.value as 'en' | 'it'}`) : undefined}
            />
          ))}
        </div>
        <p className="mx-6 mt-3 flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-400">
          <Languages className="h-4 w-4 text-gray-400" strokeWidth={1.75} />
          {t('settings.helpTranslate')}
        </p>
      </Sheet>

      {/* Rest sound */}
      <Sheet open={sheet === 'sound'} onClose={close} title={t('settings.restSound')} subtitle={t('settings.soundFootnote')}>
        <div className="mt-3 divide-y divide-gray-100 border-y border-gray-100 dark:divide-white/[0.06] dark:border-white/[0.06]">
          {(['beep', 'chime', 'off'] as RestSound[]).map((s) => (
            <OptionRow
              key={s}
              selected={restSound === s}
              onSelect={() => {
                setRestSound(s);
                previewSound(s);
              }}
              label={soundLabel(s)}
              trailing={
                s !== 'off' ? (
                  <button
                    onClick={() => previewSound(s)}
                    aria-label={t('settings.preview', { sound: soundLabel(s) })}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-white/[0.08] dark:text-gray-200"
                  >
                    <Play className="h-3.5 w-3.5 translate-x-[1px] fill-current" />
                  </button>
                ) : undefined
              }
            />
          ))}
        </div>
      </Sheet>

      <NotificationSettingsModal isOpen={sheet === 'reminders'} onClose={close} onSave={updateNotificationSettings} currentSettings={notificationSettings} />
    </div>
  );
}
