/**
 * Reload the page when a newly deployed service worker takes control.
 *
 * Registration itself is handled by the `registerSW.js` that vite-plugin-pwa
 * injects, so this only observes the handover.
 *
 * Why this is needed: `registerType: 'autoUpdate'` (see vite.config.ts) makes the
 * new worker call `skipWaiting()` + `clientsClaim()`, so it takes over an
 * *already open* page — and `cleanupOutdatedCaches` then deletes the previous
 * precache. Without a reload that leaves the running page executing the old JS
 * while its route chunks are gone, so the next lazy navigation would request a
 * hashed file that no longer exists on Hosting. Firebase's SPA rewrite would
 * answer that with index.html, i.e. HTML parsed as a JS module — a broken route
 * with a confusing error. Reloading keeps the page and the precache on the same
 * version.
 *
 * Reloading is safe here for the same reason `autoUpdate` is: pending attendance
 * writes live in Firestore's IndexedDB queue, not in memory.
 */
export function reloadOnServiceWorkerUpdate(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  // A first-ever install also fires `controllerchange`. Nothing can be stale in
  // that case, and reloading would just be a pointless flash on first visit.
  if (!navigator.serviceWorker.controller) return;

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}
