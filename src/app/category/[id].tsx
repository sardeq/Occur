import * as Haptics from 'expo-haptics';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bubble } from '@/components/bubble';
import { Chip, NavButton, PillButton } from '@/components/buttons';
import { Bars, ClockChart, Heatmap } from '@/components/charts';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { useNow } from '@/hooks/use-now';
import { argmax, gaps, hourHistogram, inRange, periodStats, streaks, typicalHour, weekdayHistogram } from '@/lib/stats';
import { showActionSheet } from '@/lib/dialog';
import { deleteEvent, logEvent, removeLatestToday, useData } from '@/lib/store';
import {
  DAY,
  MONTHS_SHORT,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
  addDays,
  dayKey,
  formatDate,
  formatDayLabel,
  formatDuration,
  formatHour,
  formatTime,
  startOfDay,
} from '@/lib/time';
import type { Goal, OccurEvent } from '@/lib/types';
import { font, radius, useTheme, type Theme } from '@/theme';
import { alpha, swatch } from '@/theme/palette';

const GOAL_LABEL: Record<Goal, string> = { track: 'Just counting', more: 'Doing more', less: 'Doing less' };

function deltaTone(goal: Goal, diff: number, t: Theme): string {
  if (diff === 0 || goal === 'track') return t.inkSoft;
  const up = diff > 0;
  return (goal === 'more') === up ? t.good : t.bad;
}

/** Ticks every second, isolated so the rest of the screen doesn't re-render. */
function Since({ last, suffix }: { last: Date; suffix?: string }) {
  const now = useNow(1000);
  return (
    <Text variant="display" style={{ fontSize: 40, lineHeight: 48 }}>
      {formatDuration(now.getTime() - last.getTime())}
      {suffix ? <Text variant="subheading" tone="soft" style={{ fontSize: 24 }}>{` ${suffix}`}</Text> : null}
    </Text>
  );
}

function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  color,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaLabel?: string;
  color?: string;
}) {
  const t = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Text variant="eyebrow" tone="faint">
        {label}
      </Text>
      <Text style={{ fontFamily: font.display, fontSize: 32, lineHeight: 40, color: t.ink, marginTop: 4 }}>
        {value}
      </Text>
      {!!delta && (
        <Text variant="caption" color={color} numberOfLines={1}>
          {delta}
          {deltaLabel ? <Text variant="caption" tone="faint">{` ${deltaLabel}`}</Text> : null}
        </Text>
      )}
    </View>
  );
}

const RANGES = [
  { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: 0 },
] as const;

export default function CategoryScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cat = useData((s) => s.categories.find((c) => c.id === id));
  const all = useData((s) => s.events);
  const now = useNow(60_000);
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('30');
  const [daysShown, setDaysShown] = useState(10);

  const events = useMemo(() => all.filter((e) => e.categoryId === id), [all, id]);
  const stats = useMemo(() => periodStats(events, now), [events, now]);

  const ranged = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    return r.days ? inRange(events, addDays(startOfDay(now), -(r.days - 1)), Infinity) : events;
  }, [events, range, now]);

  const hours = useMemo(() => hourHistogram(ranged), [ranged]);
  const usual = useMemo(() => typicalHour(ranged), [ranged]);
  const weekdays = useMemo(() => {
    const h = weekdayHistogram(ranged);
    return [1, 2, 3, 4, 5, 6, 0].map((i) => h[i]);
  }, [ranged]);

  const history = useMemo(() => {
    const groups: { key: string; date: Date; items: OccurEvent[] }[] = [];
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      const d = new Date(e.occurredAt);
      const k = dayKey(d);
      const last = groups[groups.length - 1];
      if (last?.key === k) last.items.push(e);
      else groups.push({ key: k, date: startOfDay(d), items: [e] });
    }
    return groups;
  }, [events]);

  if (!cat) return <Redirect href="/" />;
  const sw = swatch(cat.color);
  const goal = cat.goal;

  const last30 = inRange(events, addDays(startOfDay(now), -29), Infinity).length;
  const st = streaks(events, now);
  const gp = gaps(events, now);
  const firstDay = stats.first ? startOfDay(stats.first) : null;
  const daysTracked = firstDay
    ? Math.min(30, Math.max(1, Math.round((startOfDay(now).getTime() - firstDay.getTime()) / DAY) + 1))
    : 1;

  const delta = (cur: number, prev: number) => {
    const d = cur - prev;
    return { text: d === 0 ? '= same' : `${d > 0 ? '↑' : '↓'} ${Math.abs(d)}`, color: deltaTone(goal, d, t) };
  };
  const dT = delta(stats.today, stats.todayPrev);
  const dW = delta(stats.week, stats.weekPrev);
  const dM = delta(stats.month, stats.monthPrev);

  const logNow = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    logEvent(cat.id);
  };

  const removeOne = () => {
    const e = removeLatestToday(cat.id, new Date());
    if (!e) return;
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };

  const onEvent = (e: OccurEvent) => {
    const d = new Date(e.occurredAt);
    const title = `${formatDate(d, now)} at ${formatTime(d)}`;
    const message = e.place ? `Near ${e.place}` : undefined;
    const edit = () => router.push({ pathname: '/log-time', params: { categoryId: cat.id, eventId: e.id } });
    const del = () => {
      deleteEvent(e.id);
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    };
    showActionSheet(title, message, [
      { label: 'Change time', onPress: edit },
      { label: 'Delete entry', style: 'destructive', onPress: del },
      { label: 'Cancel', style: 'cancel' },
    ]);
  };

  const clockSize = Math.min(width - 72, 300);
  const lastEvent = events[events.length - 1];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
        <NavButton icon="back" label="Back" accessibilityLabel="Back to home" onPress={() => router.back()} />
        <NavButton
          icon="pencil"
          label="Edit"
          accessibilityLabel={`Edit ${cat.name}`}
          onPress={() => router.push({ pathname: '/edit-category', params: { id: cat.id } })}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* hero */}
        <View style={styles.hero}>
          <Pressable onPress={logNow} accessibilityRole="button" accessibilityLabel={`Log ${cat.name} now`}>
            <Bubble size={92} swatch={sw} emoji={cat.emoji} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text variant="title" style={{ fontSize: 34, lineHeight: 40 }} numberOfLines={2}>
              {cat.name}
            </Text>
            <View style={[styles.row, { gap: 8, marginTop: 6 }]}>
              <View style={[styles.tag, { backgroundColor: t.surfaceAlt }]}>
                <Text variant="caption" tone="soft" style={{ fontFamily: font.bold }}>
                  {GOAL_LABEL[goal]}
                </Text>
              </View>
              {cat.trackLocation && (
                <View style={[styles.tag, styles.row, { backgroundColor: t.surfaceAlt, gap: 4 }]}>
                  <Icon name="pin" size={12} color={t.inkSoft} />
                  <Text variant="caption" tone="soft" style={{ fontFamily: font.bold }}>
                    Places on
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* since last */}
        <View
          style={[
            styles.card,
            styles.since,
            { backgroundColor: alpha(sw.light, 0.28), borderColor: alpha(sw.base, 0.35) },
          ]}>
          <Text variant="eyebrow" tone="soft">
            {goal === 'less' ? 'Time since the last one' : 'Last time'}
          </Text>
          {lastEvent ? (
            <>
              <Since last={new Date(lastEvent.occurredAt)} suffix={goal === 'less' ? undefined : 'ago'} />
              <Text variant="body" tone="soft">
                {formatDayLabel(new Date(lastEvent.occurredAt), now)} at {formatTime(new Date(lastEvent.occurredAt))}
                {lastEvent.place ? ` · near ${lastEvent.place}` : ''}
              </Text>
            </>
          ) : (
            <Text variant="heading" style={{ marginTop: 6 }}>
              Nothing yet. Tap “Add one” the next time it happens.
            </Text>
          )}
          <View style={[styles.row, { gap: 10, marginTop: 16 }]}>
            <PillButton label="Add one" icon="plus" onPress={logNow} style={{ flex: 1, height: 54 }} />
            <PillButton
              label="Earlier…"
              icon="clock"
              variant="ghost"
              onPress={() => router.push({ pathname: '/log-time', params: { categoryId: cat.id } })}
              style={{ height: 54 }}
            />
          </View>
          <PillButton
            label={stats.today > 0 ? `Take one away (today: ${stats.today})` : 'Nothing to take away today'}
            icon="minus"
            variant="ghost"
            disabled={stats.today === 0}
            onPress={removeOne}
            style={{ height: 50, marginTop: 10 }}
          />
        </View>

        {/* numbers */}
        <View style={styles.grid}>
          <StatCard label="Today" value={String(stats.today)} delta={dT.text} deltaLabel="vs yday" color={dT.color} />
          <StatCard
            label="This week"
            value={String(stats.week)}
            delta={dW.text}
            deltaLabel="vs last"
            color={dW.color}
          />
          <StatCard
            label="This month"
            value={String(stats.month)}
            delta={dM.text}
            deltaLabel="vs last"
            color={dM.color}
          />
        </View>
        <Text variant="caption" tone="faint" style={{ paddingHorizontal: 24, marginTop: 6 }}>
          Arrows compare with the same point in the previous day, week and month.
        </Text>
        <View style={[styles.grid, { marginTop: 10 }]}>
          <StatCard
            label="All time"
            value={String(stats.allTime)}
            delta={stats.first ? `since ${stats.first.getDate()} ${MONTHS_SHORT[stats.first.getMonth()]}` : undefined}
            color={t.inkFaint}
          />
          <StatCard label="Per day" value={(last30 / daysTracked).toFixed(1)} delta="last 30 days" color={t.inkFaint} />
          {goal === 'less' ? (
            <StatCard
              label="Best break"
              value={formatDuration(gp.longestMs)}
              delta={gp.longestTo === null && events.length ? 'happening now' : 'record'}
              color={gp.longestTo === null && events.length ? t.good : t.inkFaint}
            />
          ) : (
            <StatCard label="Streak" value={`${st.current}d`} delta={`best ${st.longest}d`} color={t.inkFaint} />
          )}
        </View>

        {/* when */}
        <View style={styles.section}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text variant="heading">When it happens</Text>
          </View>
          <View style={[styles.row, { gap: 8, marginTop: 12 }]}>
            {RANGES.map((r) => (
              <Chip key={r.key} label={r.label} active={range === r.key} onPress={() => setRange(r.key)} />
            ))}
          </View>
          <View
            style={[
              styles.card,
              {
                backgroundColor: t.surface,
                borderColor: t.line,
                alignItems: 'center',
                paddingVertical: 20,
                marginTop: 12,
              },
            ]}>
            <ClockChart values={hours} size={clockSize} swatch={sw}>
              {usual !== null && ranged.length ? (
                <>
                  <Text variant="eyebrow" tone="faint">
                    usually
                  </Text>
                  <Text style={{ fontFamily: font.display, fontSize: 30, lineHeight: 34, color: t.ink }}>
                    {formatHour(usual)}
                  </Text>
                </>
              ) : (
                <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
                  No entries in this range
                </Text>
              )}
            </ClockChart>
            {ranged.length > 0 && (
              <Text variant="body" tone="soft" style={{ textAlign: 'center', marginTop: 14, paddingHorizontal: 16 }}>
                Busiest hour: {formatHour(argmax(hours))}–{formatHour(argmax(hours) + 1)} ({hours[argmax(hours)]} of{' '}
                {ranged.length})
              </Text>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, padding: 16, marginTop: 12 }]}>
            <Text variant="label" tone="soft" style={{ marginBottom: 10 }}>
              {ranged.length
                ? `${WEEKDAYS_LONG[[1, 2, 3, 4, 5, 6, 0][argmax(weekdays)]]}s are the busiest`
                : 'Days of the week'}
            </Text>
            <Bars
              values={weekdays}
              labels={[1, 2, 3, 4, 5, 6, 0].map((i) => WEEKDAYS_SHORT[i])}
              color={sw.deep}
              highlight={ranged.length ? argmax(weekdays) : undefined}
              showValues
              height={130}
            />
          </View>
        </View>

        {/* calendar */}
        <View style={styles.section}>
          <Text variant="heading">Every day, lately</Text>
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, padding: 16, marginTop: 12 }]}>
            <Heatmap events={events} swatch={sw} now={now} />
          </View>
        </View>

        {/* history */}
        <View style={styles.section}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text variant="heading">History</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/ask', params: { about: cat.name } })}
              style={[styles.row, { gap: 6 }]}>
              <Icon name="sparkle" size={14} color={t.inkSoft} />
              <Text variant="label" tone="soft">
                Ask about {cat.name}
              </Text>
            </Pressable>
          </View>
          {history.length === 0 && (
            <Text variant="body" tone="faint" style={{ marginTop: 12 }}>
              Your entries will appear here, with the exact date and time of each one.
            </Text>
          )}
          {history.slice(0, daysShown).map((g) => (
            <Animated.View
              key={g.key}
              layout={LinearTransition}
              entering={FadeIn}
              style={[styles.day, { borderBottomColor: t.line }]}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Text variant="bodyStrong">{formatDayLabel(g.date, now)}</Text>
                <Text variant="label" tone="faint">
                  {g.items.length} {g.items.length === 1 ? 'time' : 'times'}
                </Text>
              </View>
              <View style={styles.times}>
                {[...g.items].reverse().map((e) => (
                  <Pressable
                    key={e.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatTime(new Date(e.occurredAt))}${e.place ? `, near ${e.place}` : ''}. Options`}
                    onPress={() => onEvent(e)}
                    style={({ pressed }) => [
                      styles.time,
                      { backgroundColor: pressed ? t.surfaceAlt : t.surface, borderColor: t.line },
                    ]}>
                    <View style={[styles.dot, { backgroundColor: sw.deep }]} />
                    <Text variant="label">{formatTime(new Date(e.occurredAt))}</Text>
                    {e.place ? <Icon name="pin" size={12} color={t.inkFaint} /> : null}
                    {e.source === 'manual' ? <Icon name="clock" size={12} color={t.inkFaint} /> : null}
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          ))}
          {history.length > daysShown && (
            <PillButton
              variant="ghost"
              label="Show more days"
              onPress={() => setDaysShown((n) => n + 14)}
              style={{ marginTop: 16, height: 48 }}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 6 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, marginTop: 4 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  since: { marginHorizontal: 16, marginTop: 20, padding: 20 },
  grid: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 16 },
  stat: {
    flex: 1,
    borderRadius: radius.md + 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 12,
    minHeight: 104,
  },
  section: { paddingHorizontal: 16, marginTop: 30 },
  day: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
