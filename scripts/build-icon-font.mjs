/**
 * Regenerate the self-hosted Material Symbols subset.
 *
 * `public/fonts/*.woff2` are generated artifacts, committed so the app has no
 * runtime CDN dependency (see AGENTS.md). Re-run this whenever an icon name is
 * added, changed, or removed.
 *
 *   node scripts/build-icon-font.mjs
 *
 * Why a subset: the full Material Symbols variable font is ~5.2 MiB per family.
 * Google's API can return only the glyphs actually referenced, which for this app
 * is 49 icons ≈ 67 KiB (Rounded) + 48 KiB (Outlined) — roughly 1% of the full
 * font, and small enough for the service worker to precache so icons work
 * offline.
 *
 * Icon names are collected three ways:
 *   1. static JSX:     <Icon name="search_off" />
 *   2. data lookups:   ANY property ending in `Icon`, e.g. `icon: "how_to_reg"`
 *      or `footerIcon: "warning"`. The broad match matters: matching only
 *      `icon:` silently dropped `warning`, which rendered the literal word
 *      "WARNING" on the live dashboard. Prefer over-broad here — a spare glyph
 *      costs a few hundred bytes, a missing one is a visible bug.
 *   3. EXTRA_ICONS below — for names built dynamically, which no grep can see
 *      (e.g. TopAppBar picks "arrow_back"/"arrow_forward" by text direction).
 *
 * Getting this wrong is not fatal: a missing icon renders as its ligature name
 * (the literal word), which is exactly the bug this replaced.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = join(ROOT, "src");
const OUT_DIR = join(ROOT, "public", "fonts");

/** Built dynamically in code, so they can't be grepped. Keep in sync by hand. */
const EXTRA_ICONS = [
  "arrow_back",
  "arrow_forward",
  "chevron_left",
  "chevron_right",
  // Chosen at runtime by ternary expressions, so no JSX literal exists:
  "cloud_done",
  "visibility",
  "visibility_off",
  // ThemeToggle chooses light_mode/dark_mode from the resolved theme.
  "dark_mode",
  "light_mode",
  // Passed to a helper function rather than written as a JSX name.
  "school",
  "person_add",
];

const FAMILIES = [
  { id: "Rounded", file: "material-symbols-rounded-subset.woff2" },
  { id: "Outlined", file: "material-symbols-outlined-subset.woff2" },
];

// Google returns woff2 only for a UA it believes supports it.
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if ([".ts", ".tsx"].includes(extname(p))) out.push(p);
  }
  return out;
}

function collectIcons() {
  const found = new Set(EXTRA_ICONS);
  for (const file of walk(SRC)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/<Icon\b[^>]*?\bname="([a-z0-9_]+)"/gs)) {
      found.add(m[1]);
    }
    // Any property ending in `Icon` — `icon:`, `footerIcon:`, `leadingIcon:` …
    for (const m of text.matchAll(/\b[A-Za-z_]*[Ii]con\s*:\s*"([a-z0-9_]+)"/g)) {
      found.add(m[1]);
    }
    // JSX props are the third shape: `<IconButton icon="notifications" />`.
    // This is deliberately separate from the colon form above — an earlier
    // version only matched `icon:` and shipped a subset without the top bar's
    // notifications/help/settings glyphs, so they rendered as literal words.
    for (const m of text.matchAll(/\b[A-Za-z_]*[Ii]con\s*=\s*"([a-z0-9_]+)"/g)) {
      found.add(m[1]);
    }
  }
  // Google requires icon_names to be sorted.
  return [...found].sort();
}

const icons = collectIcons();
console.log(`collected ${icons.length} icons: ${icons.join(", ")}`);

mkdirSync(OUT_DIR, { recursive: true });

const written = [];
for (const { id, file } of FAMILIES) {
  const api =
    `https://fonts.googleapis.com/css2?family=Material+Symbols+${id}` +
    `:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200` +
    `&icon_names=${icons.join(",")}&display=block`;

  const css = await fetch(api, { headers: { "User-Agent": UA } }).then((r) => {
    if (!r.ok) throw new Error(`${id}: CSS request failed (${r.status})`);
    return r.text();
  });

  // The subset endpoint returns a /l/font?kit=... URL, not a *.woff2 path.
  const url = css.match(/src:\s*url\((https:\/\/[^)]+)\)/)?.[1];
  if (!url) throw new Error(`${id}: no font URL in the returned CSS`);

  const buf = Buffer.from(
    await fetch(url, { headers: { "User-Agent": UA } }).then((r) => {
      if (!r.ok) throw new Error(`${id}: font download failed (${r.status})`);
      return r.arrayBuffer();
    }),
  );

  // Fail loudly rather than shipping a truncated or HTML error page.
  if (buf.subarray(0, 4).toString("latin1") !== "wOF2") {
    throw new Error(`${id}: downloaded bytes are not a woff2 font`);
  }

  writeFileSync(join(OUT_DIR, file), buf);
  written.push({ id, file, bytes: buf.length });
  console.log(`  ${file}  ${(buf.length / 1024).toFixed(1)} KiB`);
}

const total = written.reduce((n, w) => n + w.bytes, 0);
console.log(`\nwrote ${written.length} fonts, ${(total / 1024).toFixed(1)} KiB total`);
console.log("now rebuild so the service worker picks up the new revisions.");
