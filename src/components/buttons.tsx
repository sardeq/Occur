import * as Haptics from 'expo-haptics';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { font, radius, useTheme } from '@/theme';
import { Icon, type IconName } from './icon';
import { Text } from './text';

const glassOk =
  Platform.OS === 'ios' &&
  (() => {
    try {
      return isGlassEffectAPIAvailable();
    } catch {
      return false;
    }
  })();

export function tapHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== 'web') void Haptics.impactAsync(style).catch(() => {});
}

/** The black pill — the primary action everywhere. */
export function PillButton({
  label,
  onPress,
  icon,
  leading,
  variant = 'ink',
  disabled,
  loading,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  leading?: ReactNode;
  variant?: 'ink' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const bg = variant === 'ink' ? t.pill : 'transparent';
  const fg = variant === 'ink' ? t.pillInk : variant === 'danger' ? t.bad : t.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled || loading}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: bg,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        variant === 'ghost' && { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.lineStrong },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {leading}
          {icon && <Icon name={icon} color={fg} size={20} />}
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: fg }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Round icon button. Uses Liquid Glass on iOS 26+, a paper disc elsewhere. */
export function RoundButton({
  icon,
  onPress,
  size = 44,
  label,
  tone = 'surface',
  children,
  style,
}: {
  icon?: IconName;
  onPress: () => void;
  size?: number;
  label: string;
  tone?: 'surface' | 'ink' | 'glass';
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const fg = tone === 'ink' ? t.pillInk : t.ink;
  const inner = children ?? (icon ? <Icon name={icon} color={fg} size={size * 0.48} /> : null);
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.94 : 1 }] }, style]}>
      {tone === 'glass' && glassOk ? (
        <GlassView isInteractive glassEffectStyle="regular" style={[shape, styles.center]}>
          {inner}
        </GlassView>
      ) : (
        <View
          style={[
            shape,
            styles.center,
            tone === 'ink'
              ? { backgroundColor: t.pill }
              : { backgroundColor: t.surface, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line },
          ]}>
          {inner}
        </View>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  onPress,
  active,
  leading,
}: {
  label: string;
  onPress?: () => void;
  active?: boolean;
  leading?: ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      onPress={() => {
        tapHaptic();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? t.pill : t.surface,
          borderColor: active ? t.pill : t.line,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      {leading}
      <Text variant="label" color={active ? t.pillInk : t.ink}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 56,
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  center: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});

/**
 * A labelled navigation button ("‹ Back", "✕ Close", "Done"). Words next to
 * the icon so nobody has to guess what a bare symbol does.
 */
export function NavButton({
  label,
  icon,
  onPress,
  accessibilityLabel,
  variant = 'surface',
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  accessibilityLabel?: string;
  variant?: 'surface' | 'ink';
}) {
  const t = useTheme();
  const fg = variant === 'ink' ? t.pillInk : t.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={10}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        navStyles.nav,
        variant === 'ink'
          ? { backgroundColor: t.pill }
          : { backgroundColor: t.surface, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.lineStrong },
        { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}>
      {icon && <Icon name={icon} size={20} color={fg} strokeWidth={2.3} />}
      <Text style={{ fontFamily: font.semibold, fontSize: 17, color: fg }}>{label}</Text>
    </Pressable>
  );
}

/** Big, obvious segmented control (Settings → Appearance etc.). */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { key: K; label: string; icon?: IconName }[];
  value: K;
  onChange: (k: K) => void;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[navStyles.seg, { backgroundColor: t.surfaceAlt }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            onPress={() => {
              tapHaptic();
              onChange(o.key);
            }}
            style={[
              navStyles.segItem,
              on && {
                backgroundColor: t.surface,
                shadowColor: t.shadow,
                shadowOpacity: 0.14,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
              },
            ]}>
            {o.icon && <Icon name={o.icon} size={18} color={on ? t.ink : t.inkSoft} />}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ fontFamily: on ? font.bold : font.medium, fontSize: 16, color: on ? t.ink : t.inkSoft }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const navStyles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 46,
    paddingLeft: 12,
    paddingRight: 18,
    borderRadius: radius.pill,
  },
  seg: { flexDirection: 'row', borderRadius: 16, padding: 4, gap: 4 },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    height: 46,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
