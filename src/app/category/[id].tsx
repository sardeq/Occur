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
import { useCategory } from '@/hooks/use-categories';
import { useNow } from '@/hooks/use-now';
import { insightsStrings } from '@/i18n/insights';
import { useLang, useStrings } from '@/lib/i18n';
import { argmax, gaps, hourHistogram, inRange, periodStats, streaks, typicalHour, weekdayHistogram } from '@/lib/stats';
import { localizePlace } from '@/lib/demo';
import { showActionSheet } from '@/lib/dialog';
import { deleteEvent, logEvent, removeLatestToday, useData } from '@/lib/store';
import {
  DAY,
  WEEKDAYS_SHORT,
  addDays,
  dayKey,
  formatDate,
  formatDayLabel,
  formatDuration,
  formatHour,
  formatTime,
  monthShort,
  startOfDay,
  weekdayInitial,
  weekdayLong,
} from '@/lib/time';
import type { Goal, OccurEvent } from '@/lib/types';
import { font, radius, useTheme, type Theme } from '@/theme';
import { alpha, swatch } from '@/theme/palette';

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
  { key: '30', label: 'days30', days: 30 },
  { key: '90', label: 'days90', days: 90 },
  { key: 'all', label: 'allTime', days: 0 },
] as const;

export default function CategoryScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const S = useStrings(insightsStrings);
  const lang = useLang();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cat = useCategory(id);
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
    return { text: d === 0 ? S.same : `${d > 0 ? '↑' : '↓'} ${Math.abs(d)}`, color: deltaTone(goal, d, t) };
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
    const title = S.dayAt(formatDate(d, now), formatTime(d));
    const message = e.place ? S.near(localizePlace(e.place, lang)) : undefined;
    const edit = () => router.push({ pathname: '/log-time', params: { categoryId: cat.id, eventId: e.id } });
    const del = () => {
      deleteEvent(e.id);
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    };
    showActionSheet(title, message, [
      { label: S.changeTime, onPress: edit },
      { label: S.deleteEntry, style: 'destructive', onPress: del },
      { label: S.cancel, style: 'cancel' },
    ]);
  };

  const clockSize = Math.min(width - 72, 300);
  const lastEvent = events[events.length - 1];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
        <NavButton icon="back" label={S.back} accessibilityLabel={S.backA11y} onPress={() => router.back()} />
        <NavButton
          icon="pencil"
          label={S.edit}
          accessibilityLabel={S.editA11y(cat.name)}
          onPress={() => router.push({ pathname: '/edit-category', params: { id: cat.id } })}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* hero */}
        <View style={styles.hero}>
          <Pressable onPress={logNow} accessibilityRole="button" accessibilityLabel={S.logNowA11y(cat.name)}>
            <Bubble size={92} swatch={sw} emoji={cat.emoji} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text variant="title" style={{ fontSize: 34, lineHeight: 40 }} numberOfLines={2}>
              {cat.name}
            </Text>
            <View style={[styles.row, { gap: 8, marginTop: 6 }]}>
              <View style={[styles.tag, { backgroundColor: t.surfaceAlt }]}>
                <Text variant="caption" tone="soft" style={{ fontFamily: font.bold }}>
                  {S.goalLabel[goal]}
                </Text>
              </View>
              {cat.trackLocation && (
                <View style={[styles.tag, styles.row, { backgroundColor: t.surfaceAlt, gap: 4 }]}>
                  <Icon name="pin" size={12} color={t.inkSoft} />
                  <Text variant="caption" tone="soft" style={{ fontFamily: font.bold }}>
                    {S.placesOn}
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
            {goal === 'less' ? S.timeSince : S.lastTime}
          </Text>
          {lastEvent ? (
            <>
              <Since last={new Date(lastEvent.occurredAt)} suffix={goal === 'less' ? undefined : S.ago} />
              <Text variant="body" tone="soft">
                {S.dayAt(
                  formatDayLabel(new Date(lastEvent.occurredAt), now),
                  formatTime(new Date(lastEvent.occurredAt)),
                )}
                {lastEvent.place ? S.nearSuffix(localizePlace(lastEvent.place, lang)) : ''}
              </Text>
            </>
          ) : (
            <Text variant="heading" style={{ marginTop: 6 }}>
              {S.nothingYet}
            </Text>
          )}
          <View style={[styles.row, { gap: 10, marginTop: 16 }]}>
            <PillButton label={S.addOne} icon="plus" onPress={logNow} style={{ flex: 1, height: 54 }} />
            <PillButton
              label={S.earlier}
              icon="clock"
              variant="ghost"
              onPress={() => router.push({ pathname: '/log-time', params: { categoryId: cat.id } })}
              style={{ height: 54 }}
            />
          </View>
          <PillButton
            label={stats.today > 0 ? S.takeAway(stats.today) : S.nothingToTake}
            icon="minus"
            variant="ghost"
            disabled={stats.today === 0}
            onPress={removeOne}
            style={{ height: 50, marginTop: 10 }}
          />
        </View>

        {/* numbers */}
        <View style={styles.grid}>
          <StatCard
            label={S.today}
            value={String(stats.today)}
            delta={dT.text}
            deltaLabel={S.vsYday}
            color={dT.color}
          />
          <StatCard
            label={S.thisWeek}
            value={String(stats.week)}
            delta={dW.text}
            deltaLabel={S.vsLast}
            color={dW.color}
          />
          <StatCard
            label={S.thisMonth}
            value={String(stats.month)}
            delta={dM.text}
            deltaLabel={S.vsLast}
            color={dM.color}
          />
        </View>
        <Text variant="caption" tone="faint" style={{ paddingHorizontal: 24, marginTop: 6 }}>
          {S.arrowsHint}
        </Text>
        <View style={[styles.grid, { marginTop: 10 }]}>
          <StatCard
            label={S.allTime}
            value={String(stats.allTime)}
            delta={stats.first ? S.since(stats.first.getDate(), monthShort(stats.first.getMonth())) : undefined}
            color={t.inkFaint}
          />
          <StatCard label={S.perDay} value={(last30 / daysTracked).toFixed(1)} delta={S.last30} color={t.inkFaint} />
          {goal === 'less' ? (
            <StatCard
              label={S.bestBreak}
              value={formatDuration(gp.longestMs)}
              delta={gp.longestTo === null && events.length ? S.happeningNow : S.record}
              color={gp.longestTo === null && events.length ? t.good : t.inkFaint}
            />
          ) : (
            <StatCard label={S.streak} value={S.days(st.current)} delta={S.best(st.longest)} color={t.inkFaint} />
          )}
        </View>

        {/* when */}
        <View style={styles.section}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text variant="heading">{S.whenItHappens}</Text>
          </View>
          <View style={[styles.row, { gap: 8, marginTop: 12 }]}>
            {RANGES.map((r) => (
              <Chip key={r.key} label={S[r.label]} active={range === r.key} onPress={() => setRange(r.key)} />
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
                    {S.usually}
                  </Text>
                  <Text style={{ fontFamily: font.display, fontSize: 30, lineHeight: 34, color: t.ink }}>
                    {formatHour(usual)}
                  </Text>
                </>
              ) : (
                <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
                  {S.noEntriesRange}
                </Text>
              )}
            </ClockChart>
            {ranged.length > 0 && (
              <Text variant="body" tone="soft" style={{ textAlign: 'center', marginTop: 14, paddingHorizontal: 16 }}>
                {S.busiestHour(
                  formatHour(argmax(hours)),
                  formatHour(argmax(hours) + 1),
                  hours[argmax(hours)],
                  ranged.length,
                )}
              </Text>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, padding: 16, marginTop: 12 }]}>
            <Text variant="label" tone="soft" style={{ marginBottom: 10 }}>
              {ranged.length ? S.busiestWeekday(weekdayLong([1, 2, 3, 4, 5, 6, 0][argmax(weekdays)])) : S.daysOfWeek}
            </Text>
            <Bars
              values={weekdays}
              labels={[1, 2, 3, 4, 5, 6, 0].map((i) => (lang === 'ar' ? weekdayInitial(i) : WEEKDAYS_SHORT[i]))}
              color={sw.deep}
              highlight={ranged.length ? argmax(weekdays) : undefined}
              showValues
              height={130}
            />
          </View>
        </View>

        {/* calendar */}
        <View style={styles.section}>
          <Text variant="heading">{S.everyDay}</Text>
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, padding: 16, marginTop: 12 }]}>
            <Heatmap events={events} swatch={sw} now={now} />
          </View>
        </View>

        {/* history */}
        <View style={styles.section}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text variant="heading">{S.history}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/ask', params: { about: cat.name } })}
              style={[styles.row, { gap: 6 }]}>
              <Icon name="sparkle" size={14} color={t.inkSoft} />
              <Text variant="label" tone="soft">
                {S.askAbout(cat.name)}
              </Text>
            </Pressable>
          </View>
          {history.length === 0 && (
            <Text variant="body" tone="faint" style={{ marginTop: 12 }}>
              {S.historyEmpty}
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
                  {S.times(g.items.length)}
                </Text>
              </View>
              <View style={styles.times}>
                {[...g.items].reverse().map((e) => (
                  <Pressable
                    key={e.id}
                    accessibilityRole="button"
                    accessibilityLabel={S.timeA11y(formatTime(new Date(e.occurredAt)), e.place ? localizePlace(e.place, lang) : e.place)}
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
              label={S.showMore}
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
