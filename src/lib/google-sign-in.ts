// Native Google Sign-In → Firebase credential.
//
// The native module is required lazily: it isn't in Expo Go, and importing it
// there throws, which would take the whole app (including demo mode) down.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { GoogleAuthProvider, signInWithCredential, type Auth } from 'firebase/auth';

import { getLang } from './i18n';

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

let mod: GoogleModule | null = null;
let configured = false;

async function google(): Promise<GoogleModule> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    throw new Error(
      getLang() === 'ar'
        ? 'يتطلب تسجيل الدخول بحساب Google نسخة تطوير (development build) ولا يعمل في Expo Go. جرّب التطبيق دون حساب بدلاً من ذلك.'
        : 'Google sign-in needs a development build; it does not work in Expo Go. Try it without an account instead.',
    );
  }
  if (!mod) mod = await import('@react-native-google-signin/google-signin');
  if (!configured) {
    mod.GoogleSignin.configure({
      // must be the *Web* client ID: it's the audience Firebase accepts for the ID token
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    });
    configured = true;
  }
  return mod;
}

/** Returns false if the user cancelled. */
export async function signInWithGoogleFirebase(auth: Auth): Promise<boolean> {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = await google();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return false;
    const idToken = res.data.idToken;
    if (!idToken) throw new Error('Google did not return an ID token (check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).');
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return true;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return false;
    throw e;
  }
}

/** Forget the Google account too, so the next sign-in shows the account picker. */
export async function signOutGoogle() {
  if (!mod) return;
  try {
    await mod.GoogleSignin.signOut();
  } catch {}
}
