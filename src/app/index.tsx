import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddBubble, Bubble } from '@/components/bubble';
import { tapHaptic } from '@/components/buttons';
import { EmptyState } from '@/components/empty-state';
import { FilterBar } from '@/components/filter-bar';
import { Icon, type IconName } from '@/components/icon';
import { TapBubble } from '@/components/tap-bubble';
import { Text } from '@/components/text';
import { useCategories } from '@/hooks/use-categories';
import { useNow } from '@/hooks/use-now';
import { homeStrings } from '@/i18n/home';
import { useAuth } from '@/lib/auth';
import { useLang, useStrings } from '@/lib/i18n';
import { rangeTitle, rangeWord, statFor, summarize, type HomeRange } from '@/lib/home-filter';
import { pack, radiusFor } from '@/lib/packing';
import { setPref, usePrefs } from '@/lib/prefs';
import { addCategory, logEvent, removeLatestToday, useData, type CategoryInput } from '@/lib/store';
import { isSuggestionUsed, localSuggestions } from '@/lib/suggestions';
import { DAY, formatDate, formatTime, startOfDay } from '@/lib/time';
import type { Category } from '@/lib/types';
import { font, radius, useTheme } from '@/theme';
import { alpha, swatch } from '@/theme/palette';

const ADD = '__add__';
/** show the "more ideas" strip until the home screen has this many bubbles */
const IDEAS_UNTIL = 4;
/** height of the bottom "Ask" bar and its + button */
const ASK_H = 52;

const haptic = (type: 'log' | 'remove') => {
  if (Platform.OS === 'web') return;
  if (type === 'log') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
};

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const categories = useCategories();
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
  /** the period the bubbles count over */
  const [range, setRange] = useState<HomeRange>('today');

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
  const byCat = useMemo(() => summarize(events, range, now), [events, range, now]);
  // text helpers take `lang` so memos refresh when the language changes
  const word = useMemo(() => rangeWord(range, lang), [range, lang]);
  const title = useMemo(() => rangeTitle(range, lang), [range, lang]);
  const dateLine = formatDate(now, now);
  const total = useMemo(
    () => categories.reduce((sum, c) => sum + statFor(byCat, c.id).count, 0),
    [categories, byCat],
  );
  // Bubble size: 14-day habit for "Today", otherwise the period so far minus
  // today — either way it doesn't change while you're tapping.
  const sizeWeights = useMemo(
    () => (range === 'today' ? weights : Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, v.before]))),
    [range, weights, byCat],
  );

  const usedNames = useMemo(() => new Set(categories.map((c) => c.name.trim().toLowerCase())), [categories]);
  const moreIdeas = useMemo(
    () =>
      categories.length > 0 && categories.length < IDEAS_UNTIL
        ? localSuggestions(lang)
            .filter((s) => !isSuggestionUsed(s, usedNames))
            .slice(0, 8)
        : [],
    [categories.length, usedNames, lang],
  );
  const ideasH = moreIdeas.length ? 72 : 0;

  // Layout only depends on what's shown + earlier days' weights, so bubbles
  // never jump around while you're tapping them.
  const layout = useMemo(() => {
    if (!field.w || !categories.length) return null;
    const viewH = field.h - bottomBarH - ideasH + 30;
    const maxW = Math.max(0, ...categories.map((c) => sizeWeights[c.id] ?? 0));
    const items = [...categories]
      .sort((a, b) => (sizeWeights[b.id] ?? 0) - (sizeWeights[a.id] ?? 0) || a.createdAt.localeCompare(b.createdAt))
      .map((c) => ({
        id: c.id,
        r:
          categories.length === 1
            ? Math.max(60, Math.min(field.w * 0.3, viewH * 0.36))
            : radiusFor(sizeWeights[c.id] ?? 0, maxW, field.w, categories.length),
      }));
    items.push({ id: ADD, r: Math.max(46, field.w * 0.11) });
    return pack(items, field.w, viewH, { gap: 16, pad: 18 });
  }, [categories, sizeWeights, field.w, field.h, bottomBarH, ideasH]);

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

  const offline = !!syncError && pending > 0;
  const hasAny = categories.length > 0;
  const showTips = tipsOn && hasAny;

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      {/* header: date + period on the start side, buttons on the end side */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 14, color: t.inkFaint }}>
            {dateLine}
          </Text>
          <View style={[styles.row, { gap: 10, marginTop: 2 }]}>
            <Text numberOfLines={1} style={{ fontFamily: font.display, fontSize: 30, lineHeight: 38, color: t.ink }}>
              {hasAny ? title : 'Occur'}
            </Text>
            {hasAny && (
              <View
                accessible
                accessibilityLabel={str.totalA11y(total, word)}
                style={[styles.total, { backgroundColor: alpha(t.accent, 0.12) }]}>
                <Text style={{ fontFamily: font.display, fontSize: 15, color: t.accent }}>{total}</Text>
              </View>
            )}
            {pending > 0 && (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
                accessible
                accessibilityLabel={offline ? str.syncOffline : str.syncing}>
                <Icon name={offline ? 'cloudOff' : 'cloud'} size={16} color={t.inkFaint} />
              </Animated.View>
            )}
          </View>
        </View>
        <View style={[styles.row, { gap: 8 }]}>
          <HeaderButton icon="chart" label={str.insights} onPress={() => router.push('/insights')} />
          <HeaderButton label={str.settings} a11y={str.settingsA11y} onPress={() => router.push('/settings')}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={{ width: 42, height: 42 }} contentFit="cover" />
            ) : (
              <Icon name="gear" size={20} color={t.ink} />
            )}
          </HeaderButton>
        </View>
      </View>

      {hasAny && <FilterBar range={range} onRange={setRange} />}

      {showTips && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          style={[styles.tips, { backgroundColor: t.surface, borderColor: t.line }]}>
          <View style={{ flex: 1, gap: 6 }}>
            <Tip icon="plus" text={homeStyle === 'list' ? str.tipAddList : str.tipAddBubbles} />
            <Tip icon="minus" text={homeStyle === 'list' ? str.tipRemoveList : str.tipRemoveBubbles} />
            <Tip icon="chevron" text={homeStyle === 'list' ? str.tipOpenList : str.tipOpenBubbles} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={str.hideTipsA11y}
            hitSlop={10}
            onPress={() => {
              tapHaptic();
              setPref('tips', false);
            }}
            style={({ pressed }) => [styles.tipsClose, { backgroundColor: t.surfaceAlt, opacity: pressed ? 0.6 : 1 }]}>
            <Icon name="close" size={11} color={t.inkSoft} strokeWidth={2.6} />
          </Pressable>
        </Animated.View>
      )}

      {/* content */}
      <View style={{ flex: 1 }} onLayout={onFieldLayout}>
        {field.w > 0 && !hasAny && (
          <EmptyState
            width={field.w}
            height={field.h - bottomBarH + 20}
            onCreate={() => router.push('/edit-category')}
            onQuickAdd={quickAdd}
          />
        )}

        {homeStyle === 'list' && hasAny && (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: bottomBarH + 30, gap: 10 }}
            showsVerticalScrollIndicator={false}>
            {categories.map((c) => (
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={str.addSomething}
              onPress={openAdd}
              style={({ pressed }) => [styles.addRow, { borderColor: t.lineStrong, opacity: pressed ? 0.7 : 1 }]}>
              <Icon name="plus" size={20} color={t.inkSoft} strokeWidth={2.3} />
              <Text variant="label" tone="soft">
                {str.addSomething}
              </Text>
            </Pressable>
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
                      <AddBubble size={p.r * 2} color={t.inkFaint} label={str.add} />
                    </Pressable>
                  </Animated.View>
                );
              }
              const c = byId.get(p.id);
              if (!c) return null;
              const st = statFor(byCat, c.id);
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
                  count={st.count}
                  todayCount={todayCounts[c.id] ?? 0}
                  dimCount={st.count === 0}
                  dots={range === 'today' ? (todayHours[c.id] ?? []) : undefined}
                  nowHour={range === 'today' ? nowHour : undefined}
                  pulse={pulses[c.id] ?? 0}
                  minusPulse={minusPulses[c.id] ?? 0}
                  label={str.countIn(c.name, st.count, word)}
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
          locations={[0, 0.45]}
        />

        {homeStyle === 'bubbles' && moreIdeas.length > 0 && (
          <View style={{ marginBottom: 10 }}>
            <Text
              style={{
                fontFamily: font.semibold,
                fontSize: 13,
                color: t.inkFaint,
                paddingHorizontal: 20,
                marginBottom: 6,
              }}>
              {str.moreIdeas}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingHorizontal: 20 }}>
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
                  <Icon name="plus" size={13} color={t.inkFaint} strokeWidth={2.6} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={[styles.row, { gap: 10, paddingHorizontal: 20 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={str.askA11y}
            onPress={() => {
              tapHaptic();
              router.push('/ask');
            }}
            style={({ pressed }) => [
              styles.ask,
              {
                backgroundColor: t.surface,
                borderColor: t.line,
                shadowColor: t.shadow,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}>
            <View style={[styles.askIcon, { backgroundColor: alpha(t.accent, 0.12) }]}>
              <Icon name="sparkle" size={15} color={t.accent} />
            </View>
            <Text
              style={{ flex: 1, fontFamily: font.medium, fontSize: 16, color: t.inkFaint }}
              numberOfLines={1}>
              {str.askPlaceholder}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={str.addSomething}
            hitSlop={6}
            onPress={openAdd}
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: t.accent, shadowColor: t.accent, transform: [{ scale: pressed ? 0.94 : 1 }] },
            ]}>
            <Icon name="plus" size={24} color={t.accentInk} strokeWidth={2.4} />
          </Pressable>
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
      style={({ pressed }) => [
        styles.headerDisc,
        { backgroundColor: t.surface, borderColor: t.line, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}>
      {children ?? (icon ? <Icon name={icon} size={20} color={t.ink} /> : null)}
    </Pressable>
  );
}

function Tip({ icon, text }: { icon: IconName; text: string }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { gap: 10 }]}>
      <View style={[styles.tipIcon, { backgroundColor: alpha(t.accent, 0.12) }]}>
        <Icon name={icon} size={11} color={t.accent} strokeWidth={2.8} />
      </View>
      <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: t.inkSoft }}>{text}</Text>
    </View>
  );
}

/** List-style home row: big − and + buttons either side of the count. */
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
        <Bubble size={46} swatch={sw} emoji={category.emoji} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {category.name}
          </Text>
          <Text variant="caption" tone="faint" numberOfLines={1}>
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
            { backgroundColor: t.surfaceAlt, opacity: todayCount === 0 ? 0.35 : pressed ? 0.6 : 1 },
          ]}>
          <Icon name="minus" size={20} color={t.ink} strokeWidth={2.6} />
        </Pressable>
        <Text
          accessibilityLabel={str.countA11y(count, periodWord)}
          style={{ fontFamily: font.display, fontSize: 24, color: t.ink, minWidth: 32, textAlign: 'center' }}>
          {count}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={str.addOne(category.name)}
          onPress={onAdd}
          hitSlop={4}
          style={({ pressed }) => [
            styles.stepBtn,
            { backgroundColor: sw.base, transform: [{ scale: pressed ? 0.92 : 1 }] },
          ]}>
          <Icon name="plus" size={20} color={sw.ink} strokeWidth={2.6} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 12, zIndex: 2 },
  headerDisc: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 2,
  },
  total: { minWidth: 30, height: 26, paddingHorizontal: 9, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tips: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 6,
    zIndex: 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  tipIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tipsClose: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 28 },
  ask: {
    flex: 1,
    height: ASK_H,
    borderRadius: ASK_H / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: 8,
    paddingEnd: 18,
    gap: 10,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  askIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    width: ASK_H,
    height: ASK_H,
    borderRadius: ASK_H / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 60,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
});
