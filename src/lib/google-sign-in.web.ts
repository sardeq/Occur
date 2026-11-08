// Web (quick previews): Firebase's own Google popup.
import { GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth';

/** Returns false if the user closed the popup. */
export async function signInWithGoogleFirebase(auth: Auth): Promise<boolean> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
    return true;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return false;
    throw e;
  }
}

export async function signOutGoogle() {}
