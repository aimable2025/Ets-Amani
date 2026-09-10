import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.amaniledger.app',
  appName: 'Ets Amani',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
