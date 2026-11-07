// Turns OCR text into fields, and fixes the usual OCR mix-ups (O vs 0, I vs 1 ...) in IDs.
import { gstinChecksumChar } from "../validators";
import type { DocType } from "./types";

const lines = (text: string) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/** Labels printed on each document type (used to find values and to know where a value ends). */
const LABELS: Record<DocType, RegExp[]> = {
  gst_certificate: [/^gstin\b/i, /^legal\s*name/i, /^trade\s*name/i, /^constitution/i, /^address\s*of\s*principal/i, /^place\s*of\s*business/i, /^date\s*of\s*liability/i, /^type\s*of\s*registration/i],
  udyam_certificate: [/^udyam\s*reg/i, /^enterprise\s*name/i, /^major\s*activity/i, /^city\b/i, /^state\b/i, /^date\s*of\s*registration/i],
  signatory_id: [/^name\b/i, /^designation/i, /^for\s*business/i, /^id\s*no/i, /^valid\s*till/i],
  address_proof: [/^consumer\s*no/i, /^billed\s*to/i, /^supply\s*address/i, /^bill\s*date/i, /^units\s*consumed/i, /^amount\s*due/i],
};
const isLabel = (doc: DocType, l: string) => LABELS[doc].some((re) => re.test(l)) || /^(specimen|format for|accel ytl|synthetic)/i.test(l);

/** Value after a label: on the same line ("GSTIN 03PJ...") or on the next line (ID cards print it below). */
function field(doc: DocType, ls: string[], label: RegExp): string | null {
  const i = ls.findIndex((l) => label.test(l));
  if (i < 0) return null;
  const same = ls[i].replace(label, "").replace(/^[\s:.\-–]+/, "").trim();
  if (same) return same;
  const next = ls[i + 1];
  return next && !isLabel(doc, next) ? next : null;
}

/** An address split over two lines: the first label's value + the continuation line. */
function twoLineField(doc: DocType, ls: string[], label: RegExp, contLabel?: RegExp): string | null {
  const i = ls.findIndex((l) => label.test(l));
  if (i < 0) return null;
  let v = ls[i].replace(label, "").trim();
  const next = ls[i + 1];
  if (next) {
    if (contLabel && contLabel.test(next)) v += " " + next.replace(contLabel, "").trim();
    else if (!contLabel && !isLabel(doc, next)) v += " " + next;
  }
  return v.trim() || null;
}

const firstDate = (s: string | null) => s?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

// ---------------- GSTIN: fix OCR mix-ups by position ----------------
const TO_DIGIT: Record<string, string> = { O: "0", D: "0", Q: "0", I: "1", L: "1", J: "1", T: "1", S: "5", B: "8", Z: "2", G: "6" };
const TO_LETTER: Record<string, string> = { "0": "O", "1": "I", "5": "S", "8": "B", "2": "Z", "6": "G" };
const DIGIT_POS = new Set([0, 1, 7, 8, 9, 10]);
const LETTER_POS = new Set([2, 3, 4, 5, 6, 11]);
/** Characters OCR often swaps for each other. */
const LOOKALIKES: string[][] = [["O", "0", "D", "Q"], ["I", "1", "L", "J", "T"], ["S", "5"], ["B", "8"], ["Z", "2", "7"], ["G", "6"]];

function byPosition(raw: string): string {
  return raw.split("").map((c, i) => {
    if (DIGIT_POS.has(i)) return TO_DIGIT[c] ?? c;
    if (LETTER_POS.has(i)) return TO_LETTER[c] ?? c;
    if (i === 13) return c === "7" || c === "2" ? "Z" : c; // the 14th character is always Z
    return c;
  }).join("");
}

export interface GstinRead {
  raw: string; // as OCR read it
  value: string; // after position fixes (and a look-alike fix if one was needed)
  checksumOk: boolean;
  ocrFixed: boolean; // true when a look-alike swap was needed to pass the checksum
}

/**
 * Reads a GSTIN from OCR text. If the checksum fails, tries ONE look-alike swap (e.g. I->J) that both
 * passes the checksum and exists in the registry: that is an OCR slip. Anything else stays "failed".
 */
export function readGstin(text: string | null, inRegistry: (g: string) => boolean): GstinRead | null {
  if (!text) return null;
  const cand = text.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (cand.length < 15) return null;
  const raw = cand.slice(0, 15);
  const value = byPosition(raw);
  const ok = (g: string) => /^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(g) && gstinChecksumChar(g.slice(0, 14)) === g[14];
  if (ok(value)) return { raw, value, checksumOk: true, ocrFixed: false };
  for (let i = 0; i < 15; i++) {
    const group = LOOKALIKES.find((g) => g.includes(value[i]));
    if (!group) continue;
    for (const alt of group) {
      if (alt === value[i]) continue;
      const v = value.slice(0, i) + alt + value.slice(i + 1);
      if (ok(v) && inRegistry(v)) return { raw, value: v, checksumOk: true, ocrFixed: true };
    }
  }
  return { raw, value, checksumOk: false, ocrFixed: false };
}

/** Finds UDYAM-XX-00-1234567 (OCR sometimes adds spaces or reads 0 as O). */
export function readUdyam(text: string | null): string | null {
  if (!text) return null;
  const t = text.toUpperCase().replace(/\s+/g, "");
  const m = t.match(/UDYAM-?([A-Z]{2})-?([0-9OD]{2})-?([0-9OIL]{7})/);
  if (!m) return null;
  const digits = (s: string) => s.replace(/[OD]/g, "0").replace(/[IL]/g, "1");
  return `UDYAM-${m[1]}-${digits(m[2])}-${digits(m[3])}`;
}

// ---------------- documents ----------------
export interface ParsedGst { title: boolean; gstinText: string | null; legalName: string | null; tradeName: string | null; constitution: string | null; address: string | null }
export interface ParsedUdyam { title: boolean; numberText: string | null; number: string | null; enterpriseName: string | null; city: string | null; state: string | null }
export interface ParsedId { title: boolean; name: string | null; designation: string | null; business: string | null; idNo: string | null; validTill: string | null }
export interface ParsedBill { title: boolean; billedTo: string | null; address: string | null; billDate: string | null }

export function parseGst(text: string): ParsedGst {
  const ls = lines(text), d = "gst_certificate" as const;
  return {
    title: /GST/i.test(text),
    gstinText: field(d, ls, /^gstin\b/i),
    legalName: field(d, ls, /^legal\s*name/i),
    tradeName: field(d, ls, /^trade\s*name/i),
    constitution: field(d, ls, /^constitution/i),
    address: twoLineField(d, ls, /^address\s*of\s*principal/i, /^place\s*of\s*business/i),
  };
}

export function parseUdyam(text: string): ParsedUdyam {
  const ls = lines(text), d = "udyam_certificate" as const;
  const numberText = field(d, ls, /^udyam\s*reg\.?\s*number/i);
  return {
    title: /udyam/i.test(text),
    numberText,
    number: readUdyam(numberText),
    enterpriseName: field(d, ls, /^enterprise\s*name/i),
    city: field(d, ls, /^city\b/i),
    state: field(d, ls, /^state\b/i),
  };
}

export function parseId(text: string): ParsedId {
  const ls = lines(text), d = "signatory_id" as const;
  return {
    title: /signatory|identity|\bID\b/i.test(text),
    name: field(d, ls, /^name\b/i),
    designation: field(d, ls, /^designation/i),
    business: field(d, ls, /^for\s*business/i),
    idNo: field(d, ls, /^id\s*no\.?/i),
    validTill: firstDate(field(d, ls, /^valid\s*till/i)),
  };
}

export function parseBill(text: string): ParsedBill {
  const ls = lines(text), d = "address_proof" as const;
  return {
    title: /bill|electricity|utility/i.test(text),
    billedTo: field(d, ls, /^billed\s*to/i),
    address: twoLineField(d, ls, /^supply\s*address/i),
    billDate: firstDate(field(d, ls, /^bill\s*date/i)),
  };
}

// ---------------- fuzzy comparison ----------------
/** "Shop/Unit 1, Tech Park Rd" -> "shopunit1techparkrd" (also joins words split across lines). */
export const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Same text, allowing a few OCR slips (2 characters, or 5% of a long text). */
export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  return editDistance(x, y) <= Math.max(2, Math.floor(Math.max(x.length, y.length) * 0.05));
}
