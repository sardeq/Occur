import { useColorScheme } from 'react-native';

/**
 * Occur's look: warm paper, black ink, soft gradient bubbles. An editorial
 * serif (Instrument Serif) for numbers and headlines; a friendly grotesque
 * (Manrope) for UI text.
 */

const light = {
  scheme: 'light' as 'light' | 'dark',
  bg: '#F3EEE5',
  bgDeep: '#EAE3D7',
  surface: '#FBF8F2',
  surfaceAlt: '#ECE5D9',
  ink: '#18150F',
  inkSoft: '#5F584D',
  inkFaint: '#9C9488',
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
  inkSoft: '#B9AF9F',
  inkFaint: '#7B7367',
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

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const font = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };
