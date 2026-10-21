import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // ── Why this exists ──────────────────────────────────────────────────
      // Firestore already keeps the *data* offline (IndexedDB via
      // `persistentLocalCache` in src/lib/firebase.ts). What it cannot do is
      // load the *app* without a network. Without a service worker a driver who
      // reloads in a dead zone — or whose tab the OS evicted — gets the
      // browser's offline error page, even though their queued "Boarded" taps
      // are sitting safely on disk. This precaches the shell so the app boots
      // offline and can reach that data.
      //
      // `autoUpdate` is safe here for the same reason: a reload on deploy
      // cannot lose an attendance write, because pending writes live in
      // IndexedDB, not in memory. It also keeps app code untouched —
      // `injectRegister: 'script'` emits a standalone registerSW.js instead of
      // requiring an import in src/.
      registerType: "autoUpdate",
      injectRegister: "script",

      // Off in dev: a service worker fighting Vite's HMR causes stale-module
      // confusion for no benefit. Exercise offline with
      // `npm run build && npm run preview`.
      devOptions: { enabled: false },

      manifest: {
        name: "School Bus Transit",
        short_name: "School Bus",
        description: "School bus attendance and transit monitoring",
        start_url: "/",
        scope: "/",
        // `standalone` (plus install-to-home-screen) is not cosmetic on iOS:
        // Safari caps script-writable storage for *non-installed* sites and
        // evicts it, which would drop the offline attendance queue.
        display: "standalone",
        // No `orientation`: drivers use portrait phones, directors use desktop.
        // `lang`/`dir` are left to App.tsx, which sets them per-locale.
        background_color: "#f3f4f1", // --color-background in globals.css
        theme_color: "#f3f4f1", // --color-background; matches the meta tag in index.html
        icons: [
          {
            src: "/icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        // The shell plus the self-hosted webfonts — Inter, JetBrains Mono and
        // IBM Plex Sans Arabic are bundled via @fontsource, and without them
        // Arabic text falls back to a system font offline. `.map` files are
        // deliberately excluded: not needed offline, and they would roughly
        // triple the precache.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}"],
        // `@fontsource` emits a legacy woff alongside every woff2 for the same
        // face — 269 KiB of the precache, most of it from the Arabic package.
        // Only clients that can run a service worker can use this precache at
        // all, and every one of those supports woff2, so those woff fallbacks
        // are unreachable here. They stay in dist/ and still serve online; they
        // are simply not downloaded up front.
        //
        // Note the asymmetry with font *subsets*: dropping a format is free,
        // but dropping a subset makes text in that script fall back to a system
        // font. That is a product decision, so subsets are left alone — see
        // AGENTS.md.
        globIgnores: ["**/*.woff"],
        navigateFallback: "/index.html",
        // `/__/*` is Firebase Hosting's reserved namespace (e.g.
        // /__/firebase/init.js). Those must never be answered with the SPA
        // shell.
        navigateFallbackDenylist: [/^\/__\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,

        // ── Do NOT add runtimeCaching routes for Firebase, Auth, or the API ──
        //
        // This list is deliberately EMPTY, and that is load-bearing. An earlier
        // version added `NetworkOnly` routes here as a safety guard, on the
        // theory that "explicitly not caching" is harmless. It is not.
        //
        // Firestore's WebChannel transport falls back to a **long-polling GET**
        // (`.../Listen/channel?...TYPE=xmlhttp`) that stays open for a long
        // time. Any matching route makes Workbox call `respondWith(fetch(...))`,
        // i.e. the service worker now owns that long-lived request — and it
        // fails with "A ServiceWorker intercepted the request and encountered an
        // unexpected error". Firestore then never connects: no roster, no
        // dashboard, and (because the loading gate waits for a *server*
        // snapshot) skeletons forever.
        //
        // Requests that match NO route are never passed to `respondWith`, so the
        // browser handles them natively — exactly what Firestore needs. The
        // protection against a future broad caching rule is therefore this
        // comment plus the test below, not a route.
        //
        // `npm run test:offline` asserts nothing Firebase/API-shaped ever lands
        // in a cache. If you ever do add a route, it must not match
        // firestore.googleapis.com, identitytoolkit.googleapis.com,
        // securetoken.googleapis.com, or the API origin.
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    // Mirrors the `@/*` -> `./src/*` path alias in tsconfig.json.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // The API is a separate origin (and a separate repo). Requests go straight
    // to it via VITE_API_URL rather than through a dev proxy, so local
    // development exercises the same CORS path production does.
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
