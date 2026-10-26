import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoundButton, tapHaptic } from '@/components/buttons';
import { Bars } from '@/components/charts';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { ask } from '@/lib/query/ask';
import { suggestQuestions } from '@/lib/query/parse-local';
import type { Answer } from '@/lib/query/types';
import { useData } from '@/lib/store';
import { font, radius, useTheme } from '@/theme';
import { swatch } from '@/theme/palette';

type Turn = { id: number; question: string; answer?: Answer; error?: string };

function AnswerCard({ a }: { a: Answer }) {
  const t = useTheme();
  const color = a.chart?.color ? swatch(a.chart.color).deep : t.ink;
  return (
    <Animated.View
      entering={FadeInUp.springify().damping(18)}
      style={[styles.answer, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Text
        style={{
          fontFamily: font.serif,
          fontSize: a.headline.length > 12 ? 32 : 46,
          lineHeight: a.headline.length > 12 ? 36 : 50,
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
            {a.source === 'ai' ? 'AI read the question' : 'Parsed on device'}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

function Thinking() {
  const t = useTheme();
  return (
    <Animated.View
      entering={FadeIn}
      style={[styles.answer, styles.row, { backgroundColor: t.surface, borderColor: t.line, gap: 8 }]}>
      <Icon name="sparkle" size={16} color={t.inkSoft} />
      <Text variant="serifItalic" tone="soft">
        Looking through your log…
      </Text>
    </Animated.View>
  );
}

export default function Ask() {
  const t = useTheme();
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
      setTurns((ts) => ts.map((x) => (x.id === id ? { ...x, error: e?.message ?? 'Something went wrong.' } : x)));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (params.q) void submit(params.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [turns]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topbar, { paddingTop: Platform.OS === 'ios' ? 14 : insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text variant="eyebrow" tone="soft">
            Ask
          </Text>
          <Text variant="title">Your history</Text>
        </View>
        <RoundButton icon="close" label="Close" onPress={() => router.back()} size={40} />
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
        keyboardShouldPersistTaps="handled">
        {turns.length === 0 && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <Text variant="serif" style={{ fontSize: 26, lineHeight: 31 }}>
              {categories.length
                ? 'Ask in your own words — how many, when, how often, compared to when.'
                : 'Add a bubble and log a few things first, then ask me about them.'}
            </Text>
            <View style={{ gap: 8, marginTop: 18 }}>
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
                Every number is counted on your phone from your own log. The AI only ever sees your question and the
                names of your bubbles — never your history.
              </Text>
            </View>
          </Animated.View>
        )}

        {turns.map((turn) => (
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

      <View
        style={[
          styles.inputBar,
          { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: t.line, backgroundColor: t.bg },
        ]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="How many times did I…"
          placeholderTextColor={t.inkFaint}
          style={[styles.input, { color: t.ink, backgroundColor: t.surface, borderColor: t.line }]}
          returnKeyType="send"
          onSubmitEditing={() => submit(input)}
          autoFocus={!params.q}
          accessibilityLabel="Question"
          maxLength={300}
        />
        <RoundButton icon="send" label="Ask" tone="ink" size={48} onPress={() => submit(input)} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 6 },
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
    borderBottomRightRadius: 6,
  },
  answer: {
    alignSelf: 'stretch',
    padding: 18,
    borderRadius: radius.lg,
    borderTopLeftRadius: 8,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 18,
    fontFamily: font.medium,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
