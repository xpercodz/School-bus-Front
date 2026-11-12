/**
 * Fails the build when the source uses a Material Symbols name that the
 * generated subset does not contain.
 *
 * Why this exists: the icons are a *build artifact* (`public/fonts/*.woff2`,
 * made by `scripts/build-icon-font.mjs`). Adding an `<Icon name="…">` without
 * re-running that script does not fail anything — the glyph is simply absent,
 * and its ligature falls back to the literal text, so a button ends up reading
 * "EXPAND_MORE". That shipped once. The manifest is written by the generator;
 * this compares it to the source, offline, in a second.
 *
 *   node scripts/check-icons.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = join(ROOT, "src");
const MANIFEST = join(ROOT, "public", "fonts", "icon-manifest.json");

/** Same three shapes the generator collects (see build-icon-font.mjs). */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if ([".ts", ".tsx"].includes(extname(p))) out.push(p);
  }
  return out;
}

function collectUsed() {
  const found = new Set();
  for (const file of walk(SRC)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/<Icon\b[^>]*?\bname="([a-z0-9_]+)"/gs)) found.add(m[1]);
    for (const m of text.matchAll(/\b[A-Za-z_]*[Ii]con\s*:\s*"([a-z0-9_]+)"/g)) found.add(m[1]);
    for (const m of text.matchAll(/\b[A-Za-z_]*[Ii]con\s*=\s*"([a-z0-9_]+)"/g)) found.add(m[1]);
  }
  return found;
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
} catch {
  console.error(
    "check-icons: no public/fonts/icon-manifest.json — run `node scripts/build-icon-font.mjs` once.",
  );
  process.exit(1);
}

const subset = new Set(manifest.icons);
const missing = [...collectUsed()].filter((name) => !subset.has(name)).sort();

if (missing.length > 0) {
  console.error(
    `check-icons: ${missing.length} icon(s) missing from the generated subset: ${missing.join(", ")}`,
  );
  console.error("They would render as literal words. Run: node scripts/build-icon-font.mjs && npm run build");
  process.exit(1);
}

console.log(`check-icons: ${subset.size} glyphs in the subset, all used names covered.`);
