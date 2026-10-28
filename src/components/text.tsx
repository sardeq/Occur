import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { font, useTheme, type Theme } from '@/theme';

type Variant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong' | 'label' | 'caption' | 'eyebrow';

const styles: Record<Variant, TextStyle> = {
  display: { fontFamily: font.display, fontSize: 46, lineHeight: 52, letterSpacing: -0.8 },
  title: { fontFamily: font.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.4 },
  heading: { fontFamily: font.display, fontSize: 21, lineHeight: 27 },
  subheading: { fontFamily: font.displaySoft, fontSize: 19, lineHeight: 25 },
  body: { fontFamily: font.regular, fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontFamily: font.semibold, fontSize: 17, lineHeight: 24 },
  label: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: font.medium, fontSize: 14, lineHeight: 19 },
  eyebrow: { fontFamily: font.bold, fontSize: 13, lineHeight: 17, letterSpacing: 1, textTransform: 'uppercase' },
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
