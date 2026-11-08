import type { ConfigContext, ExpoConfig } from 'expo/config';

// Extends app.json. Google Sign-In on iOS needs the "reversed client ID" of the
// iOS OAuth client registered as a URL scheme; derive it from the env var so the
// client ID lives in one place (.env / EAS environment variables).
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const iosUrlScheme = iosClientId
  ? `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, '')}`
  : null;

if (!iosUrlScheme)
  console.warn('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is not set: Google sign-in will not work in iOS builds.');

export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      // without iosUrlScheme the plugin expects native Firebase config files, which we don't use
      ...(iosUrlScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme }] as [string, object]] : []),
    ],
  }) as ExpoConfig;
