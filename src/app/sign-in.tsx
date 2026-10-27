import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Bubble } from '@/components/bubble';
import { PillButton } from '@/components/buttons';
import { GoogleMark } from '@/components/icon';
import { Text } from '@/components/text';
import { signInWithGoogle, startDemo } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { font, useTheme } from '@/theme';
import { swatch } from '@/theme/palette';

function Floating({
  children,
  delay,
  amp = 6,
  style,
}: {
  children: React.ReactNode;
  delay: number;
  amp?: number;
  style: object;
}) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
            withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      ),
    );
  }, [reduce, delay, y]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() * amp }] }));
  return <Animated.View style={[{ position: 'absolute' }, style, s]}>{children}</Animated.View>;
}

export default function SignIn() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [busy, setBusy] = useState<'google' | 'guest' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stage = Math.min(height * 0.5, 460);

  const run = async (which: 'google' | 'guest', fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(which);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const W = width;

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      {/* stage */}
      <View style={{ height: stage }}>
        <Svg width={W} height={stage} style={StyleSheet.absoluteFill}>
          <Path
            d={`M -20 ${stage * 0.2} C ${W * 0.3} ${stage * 0.05}, ${W * 0.55} ${stage * 0.6}, ${W + 20} ${stage * 0.35}`}
            stroke={t.lineStrong}
            strokeWidth={1.2}
            fill="none"
          />
          <Path
            d={`M -20 ${stage * 0.85} C ${W * 0.25} ${stage * 0.6}, ${W * 0.7} ${stage}, ${W + 20} ${stage * 0.7}`}
            stroke={t.line}
            strokeWidth={1.2}
            fill="none"
          />
        </Svg>
        <Floating delay={0} style={{ left: W * 0.08, top: stage * 0.1 }}>
          <Bubble
            size={W * 0.36}
            swatch={swatch('apricot')}
            emoji="☕"
            count={3}
            name="Coffee"
            dots={[8.2, 11.5, 15.1]}
            nowHour={16.3}
          />
        </Floating>
        <Floating delay={500} amp={8} style={{ left: W * 0.55, top: stage * 0.02 }}>
          <Bubble
            size={W * 0.26}
            swatch={swatch('sky')}
            emoji="💧"
            count={6}
            name="Water"
            dots={[8, 10, 12.5, 14, 15.5, 16]}
            nowHour={16.3}
          />
        </Floating>
        <Floating delay={900} amp={5} style={{ left: W * 0.5, top: stage * 0.42 }}>
          <Bubble
            size={W * 0.42}
            swatch={swatch('slate')}
            emoji="🚬"
            count={2}
            name="Smoking"
            dots={[9.5, 13.2]}
            nowHour={16.3}
          />
        </Floating>
        <Floating delay={300} amp={7} style={{ left: W * 0.14, top: stage * 0.6 }}>
          <Bubble size={W * 0.22} swatch={swatch('mint')} emoji="🏋️" count={1} dots={[7.2]} />
        </Floating>
      </View>

      {/* copy + actions */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <Animated.View entering={FadeInDown.duration(600)}>
          <Text variant="eyebrow" tone="soft">
            How many times, and when?
          </Text>
          <Text
            style={{
              fontFamily: font.serif,
              fontSize: 76,
              lineHeight: 80,
              color: t.ink,
              marginTop: 6,
              letterSpacing: -1.5,
            }}>
            Occur
          </Text>
          <Text variant="serifItalic" tone="soft" style={{ fontSize: 24, lineHeight: 28 }}>
            Click. Click. Done.
          </Text>
          <Text variant="body" tone="soft" style={{ marginTop: 12, maxWidth: 340 }}>
            Make a bubble for anything you want to count. Tap it when it happens — Occur remembers when, and answers
            your questions about it later.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(600)} style={{ gap: 10, marginTop: 26 }}>
          {isSupabaseConfigured && (
            <PillButton
              label="Continue with Google"
              leading={
                <View style={[styles.gBadge, { backgroundColor: '#fff' }]}>
                  <GoogleMark size={16} />
                </View>
              }
              loading={busy === 'google'}
              disabled={!!busy}
              onPress={() => run('google', signInWithGoogle)}
            />
          )}
          <PillButton
            variant={isSupabaseConfigured ? 'ghost' : 'ink'}
            icon={isSupabaseConfigured ? undefined : 'sparkle'}
            label="Try it without an account"
            disabled={!!busy}
            onPress={() => run('guest', startDemo)}
          />
          <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
            {isSupabaseConfigured
              ? 'No account? Explore with sample data — it stays on this phone.'
              : 'Runs with sample data on this phone. Google sign-in turns on once Supabase keys are in .env.local.'}
          </Text>
          {!!error && (
            <Text variant="caption" tone="bad" style={{ textAlign: 'center' }}>
              {error}
            </Text>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bottom: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24 },
  gBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
