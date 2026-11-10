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

import { Bubble } from '@/components/bubble';
import { PillButton } from '@/components/buttons';
import { GoogleMark } from '@/components/icon';
import { Text } from '@/components/text';
import { signInStrings } from '@/i18n/sign-in';
import { signInWithGoogle, startDemo } from '@/lib/auth';
import { useStrings } from '@/lib/i18n';
import { isFirebaseConfigured } from '@/lib/firebase';
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
  const S = useStrings(signInStrings);

  const run = async (which: 'google' | 'guest', fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(which);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? S.error);
    } finally {
      setBusy(null);
    }
  };

  // keep the layout sane on tablets / web: the stage never gets wider than a phone
  const W = Math.min(width, 440);
  const stage = Math.min(height * 0.46, W * 1.05);

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      {/* stage: a few floating bubbles */}
      <View style={{ height: stage, width: W, alignSelf: 'center' }}>
        <Floating delay={0} style={{ left: W * 0.07, top: stage * 0.1 }}>
          <Bubble
            size={W * 0.36}
            swatch={swatch('apricot')}
            emoji="☕"
            count={3}
            name={S.coffee}
            dots={[8.2, 11.5, 15.1]}
            nowHour={16.3}
          />
        </Floating>
        <Floating delay={500} amp={8} style={{ left: W * 0.6, top: stage * 0.04 }}>
          <Bubble
            size={W * 0.28}
            swatch={swatch('sky')}
            emoji="💧"
            count={6}
            name={S.water}
            dots={[8, 10, 12.5, 14, 15.5, 16]}
            nowHour={16.3}
          />
        </Floating>
        <Floating delay={900} amp={5} style={{ left: W * 0.47, top: stage * 0.44 }}>
          <Bubble
            size={W * 0.4}
            swatch={swatch('lilac')}
            emoji="📖"
            count={2}
            name={S.reading}
            dots={[13.2, 22]}
            nowHour={16.3}
          />
        </Floating>
        <Floating delay={300} amp={7} style={{ left: W * 0.15, top: stage * 0.62 }}>
          <Bubble size={W * 0.22} swatch={swatch('mint')} emoji="🏋️" count={1} dots={[7.2]} />
        </Floating>
      </View>

      {/* copy + actions — centred, so Latin wordmark and Arabic copy line up the same way */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.copy}>
          <Text
            keepFont
            style={{
              fontFamily: font.display,
              fontSize: 56,
              lineHeight: 64,
              color: t.ink,
              letterSpacing: -1.5,
              textAlign: 'center',
            }}>
            Occur
          </Text>
          <Text variant="subheading" style={{ color: t.accent, textAlign: 'center', marginTop: 2 }}>
            {S.tagline}
          </Text>
          <Text variant="body" tone="soft" style={{ marginTop: 12, textAlign: 'center' }}>
            {S.pitch}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(600)} style={{ gap: 10, marginTop: 28 }}>
          {isFirebaseConfigured && (
            <PillButton
              label={S.google}
              leading={
                <View style={styles.gBadge}>
                  <GoogleMark size={16} />
                </View>
              }
              loading={busy === 'google'}
              disabled={!!busy}
              onPress={() => run('google', signInWithGoogle)}
            />
          )}
          <PillButton
            variant={isFirebaseConfigured ? 'ghost' : 'ink'}
            icon={isFirebaseConfigured ? undefined : 'sparkle'}
            label={S.guest}
            disabled={!!busy}
            onPress={() => run('guest', startDemo)}
          />
          <Text variant="caption" tone="faint" style={{ textAlign: 'center', marginTop: 2 }}>
            {isFirebaseConfigured ? S.guestHint : S.noBackendHint}
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
  bottom: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  copy: { alignItems: 'center', alignSelf: 'center', maxWidth: 360 },
  gBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
