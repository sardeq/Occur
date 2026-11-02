import { useColorScheme, type TextStyle } from 'react-native';

import { useLang } from '@/lib/i18n';
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

/**
 * Arabic: Nunito has no Arabic glyphs, so Arabic UI uses Rubik — similarly
 * soft and rounded. Rubik runs a touch heavier, so each slot steps down a weight.
 */
export const fontAr: typeof font = {
  display: 'Rubik_700Bold',
  displaySoft: 'Rubik_600SemiBold',
  regular: 'Rubik_400Regular',
  medium: 'Rubik_500Medium',
  semibold: 'Rubik_600SemiBold',
  bold: 'Rubik_700Bold',
  extrabold: 'Rubik_800ExtraBold',
};

const toArabic: Record<string, string> = Object.fromEntries(
  (Object.keys(font) as (keyof typeof font)[]).map((k) => [font[k], fontAr[k]]),
);

/** The font set for the current language (for TextInput and other non-`Text` text). */
export function useFont(): typeof font {
  return useLang() === 'ar' ? fontAr : font;
}

/**
 * Adapts a flattened text style for Arabic: swaps the family, drops Latin-only
 * tweaks (letter spacing, upper-casing) and gives the taller script a little
 * more line height.
 */
export function arabicTextStyle<T extends TextStyle>(s: T): T {
  return {
    ...s,
    fontFamily: s.fontFamily ? (toArabic[s.fontFamily] ?? s.fontFamily) : fontAr.regular,
    letterSpacing: 0,
    textTransform: 'none',
    lineHeight: s.lineHeight ? Math.round(s.lineHeight * 1.1) : undefined,
  };
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };
