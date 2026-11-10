import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bubble } from '@/components/bubble';
import { Chip, NavButton, PillButton, tapHaptic } from '@/components/buttons';
import { Text } from '@/components/text';
import { useCategories } from '@/hooks/use-categories';
import { editingStrings } from '@/i18n/editing';
import { showDialog } from '@/lib/dialog';
import { useLang, useStrings } from '@/lib/i18n';
import { requestLocationPermission } from '@/lib/location';
import { addCategory, deleteCategory, updateCategory, useData } from '@/lib/store';
import { EMOJIS, isSuggestionUsed, localSuggestions } from '@/lib/suggestions';
import type { Goal } from '@/lib/types';
import { radius, useFont, useTheme } from '@/theme';
import { PALETTE, alpha, nextColor, swatch, swatchName } from '@/theme/palette';

const GOAL_KEYS: Goal[] = ['track', 'more', 'less'];

/** First grapheme of whatever the user typed (emoji can be several code units). */
function firstGrapheme(s: string): string {
  try {
    const Seg = (Intl as any).Segmenter;
    if (Seg) {
      const it = new Seg(undefined, { granularity: 'grapheme' }).segment(s)[Symbol.iterator]();
      return it.next().value?.segment ?? '';
    }
  } catch {}
  return Array.from(s).slice(0, 2).join('');
}

export default function EditCategory() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const S = useStrings(editingStrings);
  const lang = useLang();
  const f = useFont();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const categories = useCategories();
  const eventCount = useData((s) => (id ? s.events.filter((e) => e.categoryId === id).length : 0));
  const existing = useMemo(() => categories.find((c) => c.id === id), [categories, id]);
  const editing = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '✨');
  const [color, setColor] = useState(existing?.color ?? nextColor(categories.map((c) => c.color)));
  const [goal, setGoal] = useState<Goal>(existing?.goal ?? 'track');
  const [trackLocation, setTrackLocation] = useState(existing?.trackLocation ?? false);
  const [customEmoji, setCustomEmoji] = useState('');
  const [ph, setPh] = useState(0);

  useEffect(() => {
    if (editing) return;
    const i = setInterval(() => setPh((p) => p + 1), 1800);
    return () => clearInterval(i);
  }, [editing]);

  const trimmed = name.trim();
  const duplicate = categories.some((c) => c.id !== id && c.name.trim().toLowerCase() === trimmed.toLowerCase());
  const canSave = trimmed.length > 0 && trimmed.length <= 40 && !duplicate;
  const usedNames = new Set(categories.map((c) => c.name.toLowerCase()));

  const save = () => {
    if (!canSave) return;
    const input = { name: trimmed, emoji, color, goal, trackLocation };
    if (existing) updateCategory(existing.id, input);
    else addCategory(input);
    router.back();
  };

  const toggleLocation = async (v: boolean) => {
    if (!v) return setTrackLocation(false);
    const ok = await requestLocationPermission();
    if (ok) setTrackLocation(true);
    else
      showDialog(S.locationOff, Platform.OS === 'web' ? S.locationWeb : S.locationNative, [
        { label: S.ok, style: 'cancel' },
      ]);
  };

  const confirmDelete = () => {
    if (!existing) return;
    showDialog(S.deleteTitle(existing.name), eventCount ? S.deleteWithEntries(eventCount) : S.deleteBubbleOnly, [
      { label: S.cancel, style: 'cancel' },
      {
        label: S.delete,
        style: 'destructive',
        onPress: () => {
          deleteCategory(existing.id);
          router.dismissTo('/');
        },
      },
    ]);
  };

  const sw = swatch(color);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topbar, { paddingTop: Platform.OS === 'ios' ? 14 : insets.top + 8 }]}>
        <NavButton icon="close" label={S.cancel} onPress={() => router.back()} />
        {editing ? (
          <NavButton
            icon="trash"
            label={S.delete}
            accessibilityLabel={S.deleteA11y(existing.name)}
            onPress={confirmDelete}
          />
        ) : (
          <Text variant="label" tone="soft">
            {S.newBubble}
          </Text>
        )}
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Bubble
            size={148}
            swatch={sw}
            emoji={emoji}
            name={trimmed || S.placeholders[ph % S.placeholders.length]}
            count={0}
            dots={[]}
            dimCount
          />
        </View>

        <View style={styles.section}>
          <Text variant="title" style={{ textAlign: 'center' }}>
            {editing ? S.whatCounting : S.whatToCount}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus={!editing}
            maxLength={40}
            placeholder={S.placeholders[ph % S.placeholders.length]}
            placeholderTextColor={t.inkFaint}
            returnKeyType="done"
            onSubmitEditing={save}
            autoCapitalize="sentences"
            style={[
              styles.input,
              { fontFamily: f.display, color: t.ink, borderColor: duplicate ? t.bad : t.lineStrong },
            ]}
            accessibilityLabel={S.nameA11y}
          />
          {duplicate && (
            <Text variant="caption" tone="bad" style={{ textAlign: 'center', marginTop: 6 }}>
              {S.duplicate(trimmed)}
            </Text>
          )}
        </View>

        {!editing && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
            style={{ marginTop: 14 }}>
            {localSuggestions(lang)
              .filter((s) => !isSuggestionUsed(s, usedNames))
              .map((s) => (
                <Chip
                  key={s.name}
                  label={s.name}
                  leading={<Text style={{ fontSize: 15 }}>{s.emoji}</Text>}
                  active={trimmed === s.name}
                  onPress={() => {
                    setName(s.name);
                    setEmoji(s.emoji);
                    setColor(s.color);
                    setGoal(s.goal);
                    setTrackLocation(false);
                  }}
                />
              ))}
          </ScrollView>
        )}

        <View style={styles.section}>
          <Text variant="eyebrow" tone="soft" style={styles.eyebrow}>
            {S.icon}
          </Text>
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
            <View style={styles.emojiGrid}>
              {EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  accessibilityRole="button"
                  accessibilityLabel={S.iconA11y(e)}
                  onPress={() => {
                    tapHaptic();
                    setEmoji(e);
                  }}
                  style={[styles.emojiCell, emoji === e && { backgroundColor: alpha(sw.base, 0.35) }]}>
                  <Text style={{ fontSize: 24 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.customRow, { borderTopColor: t.line }]}>
              <Text variant="label" tone="soft">
                {S.typeEmoji}
              </Text>
              <TextInput
                value={customEmoji}
                onChangeText={(v) => {
                  const g = firstGrapheme(v.trim());
                  setCustomEmoji(g);
                  if (g) setEmoji(g);
                }}
                placeholder="🙂"
                placeholderTextColor={t.inkFaint}
                style={[styles.customInput, { color: t.ink, backgroundColor: t.bg }]}
                maxLength={8}
                accessibilityLabel={S.customEmojiA11y}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="eyebrow" tone="soft" style={styles.eyebrow}>
            {S.colour}
          </Text>
          <View style={styles.swatches}>
            {PALETTE.map((p) => (
              <Pressable
                key={p.key}
                accessibilityRole="button"
                accessibilityLabel={swatchName(p, lang)}
                accessibilityState={{ selected: color === p.key }}
                onPress={() => {
                  tapHaptic();
                  setColor(p.key);
                }}
                style={[styles.swatchRing, { borderColor: color === p.key ? t.ink : 'transparent' }]}>
                <Bubble size={32} swatch={p} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="eyebrow" tone="soft" style={styles.eyebrow}>
            {S.goal}
          </Text>
          <View style={{ gap: 8 }}>
            {GOAL_KEYS.map((key) => {
              const g = { key, ...S.goals[key] };
              const on = goal === g.key;
              return (
                <Pressable
                  key={g.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    tapHaptic();
                    setGoal(g.key);
                  }}
                  style={[
                    styles.goal,
                    { backgroundColor: on ? t.pill : t.surface, borderColor: on ? t.pill : t.line },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" color={on ? t.pillInk : t.ink}>
                      {g.title}
                    </Text>
                    <Text variant="caption" color={on ? t.pillInk : t.inkSoft} style={{ opacity: on ? 0.75 : 1 }}>
                      {g.body}
                    </Text>
                  </View>
                  <View style={[styles.radio, { borderColor: on ? t.pillInk : t.lineStrong }]}>
                    {on && <View style={[styles.radioDot, { backgroundColor: t.pillInk }]} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.card, styles.switchRow, { backgroundColor: t.surface, borderColor: t.line }]}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{S.rememberWhere}</Text>
              <Text variant="caption" tone="soft">
                {S.rememberWhereHint}
              </Text>
            </View>
            <Switch value={trackLocation} onValueChange={toggleLocation} trackColor={{ true: sw.deep }} />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <PillButton label={editing ? S.saveChanges : S.startCounting(trimmed)} onPress={save} disabled={!canSave} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  section: { paddingHorizontal: 20, marginTop: 22 },
  eyebrow: { marginBottom: 10, marginStart: 4 },
  input: {
    fontSize: 28,
    textAlign: 'center',
    borderBottomWidth: 1.5,
    paddingVertical: 10,
    marginTop: 10,
  },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, justifyContent: 'space-between' },
  emojiCell: { width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  customInput: { width: 56, height: 40, borderRadius: 12, textAlign: 'center', fontSize: 22 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatchRing: { padding: 3, borderRadius: 24, borderWidth: 2 },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: radius.md + 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
});
