import { Pressable, StyleSheet, View } from 'react-native';

import type { CategoryInput } from '@/lib/store';
import { font, radius, useTheme } from '@/theme';
import { alpha, swatch } from '@/theme/palette';
import { Bubble } from './bubble';
import { tapHaptic } from './buttons';
import { Icon } from './icon';
import { Text } from './text';

/**
 * A still (non-moving) grid of starter ideas. One tap adds the idea; added
 * ones show a tick. Big targets with words under them — nothing to guess.
 */
export function IdeasGrid({
  ideas,
  added,
  onPress,
  columns = 3,
}: {
  ideas: CategoryInput[];
  /** lower-cased names that are already on the home screen */
  added: Set<string>;
  onPress: (idea: CategoryInput) => void;
  columns?: number;
}) {
  const t = useTheme();
  return (
    <View style={styles.grid}>
      {ideas.map((s) => {
        const on = added.has(s.name.toLowerCase());
        const sw = swatch(s.color);
        return (
          <View key={s.name} style={{ width: `${100 / columns}%`, padding: 5 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={on ? `${s.name}, added` : `Add ${s.name}`}
              accessibilityState={{ selected: on }}
              onPress={() => {
                tapHaptic();
                onPress(s);
              }}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: on ? alpha(sw.base, 0.22) : t.surface,
                  borderColor: on ? sw.deep : t.line,
                  borderWidth: on ? 2 : StyleSheet.hairlineWidth * 2,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}>
              <Bubble size={58} swatch={sw} emoji={s.emoji} />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ fontFamily: font.semibold, fontSize: 16, color: t.ink, marginTop: 8 }}>
                {s.name}
              </Text>
              {on && (
                <View style={[styles.tick, { backgroundColor: t.good }]}>
                  <Icon name="check" size={16} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  card: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 6,
    borderRadius: radius.md + 2,
  },
  tick: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
