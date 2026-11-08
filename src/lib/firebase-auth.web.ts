// Web (quick previews): Firebase's default browser persistence.
import type { FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

export function createAuth(app: FirebaseApp): Auth {
  return getAuth(app);
}
