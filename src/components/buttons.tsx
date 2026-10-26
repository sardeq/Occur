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
