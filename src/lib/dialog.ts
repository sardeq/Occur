/**
 * Cross-platform alerts and action sheets.
 *
 * iOS/Android use the native Alert / ActionSheet. React Native Web has no
 * Alert implementation (calls are silently ignored), so on web the same
 * calls render an in-app dialog through <DialogHost />.
 */
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { create } from 'zustand';

export type DialogAction = {
  label: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type DialogRequest = {
  title: string;
  message?: string;
  actions: DialogAction[];
  /** bottom sheet layout instead of a centred alert */
  sheet?: boolean;
};

export const useDialog = create<{ current: DialogRequest | null }>(() => ({ current: null }));

export function closeDialog() {
  useDialog.setState({ current: null });
}

/** A confirm-style alert. */
export function showDialog(title: string, message: string | undefined, actions: DialogAction[]) {
  if (Platform.OS === 'web') {
    useDialog.setState({ current: { title, message, actions } });
    return;
  }
  Alert.alert(
    title,
    message,
    actions.map((a) => ({ text: a.label, style: a.style, onPress: a.onPress })),
  );
}

/** A list of choices (native action sheet on iOS). */
export function showActionSheet(title: string, message: string | undefined, actions: DialogAction[]) {
  if (Platform.OS === 'ios') {
    const cancelButtonIndex = actions.findIndex((a) => a.style === 'cancel');
    const destructiveButtonIndex = actions.findIndex((a) => a.style === 'destructive');
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: actions.map((a) => a.label),
        cancelButtonIndex: cancelButtonIndex >= 0 ? cancelButtonIndex : undefined,
        destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
      },
      (i) => actions[i]?.onPress?.(),
    );
    return;
  }
  if (Platform.OS === 'web') {
    useDialog.setState({ current: { title, message, actions, sheet: true } });
    return;
  }
  showDialog(title, message, actions);
}
