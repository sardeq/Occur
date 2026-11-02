import { ScrollView, View } from 'react-native';

import { componentStrings } from '@/i18n/home';
import { useLang, useStrings } from '@/lib/i18n';
import { localSuggestions } from '@/lib/suggestions';
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
  const s = useStrings(componentStrings);
  const lang = useLang();
  return (
    <ScrollView style={{ width, height }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12 }}>
      <Text variant="title">{s.emptyTitle}</Text>
      <Text variant="body" tone="soft" style={{ marginTop: 6, marginBottom: 16 }}>
        {s.emptyBody}
      </Text>
      <IdeasGrid ideas={localSuggestions(lang).slice(0, 9)} added={new Set()} onPress={onQuickAdd} />
      <View style={{ marginTop: 14 }}>
        <PillButton icon="pencil" variant="ghost" label={s.makeMyOwn} onPress={onCreate} />
      </View>
    </ScrollView>
  );
}
