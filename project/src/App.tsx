import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { SessionHost } from './components/SessionHost';
import { Home } from './pages/Home';
import { Workouts } from './pages/Workouts';
import { Progress } from './pages/Progress';
import { Settings } from './pages/Settings';
import { requestWakeLock, releaseWakeLock } from './utils/wakeLock';
import { notificationManager } from './utils/notificationManager';
import { useWorkoutStore } from './store/useWorkoutStore';
import { useI18n } from './i18n';
import { unlockAudio } from './utils/sound';

function App() {
 const { notificationSettings, darkMode } = useWorkoutStore();
 const { lang } = useI18n();

 useEffect(() => {
 document.documentElement.lang = lang;
 }, [lang]);

 // Audio starts suspended until a user gesture; unlock it on the first tap so
 // the rest-timer beep can play later on its own.
 useEffect(() => {
 const unlock = () => unlockAudio();
 window.addEventListener('pointerdown', unlock, { once: true });
 return () => window.removeEventListener('pointerdown', unlock);
 }, []);

 useEffect(() => {
 if (darkMode) {
 document.documentElement.classList.add('dark');
 } else {
 document.documentElement.classList.remove('dark');
 }
 }, [darkMode]);

 useEffect(() => {
 // Request wake lock when app starts
 requestWakeLock();

 // Initialize notifications
 notificationManager.init();

 // Release wake lock when app is unmounted
 return () => {
 releaseWakeLock();
 };
 }, []);

 // Re-schedule notifications when settings (or their language) change
 useEffect(() => {
 notificationManager.schedule(notificationSettings);
 }, [notificationSettings, lang]);

 return (
 <BrowserRouter future={{ 
 v7_startTransition: true,
 v7_relativeSplatPath: true 
 }}>
 <Toaster
 position="top-center"
 toastOptions={{
 style: {
 borderRadius: '999px',
 background: darkMode ? '#f9fafb' : '#111827',
 color: darkMode ? '#111827' : '#f9fafb',
 fontSize: '14px',
 },
 }}
 />
 <Routes>
 <Route path="/" element={<Layout />}>
 <Route index element={<Home />} />
 <Route path="workouts" element={<Workouts />} />
 <Route path="progress" element={<Progress />} />
 <Route path="settings" element={<Settings />} />
 </Route>
 </Routes>
      {/* In-progress session lives above the tabs: it survives navigation,
          reloads and a killed process. */}
      <SessionHost />
 </BrowserRouter>
 );
}

export default App;