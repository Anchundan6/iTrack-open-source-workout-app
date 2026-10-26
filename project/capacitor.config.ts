import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fitnesslog.app',
  appName: 'Fitness Log',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    webContentsDebuggingEnabled: true,
  },
};

export default config;
