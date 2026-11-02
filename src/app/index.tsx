import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddBubble, Bubble } from '@/components/bubble';
import { RoundButton, tapHaptic } from '@/components/buttons';
import { EmptyState } from '@/components/empty-state';
import { FilterBar } from '@/components/filter-bar';
import { FocusCard, MixCard } from '@/components/filter-card';
import { Icon, type IconName } from '@/components/icon';
import { TapBubble } from '@/components/tap-bubble';
import { Text } from '@/components/text';
import { useNow } from '@/hooks/use-now';
import { homeStrings } from '@/i18n/home';
import { useAuth } from '@/lib/auth';
import { useLang, useStrings } from '@/lib/i18n';
import {
  applyFilter,
  focusTiles,
  goalsInUse,
  mixLine,
  quietLine,
  rangeSeries,
  rangeWord,
  sinceShort,
  statFor,
  summarize,
  type HomeRange,
  type Lens,
} from '@/lib/home-filter';
import { pack, radiusFor } from '@/lib/packing';
import { setPref, usePrefs } from '@/lib/prefs';
import { addCategory, logEvent, removeLatestToday, useData, type CategoryInput } from '@/lib/store';
import { isSuggestionUsed, localSuggestions } from '@/lib/suggestions';
import { DAY, formatTime, startOfDay } from '@/lib/time';
import type { Category } from '@/lib/types';
import { font, radius, useTheme } from '@/theme';
import { swatch } from '@/theme/palette';

const ADD = '__add__';
/** show the "more ideas" strip until the home screen has this many bubbles */
const IDEAS_UNTIL = 4;
/** height of the bottom "Ask" pill and its + button */
const ASK_H = 46;

const haptic = (type: 'log' | 'remove') => {
  if (Platform.OS === 'web') return;
  if (type === 'log') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
};

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const categories = useData((s) => s.categories);
  const events = useData((s) => s.events);
  const pending = useData((s) => s.queue.length);
  const syncError = useData((s) => s.syncError);
  const user = useAuth((s) => s.user);
  const homeStyle = usePrefs((s) => s.homeStyle);
  const tipsOn = usePrefs((s) => s.tips);
  const lang = useLang();
  const str = useStrings(homeStrings);

  const [field, setField] = useState({ w: 0, h: 0 });
  const [pulses, setPulses] = useState<Record<string, number>>({});
  const [minusPulses, setMinusPulses] = useState<Record<string, number>>({});
  // filter bar: period the bubbles count over + what's shown
  const [range, setRange] = useState<HomeRange>('today');
  const [lens, setLens] = useState<Lens | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const d0 = startOfDay(now).getTime();
  const bottomBarH = ASK_H + insets.bottom + 18;

  // One pass over the log: today's times per category + 14-day usage weights.
  const { todayHours, todayCounts, lastToday, weights } = useMemo(() => {
    const todayHours: Record<string, number[]> = {};
    const lastToday: Record<string, Date> = {};
    const weights: Record<string, number> = {};
    const from = d0 - 14 * DAY;
    for (const e of events) {
      const ts = Date.parse(e.occurredAt);
      if (ts >= d0) {
        const d = new Date(ts);
        (todayHours[e.categoryId] ??= []).push(d.getHours() + d.getMinutes() / 60);
        lastToday[e.categoryId] = d;
      } else if (ts >= from) {
        weights[e.categoryId] = (weights[e.categoryId] ?? 0) + 1;
      }
    }
    const todayCounts = Object.fromEntries(Object.entries(todayHours).map(([k, v]) => [k, v.length]));
    return { todayHours, todayCounts, lastToday, weights };
  }, [events, d0]);

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // ---- filter bar ----
  const byCat = useMemo(() => summarize(events, range, now), [events, range, now]);
  const pickedIds = useMemo(() => picked.filter((id) => byId.has(id)), [picked, byId]);
  const filtering = lens !== null || pickedIds.length > 0;
  // text helpers take `lang` so memos refresh when the language changes
  const word = useMemo(() => rangeWord(range, lang), [range, lang]);
  // Bubble size: 14-day habit for "Today", otherwise the period so far minus
  // today — either way it doesn't change while you're tapping.
  const sizeWeights = useMemo(
    () => (range === 'today' ? weights : Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, v.before]))),
    [range, weights, byCat],
  );
  /** stable order for chips: most-used first */
  const ordered = useMemo(
    () =>
      [...categories].sort(
        (a, b) => (weights[b.id] ?? 0) - (weights[a.id] ?? 0) || a.createdAt.localeCompare(b.createdAt),
      ),
    [categories, weights],
  );
  const visible = useMemo(() => applyFilter(categories, byCat, lens, pickedIds), [categories, byCat, lens, pickedIds]);
  const counts = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, statFor(byCat, c.id).count])),
    [categories, byCat],
  );
  const goals = useMemo(() => goalsInUse(categories), [categories]);
  const focus = pickedIds.length === 1 ? byId.get(pickedIds[0]) : undefined;
  const focusData = useMemo(() => {
    if (!focus) return null;
    const evs = events.filter((e) => e.categoryId === focus.id);
    return {
      tiles: focusTiles(evs, focus, statFor(byCat, focus.id), range, now, lang),
      series: rangeSeries(evs, range, now),
    };
  }, [focus, events, byCat, range, now, lang]);
  const mix = useMemo(() => {
    if (focus || !categories.length) return null;
    if (lens === 'quiet') {
      const line = quietLine(
        visible.map((c) => ({ category: c, last: statFor(byCat, c.id).last })),
        now,
        lang,
      );
      return { items: [], line };
    }
    if (pickedIds.length < 2 && !lens && range === 'today') return null;
    const items = visible.map((c) => ({ category: c, count: statFor(byCat, c.id).count }));
    return { items, line: mixLine(items, events, range, now, lang) };
  }, [focus, categories.length, lens, pickedIds.length, range, visible, byCat, events, now, lang]);

  const pick = (id: string) => {
    setLens(null);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  const chooseLens = (l: Lens) => {
    setPicked([]);
    setLens((cur) => (cur === l ? null : l));
  };
  const clearFilter = () => {
    setLens(null);
    setPicked([]);
  };

  const usedNames = useMemo(() => new Set(categories.map((c) => c.name.trim().toLowerCase())), [categories]);
  const moreIdeas = useMemo(
    () =>
      !filtering && categories.length > 0 && categories.length < IDEAS_UNTIL
        ? localSuggestions(lang)
            .filter((s) => !isSuggestionUsed(s, usedNames))
            .slice(0, 8)
        : [],
    [filtering, categories.length, usedNames, lang],
  );
  const ideasH = moreIdeas.length ? 72 : 0;

  // Layout only depends on what's shown + earlier days' weights, so bubbles
  // never jump around while you're tapping them.
  const layout = useMemo(() => {
    if (!field.w || !visible.length) return null;
    const viewH = field.h - bottomBarH - ideasH + 30;
    const maxW = Math.max(0, ...visible.map((c) => sizeWeights[c.id] ?? 0));
    const items = [...visible]
      .sort((a, b) => (sizeWeights[b.id] ?? 0) - (sizeWeights[a.id] ?? 0) || a.createdAt.localeCompare(b.createdAt))
      .map((c) => ({
        id: c.id,
        r:
          visible.length === 1
            ? Math.max(60, Math.min(field.w * 0.3, viewH * 0.36))
            : radiusFor(sizeWeights[c.id] ?? 0, maxW, field.w, visible.length),
      }));
    if (!filtering) items.push({ id: ADD, r: Math.max(46, field.w * 0.11) });
    return pack(items, field.w, viewH, { gap: 16, pad: 18 });
  }, [visible, filtering, sizeWeights, field.w, field.h, bottomBarH, ideasH]);

  const nowHour = now.getHours() + now.getMinutes() / 60;

  const onLog = (c: Category) => {
    logEvent(c.id);
    haptic('log');
    setPulses((p) => ({ ...p, [c.id]: (p[c.id] ?? 0) + 1 }));
  };

  const onRemove = (c: Category) => {
    const e = removeLatestToday(c.id, new Date());
    if (!e) return;
    haptic('remove');
    setMinusPulses((p) => ({ ...p, [c.id]: (p[c.id] ?? 0) + 1 }));
  };

  const openCategory = (c: Category) => router.push({ pathname: '/category/[id]', params: { id: c.id } });
  const openAdd = () => {
    tapHaptic();
    router.push('/add');
  };

  const quickAdd = (s: CategoryInput) => {
    addCategory(s);
  };

  const onFieldLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.round(width) !== field.w || Math.round(height) !== field.h)
      setField({ w: Math.round(width), h: Math.round(height) });
  };

  const emptyFilterMsg = lens === 'quiet' ? str.emptyQuiet(word) : str.emptyNothing(word);
  const offline = !!syncError && pending > 0;
  const showTips = tipsOn && categories.length > 0;

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      {/* header: just the buttons — the bubbles are the headline */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={{ flex: 1 }}>
          {pending > 0 && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              accessible
              accessibilityLabel={offline ? str.syncOffline : str.syncing}
              style={[styles.syncDot, { backgroundColor: t.surface, borderColor: t.line }]}>
              <Icon name={offline ? 'cloudOff' : 'cloud'} size={15} color={t.inkFaint} />
            </Animated.View>
          )}
        </View>
        <View style={[styles.row, { gap: 10 }]}>
          <HeaderButton icon="chart" label={str.insights} onPress={() => router.push('/insights')} />
          <HeaderButton label={str.settings} a11y={str.settingsA11y} onPress={() => router.push('/settings')}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={{ width: 44, height: 44 }} contentFit="cover" />
            ) : (
              <Icon name="gear" size={20} color={t.ink} />
            )}
          </HeaderButton>
        </View>
      </View>

      {categories.length > 0 && (
        <FilterBar
          range={range}
          onRange={setRange}
          lens={lens}
          onLens={chooseLens}
          picked={pickedIds}
          onPick={pick}
          onClear={clearFilter}
          categories={ordered}
          counts={counts}
          goals={goals}
        />
      )}
      {focus && focusData && (
        <FocusCard
          key={focus.id}
          category={focus}
          tiles={focusData.tiles}
          series={focusData.series}
          onOpen={() => openCategory(focus)}
        />
      )}
      {mix && <MixCard items={mix.items} line={mix.line} />}

      {showTips && !filtering && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          style={[styles.tips, { backgroundColor: t.surface, borderColor: t.line }]}>
          <View style={[styles.row, { gap: 6 }]}>
            <Icon name="sparkle" size={13} color={t.inkSoft} />
            <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 13, color: t.inkSoft }}>{str.tips}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={str.hideTipsA11y}
              hitSlop={10}
              onPress={() => {
                tapHaptic();
                setPref('tips', false);
              }}
              style={({ pressed }) => [
                styles.tipsClose,
                { backgroundColor: t.surfaceAlt, opacity: pressed ? 0.6 : 1 },
              ]}>
              <Icon name="close" size={11} color={t.inkSoft} strokeWidth={2.6} />
            </Pressable>
          </View>
          <Tip icon="plus" text={homeStyle === 'list' ? str.tipAddList : str.tipAddBubbles} />
          <Tip icon="minus" text={homeStyle === 'list' ? str.tipRemoveList : str.tipRemoveBubbles} />
          <Tip icon="chevron" text={homeStyle === 'list' ? str.tipOpenList : str.tipOpenBubbles} />
        </Animated.View>
      )}

      {/* content */}
      <View style={{ flex: 1 }} onLayout={onFieldLayout}>
        {field.w > 0 && categories.length === 0 && (
          <EmptyState
            width={field.w}
            height={field.h - bottomBarH + 20}
            onCreate={() => router.push('/edit-category')}
            onQuickAdd={quickAdd}
          />
        )}

        {categories.length > 0 && filtering && visible.length === 0 && (
          <Animated.View entering={FadeIn.duration(180)} style={[styles.filterEmpty, { paddingBottom: bottomBarH }]}>
            <Text style={{ fontSize: 40, lineHeight: 50 }}>{lens === 'quiet' ? '🎉' : '🫧'}</Text>
            <Text variant="subheading" style={{ textAlign: 'center', marginTop: 6 }}>
              {emptyFilterMsg}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                tapHaptic();
                clearFilter();
              }}
              hitSlop={8}
              style={({ pressed }) => [
                styles.filterEmptyBtn,
                { borderColor: t.lineStrong, opacity: pressed ? 0.6 : 1 },
              ]}>
              <Text variant="label">{str.showEverything}</Text>
            </Pressable>
          </Animated.View>
        )}

        {homeStyle === 'list' && categories.length > 0 && (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: bottomBarH + 30, gap: 10 }}
            showsVerticalScrollIndicator={false}>
            {visible.map((c) => (
              <ListRow
                key={c.id}
                category={c}
                count={statFor(byCat, c.id).count}
                todayCount={todayCounts[c.id] ?? 0}
                periodWord={word}
                last={lastToday[c.id]}
                onAdd={() => onLog(c)}
                onRemove={() => onRemove(c)}
                onOpen={() => openCategory(c)}
              />
            ))}
            {!filtering && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={str.addSomething}
                onPress={openAdd}
                style={({ pressed }) => [styles.addRow, { borderColor: t.lineStrong, opacity: pressed ? 0.7 : 1 }]}>
                <Icon name="plus" size={22} color={t.ink} strokeWidth={2.3} />
                <Text variant="bodyStrong">{str.addSomething}</Text>
              </Pressable>
            )}
          </ScrollView>
        )}

        {homeStyle === 'bubbles' && layout && (
          <ScrollView
            contentContainerStyle={{ height: layout.height + bottomBarH + ideasH - 30 }}
            scrollIndicatorInsets={{ bottom: bottomBarH }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={layout.height > field.h - bottomBarH - ideasH + 30}>
            {layout.placed.map((p) => {
              if (p.id === ADD) {
                return (
                  <Animated.View
                    key={ADD}
                    layout={LinearTransition.springify()}
                    style={{ position: 'absolute', left: p.x - p.r, top: p.y - p.r }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={str.addSomething}
                      onPress={openAdd}
                      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.93 : 1 }] })}>
                      <AddBubble size={p.r * 2} color={t.inkSoft} label={str.add} />
                    </Pressable>
                  </Animated.View>
                );
              }
              const c = byId.get(p.id);
              if (!c) return null;
              const count = todayCounts[c.id] ?? 0;
              const st = statFor(byCat, c.id);
              const quiet = lens === 'quiet';
              const sinceMs = st.last === null ? null : now.getTime() - st.last;
              return (
                <TapBubble
                  key={c.id}
                  id={c.id}
                  x={p.x}
                  y={p.y}
                  size={p.r * 2}
                  swatch={swatch(c.color)}
                  emoji={c.emoji}
                  name={c.name}
                  count={quiet ? (sinceMs === null ? '–' : sinceShort(sinceMs)) : st.count}
                  todayCount={count}
                  dimCount={quiet ? sinceMs === null : st.count === 0}
                  dots={range === 'today' ? (todayHours[c.id] ?? []) : undefined}
                  nowHour={range === 'today' ? nowHour : undefined}
                  pulse={pulses[c.id] ?? 0}
                  minusPulse={minusPulses[c.id] ?? 0}
                  label={
                    quiet
                      ? sinceMs === null
                        ? str.bubbleNever(c.name)
                        : str.bubbleLastAgo(c.name, sinceShort(sinceMs))
                      : str.countIn(c.name, st.count, word)
                  }
                  onLog={() => onLog(c)}
                  onRemove={() => onRemove(c)}
                  onOpen={() => openCategory(c)}
                />
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* bottom bar */}
      <View pointerEvents="box-none" style={[styles.bottom, { paddingBottom: insets.bottom + 10 }]}>
        <LinearGradient
          pointerEvents="none"
          colors={[t.bg + '00', t.bg]}
          style={StyleSheet.absoluteFill}
          locations={[0, 0.4]}
        />

        {homeStyle === 'bubbles' && moreIdeas.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text
              style={{
                fontFamily: font.semibold,
                fontSize: 13,
                color: t.inkSoft,
                paddingHorizontal: 20,
                marginBottom: 6,
              }}>
              {str.moreIdeas}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
              {moreIdeas.map((s) => (
                <Pressable
                  key={s.name}
                  accessibilityRole="button"
                  accessibilityLabel={str.addName(s.name)}
                  onPress={() => {
                    tapHaptic();
                    quickAdd(s);
                  }}
                  style={({ pressed }) => [
                    styles.idea,
                    { backgroundColor: t.surface, borderColor: t.line, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <Text style={{ fontSize: 15 }}>{s.emoji}</Text>
                  <Text variant="label">{s.name}</Text>
                  <Icon name="plus" size={13} color={t.inkSoft} strokeWidth={2.6} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={[styles.row, { gap: 8, paddingHorizontal: 16 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={str.askA11y}
            onPress={() => {
              tapHaptic();
              router.push('/ask');
            }}
            style={({ pressed }) => [
              styles.ask,
              { backgroundColor: t.pill, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}>
            <Icon name="sparkle" size={15} color={t.pillInk} />
            <Text style={{ fontFamily: font.displaySoft, fontSize: 16, color: t.pillInk }} numberOfLines={1}>
              {str.askPlaceholder}
            </Text>
          </Pressable>
          <RoundButton icon="plus" label={str.addSomething} size={ASK_H} tone="glass" onPress={openAdd} />
        </View>
      </View>
    </View>
  );
}

/** Round icon button; its name is read out by screen readers. */
function HeaderButton({
  icon,
  label,
  a11y,
  onPress,
  children,
}: {
  icon?: IconName;
  label: string;
  a11y?: string;
  onPress: () => void;
  children?: ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      hitSlop={6}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.headerBtn, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
      <View style={[styles.headerDisc, { backgroundColor: t.surface, borderColor: t.line }]}>
        {children ?? (icon ? <Icon name={icon} size={20} color={t.ink} /> : null)}
      </View>
    </Pressable>
  );
}

function Tip({ icon, text }: { icon: IconName; text: string }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { gap: 8 }]}>
      <View style={[styles.tipIcon, { backgroundColor: t.surfaceAlt }]}>
        <Icon name={icon} size={11} color={t.ink} strokeWidth={2.8} />
      </View>
      <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 13, lineHeight: 17, color: t.inkSoft }}>{text}</Text>
    </View>
  );
}

/** List-style home row: big − and + buttons either side of today's count. */
function ListRow({
  category,
  count,
  todayCount,
  periodWord,
  last,
  onAdd,
  onRemove,
  onOpen,
}: {
  category: Category;
  /** in the selected period */
  count: number;
  todayCount: number;
  periodWord: string;
  last?: Date;
  onAdd: () => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const t = useTheme();
  const str = useStrings(homeStrings);
  const sw = swatch(category.color);
  return (
    <View style={[styles.listRow, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={str.rowA11y(category.name, count, periodWord)}
        onPress={onOpen}
        style={({ pressed }) => [styles.row, { flex: 1, gap: 12, opacity: pressed ? 0.6 : 1 }]}>
        <Bubble size={48} swatch={sw} emoji={category.emoji} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {category.name}
          </Text>
          <Text variant="caption" tone="soft" numberOfLines={1}>
            {last ? str.lastAt(formatTime(last)) : str.noneToday}
          </Text>
        </View>
      </Pressable>
      <View style={[styles.row, { gap: 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={str.takeOneAway(category.name)}
          disabled={todayCount === 0}
          onPress={onRemove}
          hitSlop={4}
          style={({ pressed }) => [
            styles.stepBtn,
            {
              borderColor: t.lineStrong,
              backgroundColor: t.bg,
              opacity: todayCount === 0 ? 0.35 : pressed ? 0.6 : 1,
            },
          ]}>
          <Icon name="minus" size={22} color={t.ink} strokeWidth={2.6} />
        </Pressable>
        <Text
          accessibilityLabel={str.countA11y(count, periodWord)}
          style={{ fontFamily: font.display, fontSize: 26, color: t.ink, minWidth: 34, textAlign: 'center' }}>
          {count}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={str.addOne(category.name)}
          onPress={onAdd}
          hitSlop={4}
          style={({ pressed }) => [
            styles.stepBtn,
            { backgroundColor: sw.base, borderColor: sw.deep, transform: [{ scale: pressed ? 0.92 : 1 }] },
          ]}>
          <Icon name="plus" size={22} color={sw.ink} strokeWidth={2.6} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 4, zIndex: 2 },
  headerBtn: { alignItems: 'center' },
  headerDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  syncDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsClose: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tips: {
    marginHorizontal: 16,
    marginTop: 6,
    zIndex: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  tipIcon: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 28 },
  ask: {
    flex: 1,
    height: ASK_H,
    borderRadius: ASK_H / 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 8,
  },
  idea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  stepBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  filterEmptyBtn: {
    marginTop: 14,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 64,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
});
