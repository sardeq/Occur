import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavButton, tapHaptic } from '@/components/buttons';
import { Bars } from '@/components/charts';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { askStrings } from '@/i18n/ask';
import { getLang, useStrings } from '@/lib/i18n';
import { ask } from '@/lib/query/ask';
import { suggestQuestions } from '@/lib/query/parse-local';
import type { Answer } from '@/lib/query/types';
import { useData } from '@/lib/store';
import { font, radius, useFont, useTheme } from '@/theme';
import { swatch } from '@/theme/palette';

type Turn = { id: number; question: string; answer?: Answer; error?: string };

function AnswerCard({ a }: { a: Answer }) {
  const t = useTheme();
  const S = useStrings(askStrings);
  const color = a.chart?.color ? swatch(a.chart.color).deep : t.ink;
  return (
    <Animated.View
      entering={FadeInUp.springify().damping(18)}
      style={[styles.answer, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Text
        style={{
          fontFamily: font.display,
          fontSize: a.headline.length > 12 ? 28 : 42,
          lineHeight: a.headline.length > 12 ? 34 : 50,
          color: t.ink,
        }}>
        {a.headline}
      </Text>
      {!!a.caption && (
        <Text variant="label" tone="faint" style={{ marginTop: 2 }}>
          {a.caption}
        </Text>
      )}
      <Text variant="body" style={{ marginTop: 10 }}>
        {a.sentence}
      </Text>
      {a.chart && a.chart.values.some((v) => v > 0) && (
        <View style={{ marginTop: 14 }}>
          <Bars
            values={a.chart.values}
            labels={a.chart.labels}
            color={color}
            highlight={a.chart.highlight}
            height={a.chart.kind === 'hour' ? 90 : 110}
            showValues={a.chart.values.length <= 8}
          />
        </View>
      )}
      <View style={styles.chips}>
        {a.interpretation.map((c, i) => (
          <View key={i} style={[styles.chip, { backgroundColor: t.surfaceAlt }]}>
            <Text variant="caption" tone="soft" style={{ fontFamily: font.semibold }}>
              {c}
            </Text>
          </View>
        ))}
        <View
          style={[styles.chip, styles.row, { gap: 4, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line }]}>
          <Icon name={a.source === 'ai' ? 'sparkle' : 'check'} size={11} color={t.inkFaint} />
          <Text variant="caption" tone="faint">
            {a.source === 'ai' ? S.sourceAi : S.sourceDevice}
          </Text>
        </View>
        {a.aiIssue && (
          <View style={[styles.chip, styles.row, { gap: 4, maxWidth: '100%', backgroundColor: t.bad + '14' }]}>
            <Icon name="cloudOff" size={11} color={t.bad} />
            <Text variant="caption" color={t.bad} style={{ flexShrink: 1 }}>
              {a.aiIssue === 'signedOut' ? S.aiSignedOut : S.aiUnavailable}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function Thinking() {
  const t = useTheme();
  const S = useStrings(askStrings);
  return (
    <Animated.View
      entering={FadeIn}
      style={[styles.answer, styles.row, { backgroundColor: t.surface, borderColor: t.line, gap: 8 }]}>
      <Icon name="sparkle" size={16} color={t.inkSoft} />
      <Text variant="subheading" tone="soft">
        {S.thinking}
      </Text>
    </Animated.View>
  );
}

export default function Ask() {
  const t = useTheme();
  const f = useFont();
  const S = useStrings(askStrings);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string; about?: string }>();
  const categories = useData((s) => s.categories);
  const events = useData((s) => s.events);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const seq = useRef(0);

  const suggestions = useMemo(() => {
    const about = params.about?.toLowerCase();
    const ordered = about
      ? [...categories].sort((a, b) => Number(b.name.toLowerCase() === about) - Number(a.name.toLowerCase() === about))
      : categories;
    return suggestQuestions(ordered.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })));
  }, [categories, params.about]);

  const submit = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    tapHaptic();
    const id = ++seq.current;
    setTurns((ts) => [...ts, { id, question }]);
    setInput('');
    setBusy(true);
    try {
      const answer = await ask(question, { categories, events });
      setTurns((ts) => ts.map((x) => (x.id === id ? { ...x, answer } : x)));
    } catch (e: any) {
      setTurns((ts) =>
        ts.map((x) => (x.id === id ? { ...x, error: (getLang() === 'en' && e?.message) || S.error } : x)),
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (params.q) void submit(params.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // newest answer sits right under the box
  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollTo({ y: 0, animated: true }), 80);
    return () => clearTimeout(id);
  }, [turns]);

  const canSend = input.trim().length > 0 && !busy;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* the question box is the header */}
      <View style={[styles.topbar, { paddingTop: Platform.OS === 'ios' ? 14 : insets.top + 8 }]}>
        <View
          style={[styles.inputWrap, { backgroundColor: t.surface, borderColor: t.lineStrong, shadowColor: t.shadow }]}>
          <Icon name="sparkle" size={16} color={t.inkSoft} />
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={S.placeholder}
            placeholderTextColor={t.inkFaint}
            style={[
              styles.input,
              { color: t.ink, fontFamily: f.medium, textAlign: getLang() === 'ar' ? 'right' : 'left' },
            ]}
            returnKeyType="send"
            onSubmitEditing={() => submit(input)}
            autoFocus={!params.q}
            accessibilityLabel={S.questionA11y}
            maxLength={300}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={S.send}
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={() => submit(input)}
            hitSlop={6}
            style={({ pressed }) => [
              styles.send,
              {
                backgroundColor: canSend ? t.pill : t.surfaceAlt,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}>
            <Icon name="send" size={17} color={canSend ? t.pillInk : t.inkFaint} strokeWidth={2.4} />
          </Pressable>
        </View>
        <NavButton icon="close" label={S.close} onPress={() => router.back()} />
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: 16, paddingTop: 10, paddingBottom: insets.bottom + 24, gap: 18 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {turns.length === 0 && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <Text variant="subheading" tone="soft" style={{ marginStart: 4 }}>
              {categories.length ? S.intro : S.introEmpty}
            </Text>
            <View style={{ gap: 8, marginTop: 14 }}>
              {suggestions.map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  onPress={() => submit(s)}
                  style={({ pressed }) => [
                    styles.suggestion,
                    { backgroundColor: pressed ? t.surfaceAlt : t.surface, borderColor: t.line },
                  ]}>
                  <Text variant="body" style={{ flex: 1 }}>
                    {s}
                  </Text>
                  <Icon name="send" size={16} color={t.inkFaint} />
                </Pressable>
              ))}
            </View>
            <View style={[styles.note, { borderColor: t.line }]}>
              <Icon name="check" size={14} color={t.inkSoft} />
              <Text variant="caption" tone="soft" style={{ flex: 1 }}>
                {S.privacy}
              </Text>
            </View>
          </Animated.View>
        )}

        {[...turns].reverse().map((turn) => (
          <View key={turn.id} style={{ gap: 10 }}>
            <Animated.View
              entering={FadeInDown.springify().damping(18)}
              style={[styles.question, { backgroundColor: t.pill }]}>
              <Text variant="body" color={t.pillInk}>
                {turn.question}
              </Text>
            </Animated.View>
            {turn.answer ? (
              <AnswerCard a={turn.answer} />
            ) : turn.error ? (
              <Text variant="body" tone="bad">
                {turn.error}
              </Text>
            ) : (
              <Thinking />
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 54,
    borderRadius: 27,
    paddingStart: 18,
    paddingEnd: 6,
    borderWidth: StyleSheet.hairlineWidth * 2,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.md + 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  note: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderStyle: 'dashed',
  },
  question: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    borderBottomEndRadius: 6,
  },
  answer: {
    alignSelf: 'stretch',
    padding: 18,
    borderRadius: radius.lg,
    borderTopStartRadius: 8,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  input: {
    flex: 1,
    // let it shrink below the browser's default input width so the icon and send button keep their room
    minWidth: 0,
    height: '100%',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
    fontFamily: font.medium,
    fontSize: 16,
  },
});
