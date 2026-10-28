import { ScrollView, View } from 'react-native';

import { SUGGESTIONS } from '@/lib/suggestions';
import type { CategoryInput } from '@/lib/store';
import { PillButton } from './buttons';
import { IdeasGrid } from './ideas-grid';
import { Text } from './text';

/**
 * First run: one question and a still grid of ideas. One tap on any idea
 * creates that bubble; "Make my own" opens the full form. Nothing moves, so
 * every target is easy to hit.
 */
export function EmptyState({
  width,
  height,
  onCreate,
  onQuickAdd,
}: {
  width: number;
  height: number;
  onCreate: () => void;
  onQuickAdd: (s: CategoryInput) => void;
}) {
  return (
    <ScrollView style={{ width, height }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12 }}>
      <Text variant="title">What would you like to count?</Text>
      <Text variant="body" tone="soft" style={{ marginTop: 6, marginBottom: 16 }}>
        Tap one to start. You can add more any time with the + button.
      </Text>
      <IdeasGrid ideas={SUGGESTIONS.slice(0, 9)} added={new Set()} onPress={onQuickAdd} />
      <View style={{ marginTop: 14 }}>
        <PillButton icon="pencil" variant="ghost" label="Make my own" onPress={onCreate} />
      </View>
    </ScrollView>
  );
}
