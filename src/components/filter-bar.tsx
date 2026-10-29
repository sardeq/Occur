import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { tapHaptic } from '@/components/buttons';
import { Text } from '@/components/text';
import { RANGES, TOP_N, type HomeRange, type Lens } from '@/lib/home-filter';
import type { Category } from '@/lib/types';
import { font, radius, useTheme } from '@/theme';
import { swatch } from '@/theme/palette';

const SEG_H = 34;
const CHIP_H = 34;

const LENSES: { key: Lens; emoji: string; label: string; a11y: string }[] = [
  { key: 'top', emoji: '🔥', label: `Top ${TOP_N}`, a11y: `Only the ${TOP_N} most active` },
  { key: 'quiet', emoji: '💤', label: 'Quiet', a11y: 'Only things with nothing logged in this period' },
  { key: 'more', emoji: '🌱', label: 'Doing more', a11y: 'Only things you want to do more' },
  { key: 'less', emoji: '🪶', label: 'Cutting back', a11y: 'Only things you want to do less' },
];

/**
 * Sits under the home headline. Row 1 picks the period the bubbles count
 * over; row 2 narrows what's shown — a lens, or one or more categories
 * ("just coffee", "coffee + water").
 */
export function FilterBar({
  range,
  onRange,
  lens,
  onLens,
  picked,
  onPick,
  onClear,
  categories,
  counts,
  goals,
}: {
  range: HomeRange;
  onRange: (r: HomeRange) => void;
  lens: Lens | null;
  onLens: (l: Lens) => void;
  picked: string[];
  onPick: (id: string) => void;
  onClear: () => void;
  /** in display order */
  categories: Category[];
  /** count in the selected period, per category */
  counts: Record<string, number>;
  goals: { more: boolean; less: boolean };
}) {
  const t = useTheme();
  const all = !lens && picked.length === 0;
  const lenses = LENSES.filter((l) => (l.key === 'more' ? goals.more : l.key === 'less' ? goals.less : true));

  return (
    <View style={styles.wrap}>
      <RangeSwitch value={range} onChange={onRange} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={{ marginHorizontal: -16 }}>
        <Chip label="All" selected={all} onPress={onClear} a11y="Show everything" />
        {categories.length > 1 &&
          lenses.map((l) => (
            <Chip
              key={l.key}
              emoji={l.emoji}
              label={l.label}
              a11y={l.a11y}
              selected={lens === l.key}
              onPress={() => onLens(l.key)}
            />
          ))}
        {categories.length > 1 && <View style={[styles.divider, { backgroundColor: t.lineStrong }]} />}
        {categories.length > 1 &&
          categories.map((c) => {
            const on = picked.includes(c.id);
            const sw = swatch(c.color);
            const n = counts[c.id] ?? 0;
            return (
              <Chip
                key={c.id}
                emoji={c.emoji}
                label={c.name}
                badge={n}
                selected={on}
                tint={on ? { bg: sw.base, border: sw.deep, ink: sw.ink } : undefined}
                a11y={`${on ? 'Hide' : 'Show'} ${c.name}, ${n}`}
                onPress={() => onPick(c.id)}
              />
            );
          })}
      </ScrollView>
    </View>
  );
}

/** Today · Week · Month · Year, with a sliding black pill. */
function RangeSwitch({ value, onChange }: { value: HomeRange; onChange: (r: HomeRange) => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const idx = Math.max(
    0,
    RANGES.findIndex((r) => r.key === value),
  );
  const seg = w > 0 ? (w - 6) / RANGES.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    const to = idx * seg;
    x.set(reduce || !seg ? withTiming(to, { duration: 0 }) : withSpring(to, { damping: 20, stiffness: 260 }));
  }, [idx, seg, reduce, x]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))}
      style={[styles.seg, { backgroundColor: t.surfaceAlt }]}>
      {seg > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.segPill, { width: seg, backgroundColor: t.pill, shadowColor: t.shadow }, pill]}
        />
      )}
      {RANGES.map((r) => {
        const on = r.key === value;
        return (
          <Pressable
            key={r.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={r.label}
            onPress={() => {
              if (on) return;
              tapHaptic();
              onChange(r.key);
            }}
            style={styles.segItem}>
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: on ? t.pillInk : t.inkSoft }}>{r.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Chip({
  label,
  emoji,
  badge,
  selected,
  tint,
  a11y,
  onPress,
}: {
  label: string;
  emoji?: string;
  badge?: number;
  selected: boolean;
  tint?: { bg: string; border: string; ink: string };
  a11y?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  const bg = tint?.bg ?? (selected ? t.pill : t.surface);
  const border = tint?.border ?? (selected ? t.pill : t.line);
  const ink = tint?.ink ?? (selected ? t.pillInk : t.ink);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={a11y ?? label}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: bg, borderColor: border, transform: [{ scale: pressed ? 0.95 : 1 }] },
      ]}>
      {!!emoji && <Text style={{ fontSize: 14 }}>{emoji}</Text>}
      <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 14, color: ink, maxWidth: 130 }}>
        {label}
      </Text>
      {badge !== undefined && (
        <Text style={{ fontFamily: font.display, fontSize: 13, color: ink, opacity: badge ? 0.6 : 0.35 }}>{badge}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4, gap: 8, zIndex: 2 },
  seg: { height: SEG_H, borderRadius: SEG_H / 2, flexDirection: 'row', padding: 3 },
  segPill: {
    position: 'absolute',
    left: 3,
    top: 3,
    bottom: 3,
    borderRadius: (SEG_H - 6) / 2,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 6, paddingHorizontal: 16, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: CHIP_H,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  divider: { width: StyleSheet.hairlineWidth * 2, height: 18, marginHorizontal: 4 },
});
