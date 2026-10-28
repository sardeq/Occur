import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavButton, PillButton } from '@/components/buttons';
import { IdeasGrid } from '@/components/ideas-grid';
import { Text } from '@/components/text';
import { showDialog } from '@/lib/dialog';
import { addCategory, deleteCategory, useData, type CategoryInput } from '@/lib/store';
import { SUGGESTIONS } from '@/lib/suggestions';
import { useTheme } from '@/theme';

/**
 * "Add something to count". A still grid of ideas — tap as many as you like —
 * plus one clear button to make your own. Always reachable from the "+" on
 * the home screen, so the starter ideas never disappear after the first pick.
 */
export default function AddScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const categories = useData((s) => s.categories);
  const events = useData((s) => s.events);
  // bubbles added from this screen, so a second tap can take them back off
  const [addedHere, setAddedHere] = useState<Record<string, string>>({});

  const added = useMemo(() => new Set(categories.map((c) => c.name.trim().toLowerCase())), [categories]);

  const onIdea = (s: CategoryInput) => {
    const key = s.name.toLowerCase();
    if (!added.has(key)) {
      const c = addCategory(s);
      setAddedHere((m) => ({ ...m, [key]: c.id }));
      return;
    }
    const id = addedHere[key] ?? categories.find((c) => c.name.trim().toLowerCase() === key)?.id;
    if (!id) return;
    const used = events.some((e) => e.categoryId === id);
    const remove = () => {
      deleteCategory(id);
      setAddedHere((m) => {
        const n = { ...m };
        delete n[key];
        return n;
      });
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    };
    // something just added by mistake comes straight off; anything with history asks first
    if (addedHere[key] && !used) return remove();
    showDialog(`Remove ${s.name}?`, used ? 'This also deletes everything you counted for it.' : undefined, [
      { label: 'Keep it', style: 'cancel' },
      { label: 'Remove', style: 'destructive', onPress: remove },
    ]);
  };

  const count = Object.keys(addedHere).length;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <NavButton icon="back" label="Back" accessibilityLabel="Back to home" onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}>
        <Text variant="title" style={{ marginTop: 8 }}>
          What would you like to count?
        </Text>
        <Text variant="body" tone="soft" style={{ marginTop: 6 }}>
          Tap an idea to add it — you can pick more than one. Tap it again to take it off.
        </Text>

        <PillButton
          icon="pencil"
          variant="ghost"
          label="Make my own"
          onPress={() => router.push('/edit-category')}
          style={{ marginTop: 18 }}
        />

        <Text variant="eyebrow" tone="soft" style={{ marginTop: 26, marginBottom: 10, marginLeft: 4 }}>
          Ideas
        </Text>
        <IdeasGrid ideas={SUGGESTIONS} added={added} onPress={onIdea} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: t.bg }]}>
        <PillButton
          icon="check"
          label={count ? `Done · ${count} added` : 'Done'}
          onPress={() => router.back()}
          accessibilityLabel="Done, back to home"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10 },
});
