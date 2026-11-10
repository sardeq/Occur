import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import Animated, {
  Easing,
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { componentStrings } from '@/i18n/home';
import { isRTL, useLang, useStrings } from '@/lib/i18n';
import { useFont } from '@/theme';
import type { Swatch } from '@/theme/palette';
import { Bubble, type BubbleProps } from './bubble';
import { Icon } from './icon';

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

type Props = BubbleProps & {
  id: string;
  /** centre position inside the field */
  x: number;
  y: number;
  label: string;
  /** how many today — the "−" button only shows when there's something to take away */
  todayCount: number;
  onLog: () => void;
  /** take one away (mis-tap) */
  onRemove: () => void;
  onOpen: () => void;
  /** increments on every successful log, drives the ripple + "+1" */
  pulse: number;
  /** increments on every removal, drives the "−1" */
  minusPulse: number;
};

/** A drag at least this far down (and mostly vertical) counts as "take one away". */
const SWIPE_MIN = 44;

/**
 * One bubble on the home screen.
 *  - Tap = add one (squish, ripple, haptic, "+1").
 *  - Swipe down on it, or tap the small "−" button = take one away ("−1").
 *  - Press & hold = open details.
 * Idle bubbles float a few pixels so the screen feels alive; everything
 * respects Reduce Motion.
 */
export function TapBubble({
  id,
  x,
  y,
  label,
  todayCount,
  onLog,
  onRemove,
  onOpen,
  pulse,
  minusPulse,
  ...bubble
}: Props) {
  const size = bubble.size;
  const reduce = useReducedMotion();
  const s = useStrings(componentStrings);
  const f = useFont();

  const position = useSpringPosition(x, y, size, 0);
  const bob = useBob(id);
  const press = useSharedValue(1);
  const ripple = useSharedValue(1);
  const plus = useSharedValue(1);
  const minus = useSharedValue(1);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (pulse === 0) return;
    ripple.set(
      withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })),
    );
    plus.set(
      withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) })),
    );
  }, [pulse, ripple, plus]);

  useEffect(() => {
    if (minusPulse === 0) return;
    minus.set(
      withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) })),
    );
    // a little downward nudge so it feels like the count dropped
    press.set(withSequence(withTiming(0.92, { duration: 90 }), withSpring(1, { damping: 8, stiffness: 260 })));
  }, [minusPulse, minus, press]);

  const motion = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.get() * 3 }, { scale: press.get() }],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: (1 - ripple.get()) * 0.55,
    transform: [{ scale: 1 + ripple.get() * 0.42 }],
  }));
  const minusStyle = useAnimatedStyle(() => ({
    opacity: minus.get() < 0.12 ? minus.get() / 0.12 : 1 - (minus.get() - 0.12) / 0.88,
    transform: [{ translateY: minus.get() * size * 0.32 }, { scale: 0.8 + minus.get() * 0.4 }],
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
            accessibilityHint={s.bubbleHint}
            accessibilityActions={[
              { name: 'activate', label: s.actionAdd },
              { name: 'decrement', label: s.actionRemove },
              { name: 'increment', label: s.actionAdd },
              { name: 'longpress', label: s.actionOpen },
            ]}
            onAccessibilityAction={(e) => {
              const a = e.nativeEvent.actionName;
              if (a === 'longpress') onOpen();
              else if (a === 'decrement') {
                if (todayCount > 0) onRemove();
              } else onLog();
            }}
            delayLongPress={450}
            // keep the press alive while the finger slides, so a swipe-down
            // still ends in onPress (where we tell a tap from a swipe)
            pressRetentionOffset={{ top: 200, bottom: 400, left: 200, right: 200 }}
            onPressIn={(e: GestureResponderEvent) => {
              start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
              press.set(withSpring(0.9, { damping: 15, stiffness: 420 }));
            }}
            onPressOut={() => {
              press.set(withSpring(1, { damping: 7, stiffness: 260 }));
            }}
            onPress={(e: GestureResponderEvent) => {
              const s0 = start.current;
              const dx = s0 ? e.nativeEvent.pageX - s0.x : 0;
              const dy = s0 ? e.nativeEvent.pageY - s0.y : 0;
              if (dy > SWIPE_MIN && Math.abs(dy) > Math.abs(dx) * 1.3) {
                if (todayCount > 0) onRemove();
                return;
              }
              if (Math.hypot(dx, dy) > SWIPE_MIN) return; // some other drag — ignore, don't count
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
            style={[
              styles.plus,
              { fontFamily: f.display, color: bubble.swatch.deep, top: -size * 0.02, width: size },
              plusStyle,
            ]}>
            +1
          </Animated.Text>
          <Animated.Text
            pointerEvents="none"
            style={[
              styles.plus,
              { fontFamily: f.display, color: bubble.swatch.deep, top: size * 0.62, width: size },
              minusStyle,
            ]}>
            −1
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** Room around the bubble so the "−" (which pokes past the rim) stays inside its parent's bounds — Android won't hit-test outside them. */
const MINUS_PAD = 32;
const MINUS_SIZE = 40;

/**
 * The small "−" (take one away) for a bubble. Rendered by the screen in a
 * separate pass *after* every bubble, so it always sits on top: it pokes past
 * the bubble's rim, and a neighbouring bubble's (square) touch area would
 * otherwise swallow taps on it. Follows the bubble's position spring and idle
 * float so the two stay glued together.
 */
export function BubbleMinus({
  id,
  x,
  y,
  size,
  swatch,
  name,
  todayCount,
  onRemove,
}: {
  id: string;
  x: number;
  y: number;
  size: number;
  swatch: Swatch;
  name?: string;
  todayCount: number;
  onRemove: () => void;
}) {
  const reduce = useReducedMotion();
  const s = useStrings(componentStrings);
  const rtl = isRTL(useLang());
  const position = useSpringPosition(x, y, size, MINUS_PAD);
  const bob = useBob(id);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: bob.get() * 3 }] }));

  // the "−" sits at the bottom corner on the reading-end side
  const offset = (size / 2 + 2) * 0.7071;
  const c = size / 2 + MINUS_PAD;
  const box = size + MINUS_PAD * 2;

  return (
    // always mounted (even with nothing to take away) so the float stays in phase with the bubble
    <Animated.View pointerEvents="box-none" style={[styles.abs, { width: box, height: box }, position]}>
      <Animated.View pointerEvents="box-none" style={[{ flex: 1 }, motion]}>
        {todayCount > 0 && (
          <Animated.View
            entering={reduce ? undefined : ZoomIn.springify().damping(14)}
            exiting={reduce ? undefined : ZoomOut.duration(160)}
            style={[
              styles.minusWrap,
              {
                left: c + (rtl ? -offset : offset) - MINUS_SIZE / 2,
                top: c + offset - MINUS_SIZE / 2,
              },
            ]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={s.takeOneAway(name ?? '')}
              hitSlop={8}
              onPress={onRemove}
              style={({ pressed }) => [
                styles.minus,
                {
                  backgroundColor: '#FFFFFF',
                  borderColor: swatch.deep,
                  transform: [{ scale: pressed ? 0.9 : 1 }],
                },
              ]}>
              <Icon name="minus" size={20} color="#1A1712" strokeWidth={3} />
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

/** Springs a view's top-left to follow a centre point (x, y), with `pad` of extra room around a `size` box. */
function useSpringPosition(x: number, y: number, size: number, pad: number) {
  const left = useSharedValue(x - size / 2 - pad);
  const top = useSharedValue(y - size / 2 - pad);
  useEffect(() => {
    left.set(withSpring(x - size / 2 - pad, { damping: 18, stiffness: 120 }));
    top.set(withSpring(y - size / 2 - pad, { damping: 18, stiffness: 120 }));
  }, [x, y, size, pad, left, top]);
  return useAnimatedStyle(() => ({ left: left.get(), top: top.get() }));
}

/** Gentle idle float, deterministic per id so a bubble and its "−" move together. */
function useBob(id: string) {
  const reduce = useReducedMotion();
  const seed = hash(id);
  const bob = useSharedValue(0);
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
  return bob;
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  minusWrap: { position: 'absolute', width: MINUS_SIZE, height: MINUS_SIZE },
  minus: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  plus: {
    position: 'absolute',
    left: 0,
    textAlign: 'center',
    fontSize: 28,
  },
});
