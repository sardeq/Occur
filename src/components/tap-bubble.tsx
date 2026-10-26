import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { font } from '@/theme';
import { Bubble, type BubbleProps } from './bubble';

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

type Props = BubbleProps & {
  id: string;
  /** centre position inside the field */
  x: number;
  y: number;
  label: string;
  onLog: () => void;
  onOpen: () => void;
  /** increments on every successful log, drives the ripple + "+1" */
  pulse: number;
};

/**
 * One bubble on the home screen. Tap = log (squish, ripple, haptic, "+1").
 * Press & hold = open details. Idle bubbles float a few pixels so the screen
 * feels alive; everything respects Reduce Motion.
 */
export function TapBubble({ id, x, y, label, onLog, onOpen, pulse, ...bubble }: Props) {
  const size = bubble.size;
  const reduce = useReducedMotion();
  const seed = hash(id);

  const left = useSharedValue(x - size / 2);
  const top = useSharedValue(y - size / 2);
  const press = useSharedValue(1);
  const bob = useSharedValue(0);
  const ripple = useSharedValue(1);
  const plus = useSharedValue(1);

  useEffect(() => {
    left.set(withSpring(x - size / 2, { damping: 18, stiffness: 120 }));
    top.set(withSpring(y - size / 2, { damping: 18, stiffness: 120 }));
  }, [x, y, size, left, top]);

  useEffect(() => {
    if (reduce) return;
    const d = 2200 + (seed % 1300);
    bob.set(
      withDelay(
        seed % 900,
        withRepeat(
          withSequence(
            withTiming(-1, { duration: d, easing: Easing.inOut(Easing.sin) }),
            withTiming(1, { duration: d, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      ),
    );
  }, [reduce, seed, bob]);

  useEffect(() => {
    if (pulse === 0) return;
    ripple.set(
      withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })),
    );
    plus.set(
      withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) })),
    );
  }, [pulse, ripple, plus]);

  const position = useAnimatedStyle(() => ({ left: left.get(), top: top.get() }));
  const motion = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.get() * 3 }, { scale: press.get() }],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: (1 - ripple.get()) * 0.55,
    transform: [{ scale: 1 + ripple.get() * 0.42 }],
  }));
  const plusStyle = useAnimatedStyle(() => ({
    opacity: plus.get() < 0.12 ? plus.get() / 0.12 : 1 - (plus.get() - 0.12) / 0.88,
    transform: [{ translateY: -plus.get() * size * 0.32 }, { scale: 0.8 + plus.get() * 0.4 }],
  }));

  return (
    <Animated.View style={[styles.abs, { width: size, height: size }, position]}>
      <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(14)} style={{ flex: 1 }}>
        <Animated.View style={[{ flex: 1 }, motion]}>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: size / 2, borderWidth: 2, borderColor: bubble.swatch.deep },
              rippleStyle,
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint="Double tap to count it. Hold to see details and history."
            accessibilityActions={[{ name: 'activate' }, { name: 'longpress', label: 'Open details' }]}
            onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'longpress' ? onOpen() : onLog())}
            delayLongPress={420}
            onPressIn={() => {
              press.set(withSpring(0.9, { damping: 15, stiffness: 420 }));
            }}
            onPressOut={() => {
              press.set(withSpring(1, { damping: 7, stiffness: 260 }));
            }}
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onLog();
            }}
            onLongPress={() => {
              if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
              onOpen();
            }}>
            <Bubble {...bubble} />
          </Pressable>
          <Animated.Text
            pointerEvents="none"
            style={[styles.plus, { color: bubble.swatch.deep, top: -size * 0.02, width: size }, plusStyle]}>
            +1
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  plus: {
    position: 'absolute',
    left: 0,
    textAlign: 'center',
    fontFamily: font.serif,
    fontSize: 30,
  },
});
