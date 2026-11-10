import { useColorScheme, type TextStyle } from 'react-native';

import { useLang } from '@/lib/i18n';
import { usePrefs } from '@/lib/prefs';

/**
 * Occur's look: a cool, quiet neutral base with one indigo accent, so the
 * colourful bubbles are the only loud thing on screen. One rounded, very
 * readable family (Nunito) everywhere — heavy weights for numbers and
 * headlines, regular weights for UI text — so it stays legible at a glance.
 */

const light = {
  scheme: 'light' as 'light' | 'dark',
  bg: '#F4F5F9',
  bgDeep: '#E9EBF2',
  surface: '#FFFFFF',
  surfaceAlt: '#EBEDF3',
  ink: '#141726',
  inkSoft: '#4B5064',
  inkFaint: '#7D8397',
  line: 'rgba(20, 23, 38, 0.08)',
  lineStrong: 'rgba(20, 23, 38, 0.16)',
  /** the primary pill (buttons, selected states) */
  pill: '#4F46E5',
  pillInk: '#FFFFFF',
  /** brand accent for icons, badges and the main + button */
  accent: '#4F46E5',
  accentInk: '#FFFFFF',
  good: '#178A4C',
  bad: '#E5484D',
  shadow: '#1E2440',
  overlay: 'rgba(14, 17, 30, 0.4)',
};

const dark: typeof light = {
  scheme: 'dark',
  bg: '#0E1015',
  bgDeep: '#08090D',
  surface: '#181A22',
  surfaceAlt: '#22252F',
  ink: '#F1F3F9',
  inkSoft: '#B4B9CA',
  inkFaint: '#848A9E',
  line: 'rgba(241, 243, 249, 0.08)',
  lineStrong: 'rgba(241, 243, 249, 0.18)',
  pill: '#8B90FA',
  pillInk: '#0E1015',
  accent: '#8B90FA',
  accentInk: '#0E1015',
  good: '#4ADE80',
  bad: '#FF7A7E',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.55)',
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
