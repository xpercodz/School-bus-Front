/**
 * Sheet import — read a roster spreadsheet in the browser and turn it into a
 * bus re-assignment plan.
 *
 * Deliberately dependency-free. An .xlsx is a zip, so the reader is the
 * platform's own: `DecompressionStream("deflate-raw")` for the entries and
 * `DOMParser` for the XML. A spreadsheet library would be ~200 KiB on a device
 * that opens this screen on a bus with no signal, for one dialog.
 *
 * Reads cells as strings only; the assignment plan matches names, never
 * formulas or formats.
 */
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchSchoolId } from "@/lib/school-id";
import { logAudit } from "@/lib/audit";

// ── types ────────────────────────────────────────────────────────────────────

export interface ParsedSheet {
  fileName: string;
  sheetName: string;
  /** Header row as written. */
  columns: string[];
  /** Data rows, aligned to `columns`. */
  rows: string[][];
}

export type ImportField = "studentName" | "grade" | "bus" | "ignore";

export interface ColumnMatch {
  index: number;
  header: string;
  field: ImportField;
  via: "exact" | "alias" | null;
}

/** A child the sheet corrects: one move, one class change, or both. */
export interface AssignmentPlanRow {
  studentId: string;
  studentName: string;
  /** Null when the row does not touch the bus. */
  toBusId: string | null;
  /** Null when the row does not touch the class. */
  toClass: string | null;
}

/** A child the sheet brings in — the row matched no one on the roll. */
export interface AssignmentPlanCreate {
  name: string;
  className: string;
  busId: string | null;
}

/** One class as the sheet spells it, and how many rows carry it. */
export interface AssignmentPlanClass {
  /** The label that will be written: the school's own spelling when it exists. */
  label: string;
  count: number;
  /** True when no child in the school is in this class yet. */
  isNew: boolean;
}

export interface AssignmentPlan {
  rows: AssignmentPlanRow[];
  creates: AssignmentPlanCreate[];
  classes: AssignmentPlanClass[];
  unchanged: number;
  unmatched: string[];
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/** Strip a UTF-8 BOM (Excel writes one so it can detect the encoding). */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Count delimiters outside quotes on the first record. Commas win when present
 * (the CSV the app exports is comma-separated); otherwise `;` and tabs are
 * tolerated, which is what most European Excel installs produce.
 */
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char in counts) counts[char]++;
    if (!inQuotes && (char === "\n" || char === "\r")) break;
  }
  if (counts[","] > 0) return ",";
  if (counts[";"] > 0) return ";";
  if (counts["\t"] > 0) return "\t";
  return ",";
}

/**
 * RFC4180-ish reader: quoted fields, `""` as an escaped quote, embedded
 * newlines inside quotes, CRLF / LF / lone-CR record separators and a trailing
 * record without a newline.
 */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let quotePending = false;
  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
          // A quote that closes the field: anything after it up to the next
          // delimiter is ignored rather than glued onto the value.
          quotePending = true;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field.trim() === "" && !quotePending) {
      inQuotes = true;
      field = "";
      continue;
    }
    if (char === delimiter) {
      endField();
      quotePending = false;
      continue;
    }
    if (char === "\n") {
      endRow();
      quotePending = false;
      continue;
    }
    if (char === "\r") {
      endRow();
      quotePending = false;
      if (text[i + 1] === "\n") i++;
      continue;
    }
    field += char;
  }
  // Final record when the file does not end with a newline.
  if (field !== "" || row.length > 0 || quotePending) endRow();
  return rows;
}

function parseCsv(text: string): string[][] {
  const clean = stripBom(text);
  if (clean === "") return [];
  return parseDelimited(clean, detectDelimiter(clean));
}

// ── XLSX (zip + XML, no library) ─────────────────────────────────────────────

/** Zip signatures: local file header and end-of-central-directory. */
const ZIP_LOCAL_HEADER = 0x04034b50;
const ZIP_CENTRAL_HEADER = 0x02014b50;
const ZIP_EOCD = 0x06054b50;
/** Legacy .xls is an OLE2 compound file, not a zip. */
const OLE_HEADER = [0xd0, 0xcf, 0x11, 0xe0];

interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflate. Everything else is unsupported. */
  method: number;
  compressedSize: number;
  localOffset: number;
}

function isZip(buffer: Uint8Array): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

function isOle(buffer: Uint8Array): boolean {
  return OLE_HEADER.every((byte, index) => buffer[index] === byte);
}

function dataView(buffer: Uint8Array): DataView {
  return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/** Read the zip central directory (the local headers alone can lack sizes). */
function readZipDirectory(buffer: Uint8Array): Map<string, ZipEntry> {
  const view = dataView(buffer);
  // The end record sits in the last 22 bytes unless a zip comment pushes it
  // back, so scan back over the comment's 64 KiB maximum.
  const earliest = Math.max(0, buffer.length - 0xffff - 22);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= earliest; i--) {
    if (view.getUint32(i, true) === ZIP_EOCD) {
      eocd = i;
      break;
    }
  }
  const notZip = new Error(
    "This file is not a readable .xlsx workbook. Save the sheet as .xlsx or .csv and try again.",
  );
  if (eocd < 0) throw notZip;

  const count = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (centralOffset === 0xffffffff) throw notZip; // ZIP64 — not worth supporting.

  const entries = new Map<string, ZipEntry>();
  let offset = centralOffset;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > buffer.length || view.getUint32(offset, true) !== ZIP_CENTRAL_HEADER) {
      break;
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) throw notZip;
    const name = new TextDecoder("utf-8").decode(
      buffer.subarray(offset + 46, offset + 46 + nameLength),
    );
    entries.set(name, { name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Inflate one zip entry (stored entries are copied as-is). */
async function readZipEntry(buffer: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = dataView(buffer);
  if (
    entry.localOffset + 30 > buffer.length ||
    view.getUint32(entry.localOffset, true) !== ZIP_LOCAL_HEADER
  ) {
    throw new Error("This .xlsx file is damaged: a zip entry could not be found.");
  }
  // The local header repeats the name/extra lengths, and its size fields are
  // commonly zero (a data descriptor follows the bytes instead), so the sizes
  // come from the central directory read above.
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const stored = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return stored;
  if (entry.method !== 8) {
    throw new Error(`Unsupported .xlsx compression (method ${entry.method}).`);
  }
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "This browser cannot read .xlsx files. Save the sheet as .csv and try again.",
    );
  }
  const inflated = stored.slice().buffer;
  const stream = new Blob([inflated])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

function parseXml(text: string, label: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error(`This .xlsx file is damaged: ${label} could not be read.`);
  }
  return doc;
}

/** Elements by local name — namespace-wildcard so prefixed parts still match. */
function findAll(root: Document | Element, localName: string): Element[] {
  return Array.from(root.getElementsByTagNameNS("*", localName));
}

/** Direct child elements with a given local name. */
function childrenOf(node: Element, localName: string): Element[] {
  return Array.from(node.children).filter((child) => child.localName === localName);
}

/** Plain text of a `<si>`, `<is>` or `<r>` node (runs concatenated). */
function textOf(node: Element): string {
  let text = "";
  for (const child of Array.from(node.children)) {
    if (child.localName === "t") text += child.textContent ?? "";
    else if (child.localName === "r") {
      for (const run of Array.from(child.children)) {
        if (run.localName === "t") text += run.textContent ?? "";
      }
    }
    // rPh (phonetic guide runs) is deliberately skipped.
  }
  return text;
}

function parseSharedStrings(xml: string): string[] {
  return findAll(parseXml(xml, "the shared strings"), "si").map(textOf);
}

/** 0-based column index from an A1-style reference ("C7" → 2); -1 when absent. */
function columnIndexFromRef(ref: string): number {
  let value = 0;
  let letters = 0;
  for (const char of ref) {
    const code = char.toUpperCase().charCodeAt(0);
    if (code < 65 || code > 90) break;
    value = value * 26 + (code - 64);
    letters++;
  }
  return letters === 0 ? -1 : value - 1;
}

/** One cell as a string (shared strings resolved, numbers/bools stringified). */
function cellValue(cell: Element, sharedStrings: readonly string[]): string {
  const type = cell.getAttribute("t") ?? "";
  if (type === "inlineStr") {
    const inline = childrenOf(cell, "is")[0];
    return inline ? textOf(inline) : "";
  }
  const raw = childrenOf(cell, "v")[0]?.textContent ?? "";
  if (type === "s") {
    const index = Number(raw);
    return Number.isInteger(index) ? (sharedStrings[index] ?? "") : "";
  }
  if (type === "b") return raw === "1" ? "TRUE" : raw === "0" ? "FALSE" : raw;
  return raw;
}

/** The first worksheet as a rectangular-ish matrix (empty cells omitted). */
function parseWorksheet(xml: string, sharedStrings: readonly string[]): string[][] {
  const sheetData = findAll(parseXml(xml, "the worksheet"), "sheetData")[0];
  if (!sheetData) return [];

  const byRow = new Map<number, string[]>();
  let nextRow = 0;
  let maxRow = 0;
  for (const rowElement of childrenOf(sheetData, "row")) {
    const declared = Number(rowElement.getAttribute("r"));
    const rowIndex = Number.isInteger(declared) && declared > 0 ? declared - 1 : nextRow;
    nextRow = rowIndex + 1;
    const cells: string[] = [];
    let nextColumn = 0;
    for (const cell of childrenOf(rowElement, "c")) {
      const ref = cell.getAttribute("r") ?? "";
      const declaredColumn = columnIndexFromRef(ref);
      const column = declaredColumn >= 0 ? declaredColumn : nextColumn;
      nextColumn = column + 1;
      const value = cellValue(cell, sharedStrings);
      if (value === "") continue;
      while (cells.length < column) cells.push("");
      cells[column] = value;
    }
    byRow.set(rowIndex, cells);
    if (rowIndex > maxRow) maxRow = rowIndex;
  }

  const matrix: string[][] = [];
  for (let i = 0; i <= maxRow; i++) matrix.push(byRow.get(i) ?? []);
  return matrix;
}

/** `xl/_rels/workbook.xml.rels` Target → a zip path, resolved against `xl/`. */
function resolvePartPath(target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const segments: string[] = [];
  for (const segment of `xl/${target}`.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return segments.join("/");
}

/** Sheet name + relationship id of the workbook's first sheet. */
function firstSheet(workbookXml: string): { name: string; relId: string | null } {
  const sheet = findAll(parseXml(workbookXml, "the workbook"), "sheet")[0];
  if (!sheet) return { name: "", relId: null };
  let relId: string | null = null;
  for (const attribute of Array.from(sheet.attributes)) {
    // `r:id` — the relationship namespace's prefix varies between writers.
    if (attribute.localName === "id") relId = attribute.value;
  }
  return { name: sheet.getAttribute("name") ?? "", relId };
}

function worksheetPath(relsXml: string | null, relId: string | null): string {
  const fallback = "xl/worksheets/sheet1.xml";
  if (!relsXml || !relId) return fallback;
  let doc: Document;
  try {
    doc = parseXml(relsXml, "the workbook relationships");
  } catch {
    return fallback;
  }
  for (const rel of findAll(doc, "Relationship")) {
    if (rel.getAttribute("Id") !== relId) continue;
    const target = rel.getAttribute("Target") ?? "";
    return target ? resolvePartPath(target) : fallback;
  }
  return fallback;
}

async function parseXlsx(fileName: string, buffer: Uint8Array): Promise<ParsedSheet> {
  const entries = readZipDirectory(buffer);
  const readText = async (path: string): Promise<string | null> => {
    const entry = entries.get(path) ?? entries.get(path.toLowerCase());
    return entry ? decodeUtf8(await readZipEntry(buffer, entry)) : null;
  };

  const workbookXml = await readText("xl/workbook.xml");
  if (!workbookXml) {
    throw new Error(
      `"${fileName}" does not look like an Excel workbook. Save the sheet as .xlsx or .csv and try again.`,
    );
  }
  const { name, relId } = firstSheet(workbookXml);
  const preferred = worksheetPath(await readText("xl/_rels/workbook.xml.rels"), relId);
  let sheetXml = await readText(preferred);
  if (!sheetXml && preferred !== "xl/worksheets/sheet1.xml") {
    sheetXml = await readText("xl/worksheets/sheet1.xml");
  }
  if (!sheetXml) {
    throw new Error(`"${fileName}" has no readable worksheet. Save the sheet as .csv and try again.`);
  }

  const sharedXml = await readText("xl/sharedStrings.xml");
  const sharedStrings = sharedXml ? parseSharedStrings(sharedXml) : [];
  return normalizeSheet(fileName, name || fileStem(fileName), parseWorksheet(sheetXml, sharedStrings));
}

// ── shared normalisation ─────────────────────────────────────────────────────

function fileStem(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, "");
}

function hasExtension(fileName: string, extensions: readonly string[]): boolean {
  const lower = fileName.toLowerCase();
  return extensions.some((extension) => lower.endsWith(extension));
}

/**
 * Trim cells, drop fully-empty rows (a blank line in an export is noise that
 * can never match a student), pad/truncate rows to the header width and drop
 * trailing empty columns.
 */
function normalizeSheet(
  fileName: string,
  sheetName: string,
  matrix: readonly (readonly string[])[],
): ParsedSheet {
  const cells = matrix.map((row) => row.map((cell) => (cell ?? "").trim()));
  const rows = cells.filter((row) => row.some((cell) => cell !== ""));
  if (rows.length === 0) return { fileName, sheetName, columns: [], rows: [] };

  let width = 0;
  for (const row of rows) width = Math.max(width, row.length);
  let lastColumn = width - 1;
  while (lastColumn >= 0 && rows.every((row) => (row[lastColumn] ?? "") === "")) lastColumn--;
  if (lastColumn < 0) return { fileName, sheetName, columns: [], rows: [] };

  const aligned = rows.map((row) => {
    const out: string[] = [];
    for (let i = 0; i <= lastColumn; i++) out.push(row[i] ?? "");
    return out;
  });
  return {
    fileName,
    sheetName,
    columns: aligned[0],
    rows: aligned.slice(1),
  };
}

/**
 * Parse a picked file into a header row + data rows.
 *
 * `.xlsx`/`.xlsm` must be a real zip; a legacy binary `.xls` throws a clear
 * error rather than emitting mojibake; anything else is read as delimited text.
 */
export async function parseSheetFile(file: File): Promise<ParsedSheet> {
  const fileName = file.name || "sheet";
  const buffer = new Uint8Array(await file.arrayBuffer());

  // Sniff the bytes first: a real zip is an .xlsx whatever it is named, and a
  // legacy binary .xls is an OLE2 compound file that would otherwise decode as
  // mojibake text.
  if (isZip(buffer)) return parseXlsx(fileName, buffer);
  if (isOle(buffer) || hasExtension(fileName, [".xls"])) {
    throw new Error(
      `"${fileName}" is an old Excel (.xls) file. Save it as .xlsx or .csv and try again.`,
    );
  }
  if (hasExtension(fileName, [".xlsx", ".xlsm"])) {
    throw new Error(
      `"${fileName}" is not a valid .xlsx workbook. Save the sheet as .xlsx or .csv and try again.`,
    );
  }
  return normalizeSheet(fileName, fileStem(fileName), parseCsv(decodeUtf8(buffer)));
}

// ── column guessing ──────────────────────────────────────────────────────────

/** The canonical header for each importable field ("exact" match). */
const FIELD_LABELS: Record<Exclude<ImportField, "ignore">, string> = {
  studentName: "Student Name",
  grade: "Class",
  bus: "Bus",
};

/** Synonyms that are accepted but flagged as "alias". */
const FIELD_ALIASES: Record<Exclude<ImportField, "ignore">, readonly string[]> = {
  studentName: ["student", "name", "full name", "pupil", "child"],
  // "Grade" is the older name for the same column, so a sheet written before the
  // word changed still imports.
  grade: ["class", "grade", "year", "form", "section"],
  bus: ["bus", "bus no", "bus no.", "bus number", "route", "vehicle"],
};

const IMPORT_FIELDS: readonly Exclude<ImportField, "ignore">[] = [
  "studentName",
  "grade",
  "bus",
];

/** Lowercase with spaces/punctuation collapsed: "Bus No." → "bus no". */
function normalizeHeader(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Guess which column is the student name, the grade and the bus. The first
 * column that matches a field claims it (so a second "Name" column is ignored),
 * and a header that is the field's own label beats a synonym in the same
 * column.
 */
export function guessColumns(columns: string[]): ColumnMatch[] {
  const claimed = new Set<Exclude<ImportField, "ignore">>();
  return columns.map((header, index) => {
    const normalized = normalizeHeader(header);
    for (const field of IMPORT_FIELDS) {
      if (!claimed.has(field) && normalizeHeader(FIELD_LABELS[field]) === normalized) {
        claimed.add(field);
        return { index, header, field, via: "exact" as const };
      }
    }
    for (const field of IMPORT_FIELDS) {
      if (claimed.has(field)) continue;
      const isAlias = FIELD_ALIASES[field].some(
        (alias) => normalizeHeader(alias) === normalized,
      );
      if (isAlias) {
        claimed.add(field);
        return { index, header, field, via: "alias" as const };
      }
    }
    return { index, header, field: "ignore" as const, via: null };
  });
}

// ── assignment plan ──────────────────────────────────────────────────────────

/** Match key: lowercase with runs of whitespace collapsed. */
function nameKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The words a class label may carry as a prefix, in the app's three languages.
 * They are the app's own prefixes ("Class 4B"), and an older roster says
 * "Grade 4B", so both must resolve to the same class.
 */
const CLASS_PREFIXES = [
  "class",
  "classe",
  "grade",
  "niveau",
  "year",
  "form",
  "section",
  "الصف",
  "القسم",
] as const;

/**
 * Match key for a class label: "Class 4A", "4a" and "CLASS 4-A" are one class.
 *
 * Classes are still plain strings on the student (`grade`), so this key is what
 * keeps a school's sheet from inventing a second "class a" beside "Class A" —
 * and what lets a sheet written with the new word match a roster stored with
 * the old one.
 */
export function classKey(value: string): string {
  const normalized = normalizeHeader(value);
  if (!normalized) return "";
  for (const prefix of CLASS_PREFIXES) {
    if (normalized.startsWith(`${prefix} `)) {
      return normalized.slice(prefix.length + 1).replace(/\s+/g, "");
    }
  }
  return normalized.replace(/\s+/g, "");
}

function columnFor(matches: readonly ColumnMatch[], field: ImportField): number {
  return matches.find((match) => match.field === field)?.index ?? -1;
}

/**
 * Turn the sheet into one plan: which children it corrects, which it brings in,
 * and what each row's class resolves to.
 *
 * A row whose name matches a child updates that child's class and/or bus. A row
 * that matches no one becomes a NEW child — which is what lets a school import
 * its whole roster — and needs a class to do so, because a class is the fact
 * that puts a child on a class card. Rows that cannot be resolved (a bus the
 * school does not have, a new child with no class) are reported in `unmatched`
 * and never guessed at.
 *
 * Names are the only key, so the class column is what keeps two children who
 * share a name apart, and a repeated row resolves to the last one for its
 * (name, class) pair rather than writing twice.
 */
export function buildAssignmentPlan(plan: {
  sheet: ParsedSheet;
  matches: readonly ColumnMatch[];
  students: readonly {
    id: string;
    name: string;
    grade?: string;
    busId?: string | null;
  }[];
  buses: readonly { id: string; name: string }[];
}): AssignmentPlan {
  const { sheet, matches } = plan;
  const nameIndex = columnFor(matches, "studentName");
  const classIndex = columnFor(matches, "grade");
  const busIndex = columnFor(matches, "bus");

  // Every child carrying a name, so the class column can choose between two
  // children who share one instead of always taking the first.
  const studentsByName = new Map<
    string,
    { id: string; name: string; grade: string; busId: string | null }[]
  >();
  /** The school's own spelling of each class, keyed by `classKey`. */
  const knownClassLabels = new Map<string, string>();
  for (const student of plan.students) {
    const entry = {
      id: student.id,
      name: student.name,
      grade: student.grade ?? "",
      busId: student.busId ?? null,
    };
    const key = nameKey(student.name);
    if (key) {
      const list = studentsByName.get(key);
      if (list) list.push(entry);
      else studentsByName.set(key, [entry]);
    }
    const label = entry.grade.trim().replace(/\s+/g, " ");
    const classMatch = classKey(label);
    if (classMatch && !knownClassLabels.has(classMatch)) {
      knownClassLabels.set(classMatch, label);
    }
  }

  const busIdByName = new Map<string, string>();
  for (const bus of plan.buses) {
    const key = nameKey(bus.name);
    if (key && !busIdByName.has(key)) busIdByName.set(key, bus.id);
  }

  const unmatched: string[] = [];
  const seenUnmatched = new Set<string>();
  const reportUnmatched = (name: string) => {
    const key = nameKey(name);
    if (!key || seenUnmatched.has(key)) return;
    seenUnmatched.add(key);
    unmatched.push(name);
  };

  if (nameIndex < 0) {
    return { rows: [], creates: [], classes: [], unchanged: 0, unmatched };
  }

  // Keyed by `classKey` so "class a" and "Class A" are one entry, and the label
  // written is the school's own spelling once that class exists.
  const classes = new Map<string, AssignmentPlanClass>();
  function resolveClass(value: string): AssignmentPlanClass | null {
    const raw = value.trim().replace(/\s+/g, " ");
    const key = classKey(raw);
    if (!key) return null;
    const seen = classes.get(key);
    if (seen) {
      seen.count++;
      return seen;
    }
    const known = knownClassLabels.get(key);
    const entry: AssignmentPlanClass = {
      label: known ?? raw,
      count: 1,
      isNew: known === undefined,
    };
    classes.set(key, entry);
    return entry;
  }

  const targets = new Map<string, AssignmentPlanRow>();
  const creates = new Map<string, AssignmentPlanCreate>();
  let unchanged = 0;

  for (const row of sheet.rows) {
    const name = (row[nameIndex] ?? "").trim();
    if (!name) continue;

    const classValue = classIndex < 0 ? "" : (row[classIndex] ?? "").trim();
    const resolved = classValue === "" ? null : resolveClass(classValue);

    const busName = busIndex < 0 ? "" : (row[busIndex] ?? "").trim();
    const busProvided = busName !== "";
    const toBusId = busProvided ? busIdByName.get(nameKey(busName)) : undefined;
    // A bus the school does not have is never guessed at: the row is reported
    // rather than filed under a bus that does not exist.
    if (busProvided && !toBusId) {
      reportUnmatched(name);
      continue;
    }

    const key = nameKey(name);
    const candidates = studentsByName.get(key);

    if (candidates && candidates.length > 0) {
      // Prefer the child already in the row's class — that is what keeps two
      // children with one name apart — and otherwise take the first, so a move
      // to a class nobody in that name is in still lands.
      const classMatch = resolved === null ? "" : classKey(resolved.label);
      const student =
        candidates.find((entry) => classMatch !== "" && classKey(entry.grade) === classMatch) ??
        candidates[0];

      // The LAST row for a child wins, so compare against what the plan already
      // holds for them — not against the document. A later row that agrees with
      // the record and disagrees with an earlier row cancels that row out
      // instead of leaving the stale target behind.
      const pending = targets.get(student.id);
      const currentBusId = pending ? pending.toBusId : student.busId;
      const currentClass = pending?.toClass ?? student.grade;
      const nextBusId = toBusId !== undefined ? toBusId : currentBusId;
      const nextClass = resolved !== null ? resolved.label : currentClass;

      const touchesBus = nextBusId !== student.busId;
      const touchesClass = nextClass !== student.grade;
      if (!touchesBus && !touchesClass) {
        targets.delete(student.id);
        unchanged += 1;
        continue;
      }
      targets.set(student.id, {
        studentId: student.id,
        studentName: student.name,
        toBusId: touchesBus ? nextBusId : null,
        toClass: touchesClass ? nextClass : null,
      });
      continue;
    }

    // No such child: the row becomes one. Without a class there is nothing to
    // put on a class card, so the row is reported instead of half-created.
    if (resolved === null) {
      reportUnmatched(name);
      continue;
    }
    creates.set(`${key}|${classKey(resolved.label)}`, {
      name,
      className: resolved.label,
      busId: toBusId ?? null,
    });
  }

  return {
    rows: [...targets.values()],
    creates: [...creates.values()],
    classes: [...classes.values()],
    unchanged,
    unmatched,
  };
}

// ── applying a plan ──────────────────────────────────────────────────────────

/** Firestore caps a batch at 500 writes; leave headroom for future additions. */
const APPLY_CHUNK_SIZE = 400;

/**
 * Write the plan: corrections to existing children, then new ones, in
 * batch-sized chunks.
 *
 * A correction only carries the fields it actually changes, because the rules
 * grant `grade` and `busId` to different screens — a caller holding both may
 * send both in one write, a caller holding one may send that one.
 *
 * Returns the number of documents written (0 when signed out or unresolved).
 */
export async function applyAssignmentPlan(uid: string, plan: AssignmentPlan): Promise<number> {
  const firestore = db;
  if (!firestore || !uid) return 0;
  if (plan.rows.length === 0 && plan.creates.length === 0) return 0;
  const schoolId = await fetchSchoolId(uid);
  if (!schoolId) return 0;

  const stamp = { updatedBy: uid, updatedAt: serverTimestamp() };
  const students = collection(firestore, "schools", schoolId, "students");
  const writes: { ref: DocumentReference; data: Record<string, unknown> }[] = [];

  for (const row of plan.rows) {
    const data: Record<string, unknown> = { ...stamp };
    if (row.toClass !== null) data.grade = row.toClass;
    if (row.toBusId !== null) data.busId = row.toBusId;
    writes.push({ ref: doc(students, row.studentId), data });
  }
  for (const create of plan.creates) {
    writes.push({
      // An empty path argument lets Firestore mint the id.
      ref: doc(students),
      data: {
        name: create.name,
        grade: create.className,
        busId: create.busId,
        ...stamp,
      },
    });
  }

  let written = 0;
  for (let offset = 0; offset < writes.length; offset += APPLY_CHUNK_SIZE) {
    const chunk = writes.slice(offset, offset + APPLY_CHUNK_SIZE);
    const batch = writeBatch(firestore);
    for (const write of chunk) batch.set(write.ref, write.data, { merge: true });
    await batch.commit();
    written += chunk.length;
  }

  // One entry for the whole import, written after every chunk lands: a sheet is
  // one decision, and a half-written entry per chunk would read as several.
  await logAudit(firestore, schoolId, {
    event: "students.imported",
    targetType: "school",
    targetId: schoolId,
    meta: { count: written },
    occurredAt: new Date(),
  }).catch(() => {
    // Best-effort by design: a log write must never fail an import that
    // otherwise succeeded.
  });

  return written;
}
