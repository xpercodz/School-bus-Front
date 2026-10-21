/**
 * Ask the browser to exempt this origin's storage from eviction.
 *
 * The durable part of offline support is not the service worker — it is the
 * IndexedDB write queue behind Firestore's `persistentLocalCache` (see
 * `lib/firebase.ts`). The service worker only gets the app to boot; this is what
 * keeps a queued "Boarded" tap from being discarded under storage pressure.
 *
 * Best-effort by design. Chrome grants silently based on engagement heuristics,
 * Firefox may prompt, and Safari historically ignores the call unless the app is
 * installed to the home screen. Denial is not fatal — the app still runs, it
 * just loses the guarantee that unsent writes survive — so startup never awaits
 * this and never surfaces a failure to the user.
 */
export async function requestPersistentStorage(): Promise<void> {
  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  if (!storage?.persist || !storage.persisted) return;

  try {
    if (await storage.persisted()) return;
    if (!(await storage.persist())) {
      // Expected on Safari unless the app is installed to the Home Screen, so
      // say so rather than letting this read as an unexplained bug. Devtools
      // only — but it is the one signal that the durability guarantee above is
      // weaker than intended.
      console.warn(
        "[storage] Persistent storage not granted (expected on Safari unless installed to the Home Screen) — offline attendance writes may be evicted.",
      );
    }
  } catch {
    // Some browsers throw here (notably in private mode). Degrade silently:
    // the app works, it just has a weaker durability guarantee.
  }
}
