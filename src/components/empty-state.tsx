import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { SUGGESTIONS } from '@/lib/suggestions';
import type { CategoryInput } from '@/lib/store';
import { font, useTheme } from '@/theme';
import { swatch } from '@/theme/palette';
import { AddBubble, Bubble } from './bubble';
import { tapHaptic } from './buttons';
import { Text } from './text';

/**
 * First run: the screen is empty except for one question. Starter ideas orbit
 * slowly around it — one tap on any of them creates that bubble.
 */
export function EmptyState({
  width,
  height,
  onCreate,
  onQuickAdd,
}: {
  width: number;
  height: number;
  onCreate: () => void;
  onQuickAdd: (s: CategoryInput) => void;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const spin = useSharedValue(0);
  const ideas = SUGGESTIONS.slice(0, 6);
  const size = Math.max(220, Math.min(width - 8, height - 150));
  const center = size * 0.42;
  const orbit = size * 0.37;
  const small = size * 0.17;

  useEffect(() => {
    if (reduce) return;
    spin.set(withRepeat(withTiming(1, { duration: 90_000, easing: Easing.linear }), -1, false));
  }, [reduce, spin]);

  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 360}deg` }] }));
  const upright = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.get() * 360}deg` }] }));

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, ring]}>
          {ideas.map((s, i) => {
            const a = (i / ideas.length) * Math.PI * 2 - Math.PI / 2;
            const x = size / 2 + Math.cos(a) * orbit - small / 2;
            const y = size / 2 + Math.sin(a) * orbit - small / 2;
            return (
              <Animated.View
                key={s.name}
                entering={FadeIn.delay(200 + i * 90)}
                style={[{ position: 'absolute', left: x, top: y }, upright]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Start counting ${s.name}`}
                  onPress={() => {
                    tapHaptic();
                    onQuickAdd(s);
                  }}
                  style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.92 : 1 }], alignItems: 'center' })}>
                  <Bubble size={small} swatch={swatch(s.color)} emoji={s.emoji} />
                  <Text variant="caption" tone="soft" style={{ marginTop: 4, fontFamily: font.semibold }}>
                    {s.name}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </Animated.View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create something to count"
          onPress={() => {
            tapHaptic();
            onCreate();
          }}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}>
          <View style={{ width: center, height: center, alignItems: 'center', justifyContent: 'center' }}>
            <AddBubble size={center} color={t.ink} />
          </View>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 24, alignItems: 'center', marginTop: 8 }}>
        <Text variant="title" style={{ textAlign: 'center' }}>
          What would you like to count?
        </Text>
        <Text variant="body" tone="soft" style={{ textAlign: 'center', marginTop: 6 }}>
          Tap an idea to start, or the + to make your own.
        </Text>
      </View>
    </View>
  );
}
