import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { closeDialog, useDialog } from '@/lib/dialog';
import { font, radius, useTheme } from '@/theme';
import { Text } from './text';

/** Renders dialogs requested through lib/dialog on platforms without native alerts (web). */
export function DialogHost() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const current = useDialog((s) => s.current);
  if (!current) return null;

  const cancel = current.actions.find((a) => a.style === 'cancel');
  const dismiss = () => {
    closeDialog();
    cancel?.onPress?.();
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: t.overlay }, current.sheet && styles.backdropSheet]}
        onPress={dismiss}>
        <Pressable
          onPress={() => {}}
          style={[
            styles.card,
            { backgroundColor: t.surface, borderColor: t.line },
            current.sheet && { marginBottom: insets.bottom + 12, width: '100%' },
          ]}>
          <Text variant="heading" style={{ textAlign: 'center' }}>
            {current.title}
          </Text>
          {!!current.message && (
            <Text variant="body" tone="soft" style={{ textAlign: 'center', marginTop: 6 }}>
              {current.message}
            </Text>
          )}
          <View style={{ gap: 8, marginTop: 18 }}>
            {[
              ...current.actions.filter((a) => a.style !== 'cancel'),
              ...current.actions.filter((a) => a.style === 'cancel'),
            ].map((a) => {
              const primary = a.style !== 'cancel';
              const color = a.style === 'destructive' ? t.bad : primary ? t.ink : t.inkSoft;
              return (
                <Pressable
                  key={a.label}
                  accessibilityRole="button"
                  onPress={() => {
                    closeDialog();
                    a.onPress?.();
                  }}
                  style={({ pressed }) => [
                    styles.button,
                    {
                      backgroundColor: pressed ? t.surfaceAlt : primary ? t.bg : 'transparent',
                      borderColor: primary ? t.line : 'transparent',
                    },
                  ]}>
                  <Text style={{ fontFamily: font.bold, fontSize: 16, color }}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backdropSheet: { justifyContent: 'flex-end', paddingHorizontal: 12, paddingBottom: 0 },
  card: {
    width: '100%',
    maxWidth: 380,
    padding: 22,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  button: {
    height: 50,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
