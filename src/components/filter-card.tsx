import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Bars } from '@/components/charts';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import type { Tile } from '@/lib/home-filter';
import type { Category } from '@/lib/types';
import { font, radius, useTheme } from '@/theme';
import { swatch } from '@/theme/palette';

/**
 * Shown when exactly one category is picked: "how many coffees a day / a
 * week", usual time, pace vs last period, and a mini chart for the period.
 */
export function FocusCard({
  category,
  tiles,
  series,
  onOpen,
}: {
  category: Category;
  tiles: Tile[];
  series: { values: number[]; labels: string[]; highlight: number };
  onOpen: () => void;
}) {
  const t = useTheme();
  const sw = swatch(category.color);
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(120)}
      style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -12 }}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
        {tiles.map((tile) => (
          <View key={tile.label} style={[styles.tile, { backgroundColor: t.surfaceAlt }]}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: font.display,
                fontSize: 19,
                lineHeight: 23,
                color: tile.tone === 'good' ? t.good : tile.tone === 'bad' ? t.bad : t.ink,
              }}>
              {tile.value}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 12, color: t.inkSoft }}>
              {tile.label}
            </Text>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${category.name} details`}
          onPress={onOpen}
          style={({ pressed }) => [
            styles.tile,
            styles.more,
            { borderColor: t.lineStrong, opacity: pressed ? 0.6 : 1 },
          ]}>
          <Text style={{ fontFamily: font.bold, fontSize: 13, color: t.ink }}>More</Text>
          <Icon name="chevron" size={13} color={t.ink} strokeWidth={2.6} />
        </Pressable>
      </ScrollView>
      <View style={{ marginTop: 8 }} accessible accessibilityLabel={`${category.name} per period chart`}>
        <Bars values={series.values} labels={series.labels} highlight={series.highlight} color={sw.deep} height={58} />
      </View>
    </Animated.View>
  );
}

/**
 * Shown for a mix (several picked, a lens, or a longer period): who's taking
 * up how much of it as one stacked bar, plus a one-line takeaway.
 */
export function MixCard({ items, line }: { items: { category: Category; count: number }[]; line: string | null }) {
  const t = useTheme();
  const live = items.filter((i) => i.count > 0).sort((a, b) => b.count - a.count);
  const total = live.reduce((s, i) => s + i.count, 0);
  if (!line && !total) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(120)}
      style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, gap: 8 }]}>
      {!!line && (
        <Text numberOfLines={2} style={{ fontFamily: font.bold, fontSize: 15, lineHeight: 20, color: t.ink }}>
          {line}
        </Text>
      )}
      {total > 0 && (
        <>
          <View style={[styles.stack, { backgroundColor: t.surfaceAlt }]}>
            {live.map((i) => (
              <View
                key={i.category.id}
                style={{ flex: i.count, backgroundColor: swatch(i.category.color).base, minWidth: 4 }}
              />
            ))}
          </View>
          <View style={styles.legend}>
            {live.slice(0, 6).map((i) => (
              <View key={i.category.id} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: swatch(i.category.color).base }]} />
                <Text style={{ fontFamily: font.semibold, fontSize: 12, color: t.inkSoft }}>
                  {i.category.emoji} {Math.round((i.count / total) * 100)}%
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 4,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    zIndex: 2,
  },
  tile: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 14, minWidth: 74 },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 0,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  stack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
