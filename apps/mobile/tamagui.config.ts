import { defaultConfig } from '@tamagui/config/v4';
import { createTamagui } from 'tamagui';

export const config = createTamagui({
  ...defaultConfig,
  settings: { ...defaultConfig.settings, styleCompat: 'react-native', onlyAllowShorthands: false },
});
type AppConfig = typeof config;
declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
export default config;
