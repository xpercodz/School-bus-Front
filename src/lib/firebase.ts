/**
 * Firebase client — the single place Firebase is initialized.
 *
 * Reads the web-app config from `VITE_FIREBASE_*` (filled in `.env.local`).
 * These are public client keys by design — the security model lives in Firestore
 * security rules, not in hiding these values.
 *
 * Until the config is filled, `isFirebaseConfigured` is false and `db`/`auth`
 * are null; every data hook checks that and the UI shows a sign-in prompt rather
 * than mock data.
 */

import { getApps, getApp, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** True once the env config is filled in (apiKey + projectId + appId). */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

/**
 * Firestore with the persistent (IndexedDB) local cache.
 *
 * This is what makes the app survive a bus route with no signal: reads are
 * served from disk when the network drops, and attendance writes are queued
 * durably and replayed on reconnect, so a "Boarded" tap in a dead zone is not
 * lost even if the app is closed before the network returns. Without it the SDK
 * only keeps a memory cache, and a reload discards pending writes.
 *
 * `persistentMultipleTabManager` keeps the cache coherent when a director has
 * several dashboard tabs open. IndexedDB can be unavailable (private mode,
 * locked-down browsers), so this falls back to the default memory cache rather
 * than failing to boot.
 */
function createFirestore(firebaseApp: FirebaseApp): Firestore {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // Already initialized (dev HMR) or no IndexedDB — degrade gracefully.
    return getFirestore(firebaseApp);
  }
}

// Auth/Firestore are browser-only SDKs; guard so importing this module in a
// non-DOM context (tests, tooling) doesn't try to initialize them.
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (typeof window !== "undefined" && isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = createFirestore(app);
}

export { auth, db };
