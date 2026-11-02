import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { NavButton, PillButton, Segmented } from '@/components/buttons';
import { Text } from '@/components/text';
import { useNow } from '@/hooks/use-now';
import { signOut, useAuth } from '@/lib/auth';
import { settingsStrings } from '@/i18n/settings';
import { useLang, useStrings } from '@/lib/i18n';
import { setPref, usePrefs } from '@/lib/prefs';
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
  const themePref = usePrefs((s) => s.theme);
  const homeStyle = usePrefs((s) => s.homeStyle);
  const tips = usePrefs((s) => s.tips);
  const languagePref = usePrefs((s) => s.language);
  const lang = useLang();
  const S = useStrings(settingsStrings);

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
    showDialog(S.wipeTitle, S.wipeBody(categories.length, events.length, demo), [
      { label: S.cancel, style: 'cancel' },
      { label: S.deleteEverything, style: 'destructive', onPress: () => deleteAllData() },
    ]);

  const doSignOut = () =>
    showDialog(
      demo ? S.leaveDemoTitle : S.signOutTitle,
      demo ? S.leaveDemoBody : pending ? S.unsyncedBody(pending) : S.safeBody,
      [
        { label: S.cancel, style: 'cancel' },
        {
          label: demo ? S.leaveDemo : S.signOut,
          style: 'destructive',
          onPress: () => {
            if (user) wipeLocalCache(user.id);
            resetData();
            void signOut();
          },
        },
      ],
    );

  const displayName = demo ? S.demoMode : (user?.name ?? user?.email ?? S.you);
  const syncLine = demo
    ? S.staysOnDevice
    : pending
      ? S.waiting(pending, !!syncError)
      : lastSyncedAt
        ? S.allSynced(formatRelative(new Date(lastSyncedAt), now))
        : S.notSynced;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <NavButton icon="back" label={S.back} accessibilityLabel={S.backA11y} onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <Text variant="title" style={{ marginStart: 4 }}>
          {S.title}
        </Text>
        <View style={[styles.card, styles.profile, { backgroundColor: t.surface, borderColor: t.line }]}>
          <View style={[styles.avatar, { backgroundColor: t.surfaceAlt }]}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={{ width: 56, height: 56 }} />
            ) : (
              <Text style={{ fontFamily: font.display, fontSize: 26, color: t.ink }}>{displayName.charAt(0)}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading">{displayName}</Text>
            <Text variant="caption" tone="soft">
              {demo ? S.demoSub : (user?.email ?? '')}
            </Text>
          </View>
        </View>

        <View style={[styles.card, styles.prefCard, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text variant="bodyStrong">{S.language}</Text>
          <Text variant="caption" tone="soft">
            {languagePref === 'auto' ? S.languageAuto(lang === 'ar') : S.languageManual}
          </Text>
          <Segmented
            accessibilityLabel={S.language}
            value={languagePref}
            onChange={(v) => setPref('language', v)}
            options={[
              { key: 'auto', label: S.automatic, icon: 'globe' },
              { key: 'en', label: 'English' },
              { key: 'ar', label: 'العربية' },
            ]}
          />
        </View>

        <View style={[styles.card, styles.prefCard, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text variant="bodyStrong">{S.appearance}</Text>
          <Text variant="caption" tone="soft">
            {S.appearanceHint}
          </Text>
          <Segmented
            accessibilityLabel={S.appearance}
            value={themePref}
            onChange={(v) => setPref('theme', v)}
            options={[
              { key: 'system', label: S.automatic, icon: 'phone' },
              { key: 'light', label: S.light, icon: 'sun' },
              { key: 'dark', label: S.dark, icon: 'moon' },
            ]}
          />
        </View>

        <View style={[styles.card, styles.prefCard, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text variant="bodyStrong">{S.homeScreen}</Text>
          <Text variant="caption" tone="soft">
            {S.homeScreenHint}
          </Text>
          <Segmented
            accessibilityLabel={S.homeStyleA11y}
            value={homeStyle}
            onChange={(v) => setPref('homeStyle', v)}
            options={[
              { key: 'bubbles', label: S.bubbles, icon: 'bubbles' },
              { key: 'list', label: S.list, icon: 'list' },
            ]}
          />
        </View>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
          <View style={styles.rowItem}>
            <Icon name="sparkle" size={20} color={t.ink} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{S.tips}</Text>
              <Text variant="caption" tone="soft">
                {S.tipsHint}
              </Text>
            </View>
            <Switch
              accessibilityLabel={S.tips}
              value={tips}
              onValueChange={(v) => setPref('tips', v)}
              trackColor={{ false: t.surfaceAlt, true: t.good }}
              thumbColor={Platform.OS === 'android' ? t.surface : undefined}
              ios_backgroundColor={t.surfaceAlt}
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
          <View style={[styles.rowItem]}>
            <Icon name={syncError && pending ? 'cloudOff' : 'cloud'} size={20} color={t.ink} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{demo ? S.localOnly : syncing ? S.syncing : S.sync}</Text>
              <Text variant="caption" tone="soft">
                {syncLine}
              </Text>
            </View>
            {!demo && (
              <Pressable
                accessibilityRole="button"
                onPress={() => void sync()}
                style={[styles.small, { borderColor: t.lineStrong }]}>
                <Text variant="label">{S.syncNow}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Row icon="share" label={S.exportCsv} detail={S.entries(events.length)} onPress={exportCsv} />
          <View style={[styles.sep, { backgroundColor: t.line }]} />
          <Row icon="trash" label={S.deleteAll} onPress={confirmWipe} danger />
        </View>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, padding: 16, gap: 6 }]}>
          <Text variant="bodyStrong">{S.howTitle}</Text>
          <Text variant="caption" tone="soft">
            {S.howBody}
          </Text>
        </View>

        <PillButton variant="ghost" label={demo ? S.leaveDemo : S.signOut} onPress={doSignOut} />
        <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
          {S.footer(Constants.expoConfig?.version ?? '')}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  prefCard: { padding: 16, gap: 10 },
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
  sep: { height: StyleSheet.hairlineWidth * 2, marginStart: 50 },
  small: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth * 2,
    justifyContent: 'center',
  },
});
