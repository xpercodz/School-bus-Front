import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArchiveSet } from "../src/lib/sheet-archive.ts";

const ada = { id: "s1", name: "Ada", grade: "4A" };
const bo = { id: "s2", name: "Bo", grade: "4A" };
const cy = { id: "s3", name: "Cy", grade: "4B" };

test("archives a child the sheet no longer names", () => {
  const out = buildArchiveSet([ada, bo, cy], new Set(["s1", "s2"]));
  assert.deepEqual(out.map((c) => c.id), ["s3"]);
});

test("keeps a child the sheet matched, even if his row was reported", () => {
  // A row rejected for an unknown bus still names him: his place on the
  // roster was not questioned.
  const out = buildArchiveSet([ada, bo], new Set(["s1", "s2"]));
  assert.deepEqual(out, []);
});

test("archives nobody when the sheet could not be read as a roster", () => {
  assert.deepEqual(buildArchiveSet([ada, bo], null), []);
});

test("returns the full child, so the preview can name him", () => {
  const out = buildArchiveSet([ada], new Set());
  assert.deepEqual(out, [{ id: "s1", name: "Ada", grade: "4A" }]);
});
