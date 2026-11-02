import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';

import { useLang } from '@/lib/i18n';
import { arabicTextStyle, font, useTheme, type Theme } from '@/theme';

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
  keepFont,
  ...rest
}: TextProps & {
  variant?: Variant;
  tone?: Tone;
  color?: string;
  /** keep the Latin font even in Arabic (e.g. the "Occur" wordmark) */
  keepFont?: boolean;
}) {
  const t = useTheme();
  const lang = useLang();
  const ar = lang === 'ar';
  // In Arabic, text (even Latin, like names or the wordmark) lines up on the right unless a screen says otherwise.
  const merged = [styles[variant], { color: color ?? toneColor(t, tone) }, ar && rtlAlign, style];
  return <RNText {...rest} style={ar && !keepFont ? arabicTextStyle(StyleSheet.flatten(merged) ?? {}) : merged} />;
}

const rtlAlign: TextStyle = { textAlign: 'right' };

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
