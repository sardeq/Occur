import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { PillButton, RoundButton } from '@/components/buttons';
import { Text } from '@/components/text';
import { useNow } from '@/hooks/use-now';
import { signOut, useAuth } from '@/lib/auth';
import { showDialog } from '@/lib/dialog';
import { deleteAllData, resetData, sync, useData, wipeLocalCache } from '@/lib/store';
import { formatRelative } from '@/lib/time';
import { font, radius, useTheme } from '@/theme';

function Row({
  icon,
  label,
  detail,
  onPress,
  danger,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.rowItem, { backgroundColor: pressed ? t.surfaceAlt : 'transparent' }]}>
      <Icon name={icon} size={20} color={danger ? t.bad : t.ink} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={danger ? t.bad : undefined}>
          {label}
        </Text>
        {!!detail && (
          <Text variant="caption" tone="soft">
            {detail}
          </Text>
        )}
      </View>
      <Icon name="chevron" size={16} color={t.inkFaint} />
    </Pressable>
  );
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function Settings() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow(30_000);
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const categories = useData((s) => s.categories);
  const events = useData((s) => s.events);
  const pending = useData((s) => s.queue.length);
  const syncing = useData((s) => s.syncing);
  const lastSyncedAt = useData((s) => s.lastSyncedAt);
  const syncError = useData((s) => s.syncError);
  const demo = status === 'demo';

  const exportCsv = async () => {
    const names = new Map(categories.map((c) => [c.id, c]));
    const header = 'category,emoji,occurred_at_utc,local_date,local_time,place,latitude,longitude,source';
    const lines = events.map((e) => {
      const d = new Date(e.occurredAt);
      const c = names.get(e.categoryId);
      return [
        c?.name,
        c?.emoji,
        e.occurredAt,
        d.toLocaleDateString(),
        d.toLocaleTimeString(),
        e.place,
        e.latitude,
        e.longitude,
        e.source,
      ]
        .map(csvCell)
        .join(',');
    });
    const csv = [header, ...lines].join('\n');
    if (Platform.OS === 'web') {
      // browsers: download a real .csv file
      const doc = (globalThis as any).document;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = href;
      a.download = 'occur-export.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      return;
    }
    await Share.share({ message: csv, title: 'occur-export.csv' });
  };

  const confirmWipe = () =>
    showDialog(
      'Delete everything?',
      `This deletes ${categories.length} bubbles and ${events.length} entries${demo ? '' : ' from your account'}. It can't be undone.`,
      [
        { label: 'Cancel', style: 'cancel' },
        { label: 'Delete everything', style: 'destructive', onPress: () => deleteAllData() },
      ],
    );

  const doSignOut = () =>
    showDialog(
      demo ? 'Leave the demo?' : 'Sign out?',
      demo
        ? 'The sample data on this phone will be reset. You can sign in with Google or start the demo again.'
        : pending
          ? `${pending} changes haven't synced yet and will be lost.`
          : 'Your data stays safe in your account.',
      [
        { label: 'Cancel', style: 'cancel' },
        {
          label: demo ? 'Leave demo' : 'Sign out',
          style: 'destructive',
          onPress: () => {
            if (user) wipeLocalCache(user.id);
            resetData();
            void signOut();
          },
        },
      ],
    );

  const displayName = demo ? 'Demo mode' : (user?.name ?? user?.email ?? 'You');
  const syncLine = demo
    ? 'Everything stays on this device.'
    : pending
      ? `${pending} ${pending === 1 ? 'change' : 'changes'} waiting to sync${syncError ? ' — offline' : ''}`
      : lastSyncedAt
        ? `All synced · ${formatRelative(new Date(lastSyncedAt), now)}`
        : 'Not synced yet';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.topbar, { paddingTop: Platform.OS === 'ios' ? 14 : insets.top + 8 }]}>
        <Text variant="title">You</Text>
        <RoundButton icon="close" label="Close" onPress={() => router.back()} size={40} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <View style={[styles.card, styles.profile, { backgroundColor: t.surface, borderColor: t.line }]}>
          <View style={[styles.avatar, { backgroundColor: t.surfaceAlt }]}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={{ width: 56, height: 56 }} />
            ) : (
              <Text style={{ fontFamily: font.serif, fontSize: 28, color: t.ink }}>{displayName.charAt(0)}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="serif">{displayName}</Text>
            <Text variant="caption" tone="soft">
              {demo ? 'Sample data, no account' : (user?.email ?? '')}
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
          <View style={[styles.rowItem]}>
            <Icon name={syncError && pending ? 'cloudOff' : 'cloud'} size={20} color={t.ink} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{demo ? 'Local only' : syncing ? 'Syncing…' : 'Sync'}</Text>
              <Text variant="caption" tone="soft">
                {syncLine}
              </Text>
            </View>
            {!demo && (
              <Pressable
                accessibilityRole="button"
                onPress={() => void sync()}
                style={[styles.small, { borderColor: t.lineStrong }]}>
                <Text variant="label">Sync now</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Row icon="share" label="Export as CSV" detail={`${events.length} entries`} onPress={exportCsv} />
          <View style={[styles.sep, { backgroundColor: t.line }]} />
          <Row icon="trash" label="Delete all my data" onPress={confirmWipe} danger />
        </View>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, padding: 16, gap: 6 }]}>
          <Text variant="bodyStrong">How Occur works</Text>
          <Text variant="caption" tone="soft">
            Taps are saved on your phone instantly and synced in the background, so counting works offline. When you ask
            a question, an AI model turns your words into a small structured query; your phone then counts the answer
            from your own log. The model never sees your history.
          </Text>
        </View>

        <PillButton variant="ghost" label={demo ? 'Leave demo' : 'Sign out'} onPress={doSignOut} />
        <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
          Occur {Constants.expoConfig?.version ?? ''} · How many times, and when?
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  sep: { height: StyleSheet.hairlineWidth * 2, marginLeft: 50 },
  small: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth * 2,
    justifyContent: 'center',
  },
});
