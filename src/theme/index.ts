import { useColorScheme } from 'react-native';

import { usePrefs } from '@/lib/prefs';

/**
 * Occur's look: warm paper, black ink, soft gradient bubbles. One rounded,
 * very readable family (Nunito) everywhere — heavy weights for numbers and
 * headlines, regular weights for UI text — so it stays legible at a glance.
 */

const light = {
  scheme: 'light' as 'light' | 'dark',
  bg: '#F3EEE5',
  bgDeep: '#EAE3D7',
  surface: '#FBF8F2',
  surfaceAlt: '#ECE5D9',
  ink: '#18150F',
  inkSoft: '#4F493F',
  inkFaint: '#7A7266',
  line: 'rgba(24, 21, 15, 0.09)',
  lineStrong: 'rgba(24, 21, 15, 0.18)',
  /** the black pill */
  pill: '#18150F',
  pillInk: '#F7F2E9',
  good: '#2E8A58',
  bad: '#CF4F35',
  shadow: '#5A4A30',
  overlay: 'rgba(24, 21, 15, 0.35)',
};

const dark: typeof light = {
  scheme: 'dark',
  bg: '#13110E',
  bgDeep: '#0D0C0A',
  surface: '#1D1A16',
  surfaceAlt: '#29251F',
  ink: '#F5EFE4',
  inkSoft: '#C4BAAA',
  inkFaint: '#968D80',
  line: 'rgba(245, 239, 228, 0.09)',
  lineStrong: 'rgba(245, 239, 228, 0.2)',
  pill: '#F5EFE4',
  pillInk: '#16130F',
  good: '#5CC98C',
  bad: '#FF7E62',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export type Theme = typeof light;
export const themes = { light, dark };

/** Light/dark follows Settings → Appearance; "System" follows the phone. */
export function useTheme(): Theme {
  const pref = usePrefs((s) => s.theme);
  const system = useColorScheme();
  const scheme = pref === 'system' ? system : pref;
  return scheme === 'dark' ? dark : light;
}

export const font = {
  /** big numbers and headlines */
  display: 'Nunito_800ExtraBold',
  /** softer headline weight (prompts, secondary headings) */
  displaySoft: 'Nunito_700Bold',
  regular: 'Nunito_400Regular',
  medium: 'Nunito_600SemiBold',
  semibold: 'Nunito_700Bold',
  bold: 'Nunito_800ExtraBold',
  extrabold: 'Nunito_900Black',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };
