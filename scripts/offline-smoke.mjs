/**
 * Offline smoke test — proves the built app cold-starts with no network.
 *
 * Why this exists: the offline guarantee is the load-bearing reason the service
 * worker is here at all (see the VitePWA block in vite.config.ts). Nothing else
 * in the repo verifies it, and it is easy to break silently — a wrong
 * `navigateFallback`, a precache glob that misses a chunk, or a route that
 * accidentally caches Firestore traffic would all look fine until a driver is in
 * a dead zone.
 *
 * What it does:
 *   1. serves `dist/` over HTTP
 *   2. drives headless Chrome over the DevTools Protocol (raw WebSocket, no deps)
 *   3. asserts the shell + fonts are precached and privileged traffic is not
 *   4. **stops the server**, reloads, and asserts the document was served
 *      `fromServiceWorker` and the SPA actually rendered
 *   5. navigates to a deep link offline to exercise `navigateFallback`
 *
 * Usage:
 *   npm run build && npm run test:offline
 *
 * Requires a Chrome/Chromium binary. Set CHROME_PATH to point at one; otherwise
 * common locations are probed and the script exits 0 (skipped) if none is found,
 * so it is safe to wire into an environment that has no browser.
 */
import { createServer } from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.OFFLINE_TEST_PORT ?? 4188);
const CDP_PORT = Number(process.env.OFFLINE_TEST_CDP_PORT ?? 9333);

// Scratch state goes in the OS temp dir, NOT under the repo. Chrome puts its
// process-singleton unix socket in $TMPDIR, and that path is capped at ~108
// chars on Linux — a path under node_modules/.cache blows straight past it and
// chrome dies with "Socket path too long". Hence: short base, and $TMPDIR left
// as the bare temp root.
const SCRATCH = join(tmpdir(), "sb-offline-smoke");
const PROFILE = join(SCRATCH, "profile");
const HOME_DIR = join(SCRATCH, "home");
const TMP_DIR = tmpdir();

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".map": "application/json",
  ".svg": "image/svg+xml",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Chrome's offline error page is identifiable by its copy. The app sets its own
// per-route <title>, so the title is not a reliable signal.
const ERROR_PAGE =
  /ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|Checking the network cables|Press space to play|This site can.t be reached/;
const isErrorPage = (t) => ERROR_PAGE.test(t ?? "");

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  for (const c of candidates) if (existsSync(c)) return c;

  // Playwright's browser cache, if present.
  const cache = join(process.env.HOME ?? "", ".cache", "ms-playwright");
  if (existsSync(cache)) {
    for (const dir of readdirSync(cache)) {
      for (const rel of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
        const p = join(cache, dir, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

const CHROME = findChrome();
if (!CHROME) {
  console.log("offline-smoke: no Chrome/Chromium found — skipping. Set CHROME_PATH to run it.");
  process.exit(0);
}
if (!existsSync(join(DIST, "index.html"))) {
  console.error("offline-smoke: dist/index.html not found — run `npm run build` first.");
  process.exit(1);
}

setTimeout(() => {
  console.log("\nWATCHDOG: exceeded 120s, aborting");
  process.exit(2);
}, 120_000);

const step = (m) => console.log(`  .. ${m}`);

// ── static server ──────────────────────────────────────────────────────────
const sockets = new Set();
const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let filePath = join(DIST, normalize(urlPath).replace(/^(\.\.[/\\])+/, ""));
  if (urlPath === "/" || !extname(urlPath)) filePath = join(DIST, "index.html");
  if (!existsSync(filePath)) {
    res.writeHead(404).end("not found");
    return;
  }
  const body = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
    // Mirrors firebase.json: html revalidates, fingerprinted assets are immutable.
    "Cache-Control":
      extname(filePath) === ".html"
        ? "no-cache"
        : "public, max-age=31536000, immutable",
  });
  res.end(body);
});
server.on("connection", (s) => {
  sockets.add(s);
  s.on("close", () => sockets.delete(s));
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
console.log(`static server: http://127.0.0.1:${PORT}`);

async function stopServer() {
  for (const s of sockets) s.destroy();
  sockets.clear();
  if (server.listening) await new Promise((r) => server.close(r));
}

// ── chrome ─────────────────────────────────────────────────────────────────
await mkdir(HOME_DIR, { recursive: true });
await mkdir(TMP_DIR, { recursive: true });
await mkdir(PROFILE, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-crash-reporter",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "about:blank",
  ],
  {
    stdio: ["ignore", "ignore", "pipe"],
    // Chrome writes to $HOME and $TMPDIR; keep them inside the scratch dir so
    // this works in restricted environments.
    env: { ...process.env, HOME: HOME_DIR, TMPDIR: TMP_DIR },
  },
);
chrome.stderr.on("data", () => {});

async function cdpTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(
        `http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,
        { method: "PUT" },
      );
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("chrome devtools endpoint never came up");
}

const wsUrl = await cdpTarget();
step("devtools target created");
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => {
  ws.addEventListener("open", res, { once: true });
  ws.addEventListener("error", rej, { once: true });
});
step("cdp websocket open");

let msgId = 0;
const pending = new Map();
const responses = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  } else if (msg.method === "Network.responseReceived") {
    responses.push(msg.params);
  }
});

function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) return { __error: r.exceptionDetails.text };
  return r.result.value;
}

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const finish = async () => {
  ws.close();
  chrome.kill("SIGKILL");
  await stopServer().catch(() => {});
  await rm(SCRATCH, { recursive: true, force: true }).catch(() => {});
  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed` +
      (failed.length ? ` — FAILED: ${failed.map((f) => f.name).join(", ")}` : ""),
  );
  process.exit(failed.length ? 1 : 0);
};

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
step("domains enabled");

// ── 1. online load ─────────────────────────────────────────────────────────
await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });
step("navigate issued");
await sleep(2500);
check("page loads online", true);

let controlled = false;
for (let i = 0; i < 60; i++) {
  controlled = await evaluate(
    `!!navigator.serviceWorker.controller && navigator.serviceWorker.controller.state === 'activated'`,
  );
  if (controlled === true) break;
  await sleep(250);
}
check("service worker activated and controlling", controlled === true);

// ── 2. shell is precached ──────────────────────────────────────────────────
const precache = await evaluate(`
  (async () => {
    const names = await caches.keys();
    const pre = names.find(n => n.includes('precache'));
    if (!pre) return { names, cached: [] };
    const c = await caches.open(pre);
    const keys = await c.keys();
    return { names, cached: keys.map(r => new URL(r.url).pathname) };
  })()
`);
const cached = precache.cached ?? [];
check("precache populated", cached.length > 0, `${cached.length} entries`);
check("/index.html precached", cached.includes("/index.html"));
check("/manifest.webmanifest precached", cached.includes("/manifest.webmanifest"));
check("/sw.js is NOT precached (must stay live)", !cached.includes("/sw.js"));
check("no sourcemaps precached", !cached.some((p) => p.endsWith(".map")));
const woff2 = cached.filter((p) => p.endsWith(".woff2")).length;
check("self-hosted webfonts precached", woff2 > 0, `${woff2} woff2`);
const legacyWoff = cached.filter((p) => p.endsWith(".woff"));
check(
  "legacy .woff is NOT precached (unreachable: every SW client supports woff2)",
  legacyWoff.length === 0,
  `${legacyWoff.length} woff entries`,
);
const iconFonts = cached.filter((p) => p.includes("material-symbols"));
check(
  "self-hosted icon fonts precached (no CDN dependency)",
  iconFonts.length === 2,
  `${iconFonts.length} icon font files`,
);
// A font that fails to load leaves the icon rendering as its literal ligature
// name, which is the exact bug the self-hosted subset replaced. Measuring is the
// only way to catch it: the DOM text is the name either way.
const iconProbe = await evaluate(`
  (async () => {
    await document.fonts.ready;
    const width = (family) => {
      const el = document.createElement('span');
      el.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:24px;font-family:' + family;
      el.textContent = 'directions_bus';
      document.body.appendChild(el);
      const w = el.getBoundingClientRect().width;
      el.remove();
      return w;
    };
    return {
      loaded: document.fonts.check('24px "Material Symbols Rounded"'),
      withFont: width('"Material Symbols Rounded"'),
      fallback: width('monospace'),
    };
  })()
`);
check(
  "Material Symbols renders a glyph, not its ligature name",
  iconProbe?.loaded === true && iconProbe.withFont < iconProbe.fallback * 0.5,
  `loaded=${iconProbe?.loaded}, ${iconProbe?.withFont?.toFixed(1)}px vs fallback ${iconProbe?.fallback?.toFixed(1)}px`,
);
check(
  "driver + dashboard chunks precached",
  // Route entry chunks are named after their page; the Firebase SDK chunk's
  // name is meaningless (Vite names it after whichever module it bundles), so
  // assert the real dashboard routes rather than that incidental name.
  cached.some((p) => p.includes("index-")) &&
    cached.some((p) => p.includes("DashboardPage-")) &&
    cached.some((p) => p.includes("ReportsPage-")),
);

// ── 3. nothing privileged may be cached ────────────────────────────────────
const allCached = await evaluate(`
  (async () => {
    const out = [];
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      for (const req of await c.keys()) out.push(req.url);
    }
    return out;
  })()
`);
check(
  "no Firebase / API traffic in any cache",
  !allCached.some((u) =>
    /firestore\.googleapis|identitytoolkit|securetoken|localhost:8080/.test(u),
  ),
);
const offOrigin = allCached.filter((u) => !u.startsWith(`http://127.0.0.1:${PORT}/`));
check(
  "only the font CDNs are cached cross-origin",
  offOrigin.every((u) => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)),
  `${offOrigin.length} cross-origin entr${offOrigin.length === 1 ? "y" : "ies"}`,
);

// ── 4. app actually mounted online ─────────────────────────────────────────
const onlineBoot = await evaluate(`({
  title: document.title,
  rootChildren: document.getElementById('root')?.childElementCount ?? 0
})`);
check(
  "app mounted online",
  onlineBoot.rootChildren > 0,
  `#root children=${onlineBoot.rootChildren}, title="${onlineBoot.title}"`,
);

// ── 5. genuinely remove the network, then cold-start ───────────────────────
await stopServer();
console.log("static server: STOPPED (network genuinely gone)");
responses.length = 0;

// A normal reload — NOT ignoreCache. A hard reload bypasses the service worker
// in Chrome and would fail even in a correct implementation.
await send("Page.reload");
await sleep(4000);

const docResponse = responses.find(
  (r) => r.type === "Document" && r.response?.url?.startsWith(`http://127.0.0.1:${PORT}/`),
);
check(
  "offline navigation was served by the service worker",
  docResponse?.response?.fromServiceWorker === true,
  docResponse
    ? `fromServiceWorker=${docResponse.response.fromServiceWorker}, status=${docResponse.response.status}`
    : "no document response observed",
);

const offlineBoot = await evaluate(`({
  title: document.title,
  rootChildren: document.getElementById('root')?.childElementCount ?? 0,
  text: (document.body.innerText || '').trim().slice(0, 120)
})`);
check(
  "app cold-starts offline with #root rendered",
  offlineBoot.rootChildren > 0,
  `#root children=${offlineBoot.rootChildren}, title="${offlineBoot.title}"`,
);
check(
  "offline document is the SPA, not a browser error page",
  !isErrorPage(offlineBoot.text),
  `title="${offlineBoot.title}"`,
);
console.log(`\n  offline body text: ${JSON.stringify(offlineBoot.text)}`);

// ── 6. SPA deep link offline (navigateFallback) ────────────────────────────
responses.length = 0;
await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/drivers` });
await sleep(3500);

const deepResponse = responses.find(
  (r) => r.type === "Document" && r.response?.url?.startsWith(`http://127.0.0.1:${PORT}/`),
);
check(
  "offline deep link served by service worker",
  deepResponse?.response?.fromServiceWorker === true,
  deepResponse
    ? `fromServiceWorker=${deepResponse.response.fromServiceWorker}, status=${deepResponse.response.status}`
    : "no document response",
);

const deepLink = await evaluate(`({
  title: document.title,
  rootChildren: document.getElementById('root')?.childElementCount ?? 0,
  text: (document.body.innerText || '').trim().slice(0, 80)
})`);
check(
  "offline SPA deep link renders (navigateFallback)",
  deepLink.rootChildren > 0 && !isErrorPage(deepLink.text),
  `#root children=${deepLink.rootChildren}, title="${deepLink.title}"`,
);

await finish();
