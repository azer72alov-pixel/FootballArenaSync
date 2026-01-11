import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arenasync.sport',
  appName: 'ArenaSync',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;