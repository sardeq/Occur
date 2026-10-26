import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddBubble } from '@/components/bubble';
import { RoundButton, tapHaptic } from '@/components/buttons';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { TapBubble } from '@/components/tap-bubble';
import { Text } from '@/components/text';
import { useNow } from '@/hooks/use-now';
import { useAuth } from '@/lib/auth';
import { pack, radiusFor } from '@/lib/packing';
import { addCategory, deleteEvent, logEvent, useData, type CategoryInput } from '@/lib/store';
import { DAY, MONTHS_LONG, WEEKDAYS_LONG, formatTime, numberWord, startOfDay } from '@/lib/time';
import type { Category } from '@/lib/types';
import { font, useTheme } from '@/theme';
import { swatch } from '@/theme/palette';

const ADD = '__add__';

type Toast = { eventId: string; category: Category; at: Date; count: number };

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const categories = useData((s) => s.categories);
  const events = useData((s) => s.events);
  const pending = useData((s) => s.queue.length);
  const syncError = useData((s) => s.syncError);
  const user = useAuth((s) => s.user);

  const [field, setField] = useState({ w: 0, h: 0 });
  const [pulses, setPulses] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<Toast | null>(null);

  const d0 = startOfDay(now).getTime();
  const bottomBarH = 56 + insets.bottom + 24;

  // One pass over the log: today's times per category + 14-day usage weights.
  const { todayHours, todayCounts, weights, total } = useMemo(() => {
    const todayHours: Record<string, number[]> = {};
    const weights: Record<string, number> = {};
    let total = 0;
    const from = d0 - 14 * DAY;
    for (const e of events) {
      const ts = Date.parse(e.occurredAt);
      if (ts >= d0) {
        const d = new Date(ts);
        (todayHours[e.categoryId] ??= []).push(d.getHours() + d.getMinutes() / 60);
        total++;
      } else if (ts >= from) {
        weights[e.categoryId] = (weights[e.categoryId] ?? 0) + 1;
      }
    }
    const todayCounts = Object.fromEntries(Object.entries(todayHours).map(([k, v]) => [k, v.length]));
    return { todayHours, todayCounts, weights, total };
  }, [events, d0]);

  // Layout only depends on categories + yesterday's weights, so bubbles never
  // jump around while you're tapping them.
  const layout = useMemo(() => {
    if (!field.w || !categories.length) return null;
    const maxW = Math.max(0, ...categories.map((c) => weights[c.id] ?? 0));
    const items = [...categories]
      .sort((a, b) => (weights[b.id] ?? 0) - (weights[a.id] ?? 0) || a.createdAt.localeCompare(b.createdAt))
      .map((c) => ({ id: c.id, r: radiusFor(weights[c.id] ?? 0, maxW, field.w, categories.length) }));
    items.push({ id: ADD, r: field.w * 0.095 });
    return pack(items, field.w, field.h - bottomBarH + 30, { gap: 12, pad: 14 });
  }, [categories, weights, field.w, field.h, bottomBarH]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const nowHour = now.getHours() + now.getMinutes() / 60;

  const onLog = (c: Category) => {
    const e = logEvent(c.id);
    setPulses((p) => ({ ...p, [c.id]: (p[c.id] ?? 0) + 1 }));
    setToast({ eventId: e.id, category: c, at: new Date(e.occurredAt), count: (todayCounts[c.id] ?? 0) + 1 });
  };

  const undo = () => {
    if (!toast) return;
    deleteEvent(toast.eventId);
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setToast(null);
  };

  const quickAdd = (s: CategoryInput) => {
    addCategory(s);
  };

  const onFieldLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.round(width) !== field.w || Math.round(height) !== field.h)
      setField({ w: Math.round(width), h: Math.round(height) });
  };

  const dateLine = `${WEEKDAYS_LONG[now.getDay()]}, ${now.getDate()} ${MONTHS_LONG[now.getMonth()]}`;
  const headline =
    total === 0 ? 'Nothing yet today.' : `${numberWord(total)} ${total === 1 ? 'moment' : 'moments'} today.`;
  const offline = !!syncError && pending > 0;

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <Text variant="eyebrow" tone="soft">
              {dateLine}
            </Text>
            {pending > 0 && (
              <View
                accessibilityLabel={offline ? 'Offline, changes saved on device' : 'Syncing'}
                style={{ marginLeft: 8 }}>
                <Icon name={offline ? 'cloudOff' : 'cloud'} size={14} color={t.inkFaint} />
              </View>
            )}
          </View>
          <Text variant="title" style={{ marginTop: 4 }}>
            {categories.length ? headline : 'Hello.'}
          </Text>
          {categories.length > 0 && events.length < 6 && (
            <Text variant="caption" tone="faint" style={{ marginTop: 4 }}>
              Tap a bubble to count it · hold it for details
            </Text>
          )}
        </View>
        <View style={[styles.row, { gap: 8 }]}>
          <RoundButton icon="chart" label="Insights" onPress={() => router.push('/insights')} />
          <RoundButton label="Settings and account" onPress={() => router.push('/settings')}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={{ width: 44, height: 44 }} contentFit="cover" />
            ) : (
              <Text style={{ fontFamily: font.serif, fontSize: 22, color: t.ink }}>
                {(user?.name ?? user?.email ?? 'O').trim().charAt(0).toUpperCase()}
              </Text>
            )}
          </RoundButton>
        </View>
      </View>

      {/* bubble field */}
      <View style={{ flex: 1 }} onLayout={onFieldLayout}>
        {field.w > 0 && categories.length === 0 && (
          <EmptyState
            width={field.w}
            height={field.h - bottomBarH + 20}
            onCreate={() => router.push('/edit-category')}
            onQuickAdd={quickAdd}
          />
        )}
        {layout && (
          <ScrollView
            contentContainerStyle={{ height: layout.height + bottomBarH - 30 }}
            scrollIndicatorInsets={{ bottom: bottomBarH }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={layout.height > field.h - bottomBarH + 30}>
            {layout.placed.map((p) => {
              if (p.id === ADD) {
                return (
                  <Animated.View
                    key={ADD}
                    layout={LinearTransition.springify()}
                    style={{ position: 'absolute', left: p.x - p.r, top: p.y - p.r }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Add something to count"
                      onPress={() => {
                        tapHaptic();
                        router.push('/edit-category');
                      }}
                      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.93 : 1 }] })}>
                      <AddBubble size={p.r * 2} color={t.inkSoft} />
                    </Pressable>
                  </Animated.View>
                );
              }
              const c = byId.get(p.id);
              if (!c) return null;
              const count = todayCounts[c.id] ?? 0;
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
                  count={count}
                  dimCount={count === 0}
                  dots={todayHours[c.id] ?? []}
                  nowHour={nowHour}
                  pulse={pulses[c.id] ?? 0}
                  label={`${c.name}, ${count} today`}
                  onLog={() => onLog(c)}
                  onOpen={() => router.push({ pathname: '/category/[id]', params: { id: c.id } })}
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
          locations={[0, 0.55]}
        />

        {toast && (
          <Animated.View
            key={toast.eventId}
            entering={FadeInDown.springify().damping(16)}
            exiting={FadeOutDown.duration(180)}
            style={[styles.toast, { backgroundColor: t.surface, borderColor: t.line, shadowColor: t.shadow }]}>
            <Text style={{ fontSize: 20 }}>{toast.category.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {toast.category.name} · {formatTime(toast.at)}
              </Text>
              <Text variant="caption" tone="soft">
                {numberWord(toast.count)} today
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Undo"
              onPress={undo}
              hitSlop={10}
              style={[styles.undo, { borderColor: t.lineStrong }]}>
              <Icon name="undo" size={16} color={t.ink} />
              <Text variant="label">Undo</Text>
            </Pressable>
          </Animated.View>
        )}

        <View style={[styles.row, { gap: 10, paddingHorizontal: 16 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ask a question about your history"
            onPress={() => {
              tapHaptic();
              router.push('/ask');
            }}
            style={({ pressed }) => [
              styles.ask,
              { backgroundColor: t.pill, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}>
            <Icon name="sparkle" size={18} color={t.pillInk} />
            <Text style={{ fontFamily: font.serifItalic, fontSize: 21, color: t.pillInk }}>Ask your history…</Text>
          </Pressable>
          <RoundButton
            icon="plus"
            label="New bubble"
            size={56}
            tone="glass"
            onPress={() => router.push('/edit-category')}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 6, zIndex: 2 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 36 },
  ask: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    gap: 10,
  },
  toast: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
