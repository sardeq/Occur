import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { font, useTheme, type Theme } from '@/theme';

type Variant = 'display' | 'title' | 'serif' | 'serifItalic' | 'body' | 'bodyStrong' | 'label' | 'caption' | 'eyebrow';

const styles: Record<Variant, TextStyle> = {
  display: { fontFamily: font.serif, fontSize: 56, lineHeight: 58, letterSpacing: -1 },
  title: { fontFamily: font.serif, fontSize: 34, lineHeight: 38, letterSpacing: -0.4 },
  serif: { fontFamily: font.serif, fontSize: 22, lineHeight: 26 },
  serifItalic: { fontFamily: font.serifItalic, fontSize: 20, lineHeight: 24 },
  body: { fontFamily: font.medium, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: font.bold, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: font.semibold, fontSize: 13, lineHeight: 17 },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
  eyebrow: { fontFamily: font.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.4, textTransform: 'uppercase' },
};

type Tone = 'ink' | 'soft' | 'faint' | 'pillInk' | 'good' | 'bad';

export function Text({
  variant = 'body',
  tone = 'ink',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone; color?: string }) {
  const t = useTheme();
  return <RNText {...rest} style={[styles[variant], { color: color ?? toneColor(t, tone) }, style]} />;
}

function toneColor(t: Theme, tone: Tone) {
  switch (tone) {
    case 'soft':
      return t.inkSoft;
    case 'faint':
      return t.inkFaint;
    case 'pillInk':
      return t.pillInk;
    case 'good':
      return t.good;
    case 'bad':
      return t.bad;
    default:
      return t.ink;
  }
}
