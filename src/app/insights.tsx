import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoundButton } from '@/components/buttons';
import { Bars, DayStrip } from '@/components/charts';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { useNow } from '@/hooks/use-now';
import { argmax, hourHistogram, inRange, pctChange } from '@/lib/stats';
import { useData } from '@/lib/store';
import {
  DAY,
  WEEKDAYS_SHORT,
  addDays,
  formatHour,
  formatHourCompact,
  numberWord,
  startOfDay,
  startOfWeek,
} from '@/lib/time';
import type { Goal } from '@/lib/types';
import { font, radius, useTheme, type Theme } from '@/theme';
import { alpha, swatch } from '@/theme/palette';

function tone(goal: Goal, diff: number, t: Theme) {
  if (diff === 0 || goal === 'track') return t.inkSoft;
  return (goal === 'more') === diff > 0 ? t.good : t.bad;
}

export default function Insights() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const categories = useData((s) => s.categories);
  const events = useData((s) => s.events);

  const data = useMemo(() => {
    const w0 = startOfWeek(now);
    const prev0 = addDays(w0, -7);
    const elapsed = now.getTime() - w0.getTime();
    const d0 = startOfDay(now);
    const thisWeek = inRange(events, w0, Infinity);
    const lastWeekSoFar = inRange(events, prev0, prev0.getTime() + elapsed);
    const today = inRange(events, d0, Infinity);

    const rows = categories.map((c) => {
      const days = Array.from({ length: 7 }, (_, i) => {
        const from = addDays(w0, i);
        return thisWeek.filter(
          (e) =>
            e.categoryId === c.id &&
            Date.parse(e.occurredAt) >= from.getTime() &&
            Date.parse(e.occurredAt) < from.getTime() + DAY,
        ).length;
      });
      const cur = days.reduce((a, b) => a + b, 0);
      const prev = lastWeekSoFar.filter((e) => e.categoryId === c.id).length;
      return { c, days, cur, prev, diff: cur - prev };
    });

    const last30 = inRange(events, addDays(d0, -29), Infinity);
    return {
      total: thisWeek.length,
      prevTotal: lastWeekSoFar.length,
      today,
      rows: rows.sort((a, b) => b.cur - a.cur),
      hours: hourHistogram(last30),
      last30Count: last30.length,
      todayIndex: Math.floor((d0.getTime() - w0.getTime()) / DAY + 0.5),
    };
  }, [categories, events, now]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const pct = pctChange(data.total, data.prevTotal);
  const busiest = argmax(data.hours);
  const max = Math.max(1, ...data.rows.flatMap((r) => r.days));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
        <RoundButton icon="back" label="Back" onPress={() => router.back()} size={42} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 20 }}>
          <Text variant="eyebrow" tone="soft">
            This week
          </Text>
          <Text style={{ fontFamily: font.serif, fontSize: 64, lineHeight: 68, color: t.ink, marginTop: 4 }}>
            {data.total}
          </Text>
          <Text variant="serif" tone="soft">
            {data.total === 1 ? 'moment' : 'moments'} so far
            {pct !== null && data.prevTotal > 0
              ? ` — ${pct === 0 ? 'same as' : `${Math.abs(pct)}% ${pct > 0 ? 'more than' : 'fewer than'}`} this point last week`
              : ''}
          </Text>
        </View>

        {/* today on a line */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text variant="label" tone="soft">
              Today, hour by hour
            </Text>
            <Text variant="label" tone="faint">
              {numberWord(data.today.length)}
            </Text>
          </View>
          <DayStrip
            now={now}
            items={data.today.map((e) => {
              const d = new Date(e.occurredAt);
              return {
                key: e.id,
                hour: d.getHours() + d.getMinutes() / 60,
                color: swatch(byId.get(e.categoryId)?.color).deep,
              };
            })}
          />
          {data.today.length === 0 && (
            <Text variant="caption" tone="faint">
              Nothing logged yet today.
            </Text>
          )}
        </View>

        {/* week table */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
          <View style={styles.row}>
            <View style={{ flex: 1 }} />
            {[1, 2, 3, 4, 5, 6, 0].map((d, i) => (
              <Text
                key={d}
                variant="caption"
                tone={i === data.todayIndex ? 'ink' : 'faint'}
                style={[styles.cellHead, i === data.todayIndex && { fontFamily: font.extrabold }]}>
                {WEEKDAYS_SHORT[d].slice(0, 2)}
              </Text>
            ))}
          </View>
          {data.rows.map(({ c, days }) => {
            const sw = swatch(c.color);
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={`${c.name} this week`}
                onPress={() => router.push({ pathname: '/category/[id]', params: { id: c.id } })}
                style={[styles.row, { marginTop: 8 }]}>
                <View style={[styles.row, { flex: 1, gap: 6, paddingRight: 6 }]}>
                  <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                  <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
                    {c.name}
                  </Text>
                </View>
                {days.map((v, i) => (
                  <View
                    key={i}
                    style={[
                      styles.cell,
                      {
                        backgroundColor: v ? alpha(sw.base, 0.25 + 0.75 * (v / max)) : t.line,
                        borderColor: i === data.todayIndex ? t.ink : 'transparent',
                        opacity: i > data.todayIndex ? 0.35 : 1,
                      },
                    ]}>
                    {v > 0 && (
                      <Text variant="caption" color={v / max > 0.6 ? sw.ink : t.ink} style={{ fontFamily: font.bold }}>
                        {v}
                      </Text>
                    )}
                  </View>
                ))}
              </Pressable>
            );
          })}
          {data.rows.length === 0 && (
            <Text variant="caption" tone="faint" style={{ marginTop: 8 }}>
              Your bubbles will show up here.
            </Text>
          )}
        </View>

        {/* trends */}
        {data.rows.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 26 }}>
            <Text variant="serif">Compared with last week</Text>
            <Text variant="caption" tone="faint" style={{ marginTop: 2 }}>
              Same point in the week, so Monday isn’t compared with a whole week. Green follows each bubble’s goal.
            </Text>
            {data.rows.map(({ c, cur, prev, diff }) => (
              <View key={c.id} style={[styles.trend, { borderBottomColor: t.line }]}>
                <Text style={{ fontSize: 18 }}>{c.emoji}</Text>
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text variant="label" tone="faint">
                  {prev} → {cur}
                </Text>
                <View style={[styles.badge, { backgroundColor: alpha(tone(c.goal, diff, t), 0.12) }]}>
                  <Text variant="label" color={tone(c.goal, diff, t)}>
                    {diff === 0 ? '=' : `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff)}`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* rhythm */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, marginTop: 26 }]}>
          <Text variant="label" tone="soft">
            Your daily rhythm · last 30 days
          </Text>
          <Text variant="serif" style={{ marginTop: 6 }}>
            {data.last30Count ? `Busiest around ${formatHour(busiest)}` : 'Not enough data yet'}
          </Text>
          <View style={{ marginTop: 12 }}>
            <Bars
              values={data.hours}
              labels={data.hours.map((_, i) => (i % 6 === 0 ? formatHourCompact(i) : ''))}
              color={t.ink}
              highlight={data.last30Count ? busiest : undefined}
              height={100}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/ask')}
          style={[styles.card, styles.row, { backgroundColor: t.pill, borderColor: t.pill, gap: 10 }]}>
          <Icon name="sparkle" size={18} color={t.pillInk} />
          <Text style={{ fontFamily: font.serifItalic, fontSize: 20, color: t.pillInk, flex: 1 }}>
            Ask something specific…
          </Text>
          <Icon name="chevron" size={18} color={t.pillInk} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  topbar: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 6 },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  cellHead: { width: 28, marginLeft: 4, textAlign: 'center' },
  cell: {
    width: 28,
    height: 28,
    marginLeft: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, minWidth: 44, alignItems: 'center' },
});
