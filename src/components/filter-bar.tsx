import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { tapHaptic } from '@/components/buttons';
import { Text } from '@/components/text';
import { ranges, type HomeRange } from '@/lib/home-filter';
import { isRTL, useLang } from '@/lib/i18n';
import { font, useTheme } from '@/theme';

const SEG_H = 40;
const PAD = 4;

/** Day · Week · Month · Year — the period the home bubbles count over. */
export function FilterBar({ range, onRange }: { range: HomeRange; onRange: (r: HomeRange) => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const lang = useLang();
  const rtl = isRTL(lang);
  const RANGES = ranges(lang);
  const [w, setW] = useState(0);
  const idx = Math.max(
    0,
    RANGES.findIndex((r) => r.key === range),
  );
  const seg = w > 0 ? (w - PAD * 2) / RANGES.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    // the pill is pinned to the physical left; in Arabic the first option sits on the right
    const to = (rtl ? RANGES.length - 1 - idx : idx) * seg;
    x.set(reduce || !seg ? withTiming(to, { duration: 0 }) : withSpring(to, { damping: 22, stiffness: 280 }));
  }, [idx, seg, reduce, x, rtl, RANGES.length]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View style={styles.wrap}>
      <View
        accessibilityRole="tablist"
        onLayout={(e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))}
        style={[styles.seg, { backgroundColor: t.surfaceAlt }]}>
        {seg > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.segPill, { width: seg, backgroundColor: t.surface, shadowColor: t.shadow }, pill]}
          />
        )}
        {RANGES.map((r) => {
          const on = r.key === range;
          return (
            <Pressable
              key={r.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={r.label}
              onPress={() => {
                if (on) return;
                tapHaptic();
                onRange(r.key);
              }}
              style={styles.segItem}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: on ? font.bold : font.medium,
                  fontSize: 14,
                  textAlign: 'center',
                  color: on ? t.ink : t.inkFaint,
                }}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 6, zIndex: 2 },
  seg: { height: SEG_H, borderRadius: 14, flexDirection: 'row', padding: PAD },
  segPill: {
    position: 'absolute',
    left: PAD,
    top: PAD,
    bottom: PAD,
    borderRadius: 10,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
