import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, PillButton } from '@/components/buttons';
import { Text } from '@/components/text';
import { logEvent, updateEvent, useData } from '@/lib/store';
import { HOUR, MINUTE, addDays, formatDayLabel, formatTime, startOfDay } from '@/lib/time';
import { useTheme } from '@/theme';

/** Log something that happened earlier, or move an existing entry. */
export default function LogTime() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { categoryId, eventId } = useLocalSearchParams<{ categoryId: string; eventId?: string }>();
  const cat = useData((s) => s.categories.find((c) => c.id === categoryId));
  const existing = useData((s) => (eventId ? s.events.find((e) => e.id === eventId) : undefined));
  const [date, setDate] = useState(() =>
    existing ? new Date(existing.occurredAt) : new Date(Date.now() - 15 * MINUTE),
  );

  const now = new Date();
  const presets = [
    { label: '15 min ago', at: new Date(now.getTime() - 15 * MINUTE) },
    { label: '1 hour ago', at: new Date(now.getTime() - HOUR) },
    { label: '3 hours ago', at: new Date(now.getTime() - 3 * HOUR) },
    { label: 'This morning', at: new Date(startOfDay(now).getTime() + 9 * HOUR) },
    { label: 'Last night', at: new Date(addDays(startOfDay(now), -1).getTime() + 22 * HOUR) },
  ].filter((p) => p.at <= now);

  const save = () => {
    if (!cat) return router.back();
    const at = date > new Date() ? new Date() : date;
    if (existing)
      updateEvent(existing.id, { occurredAt: at.toISOString(), source: existing.source === 'tap' ? 'tap' : 'manual' });
    else logEvent(cat.id, at, 'manual');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 28, paddingBottom: insets.bottom + 20 }}>
        <Text variant="eyebrow" tone="soft">
          {cat ? `${cat.emoji}  ${cat.name}` : ''}
        </Text>
        <Text variant="title" style={{ marginTop: 6 }}>
          {existing ? 'Move this entry' : 'When did it happen?'}
        </Text>
        <Text variant="body" tone="soft" style={{ marginTop: 4 }}>
          {formatDayLabel(date)} at {formatTime(date)}
        </Text>

        {!existing && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 16, marginHorizontal: -20 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
            {presets.map((p) => (
              <Chip
                key={p.label}
                label={p.label}
                active={Math.abs(p.at.getTime() - date.getTime()) < MINUTE}
                onPress={() => setDate(p.at)}
              />
            ))}
          </ScrollView>
        )}

        <View style={[styles.picker, { borderColor: t.line }]}>
          <DateTimePicker
            value={date}
            mode={Platform.OS === 'ios' ? 'datetime' : 'time'}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            minuteInterval={1}
            themeVariant={t.scheme}
            textColor={t.ink}
            onValueChange={(_, d) => d && setDate(d)}
          />
        </View>

        <PillButton label={existing ? 'Save time' : 'Log it'} icon="check" onPress={save} style={{ marginTop: 16 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { marginTop: 12, alignItems: 'center', borderRadius: 20, overflow: 'hidden' },
});
