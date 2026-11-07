// Format / checksum validators and date helpers.

/** The prototype's "today" (README says to use 2026-07-15 for all date checks). */
export const TODAY = new Date("2026-07-15T00:00:00Z");

export type GstinCheck =
  | { valid: true }
  | { valid: false; reason: "bad_format" | "checksum_failed"; message: string };

// 2-digit state + 5 letters + 4 digits + 1 letter (PAN; the 4th letter is "X" in
// this dataset, which the [A-Z]{5} accepts) + entity char + "Z" + checksum char.
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Standard GSTIN mod-36 checksum: returns the expected 15th character. */
export function gstinChecksumChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARS.indexOf(first14[i]);
    const product = value * (i % 2 === 0 ? 1 : 2); // factor alternates 1,2,1,2...
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export function validateGstin(input: string): GstinCheck {
  const g = (input ?? "").trim().toUpperCase();
  if (!GSTIN_RE.test(g)) {
    return {
      valid: false,
      reason: "bad_format",
      message: "Bad format: a GSTIN has 15 characters (state code, PAN, entity, Z, checksum).",
    };
  }
  if (gstinChecksumChar(g.slice(0, 14)) !== g[14]) {
    return {
      valid: false,
      reason: "checksum_failed",
      message: "Checksum failed: the last character does not match, so this GSTIN is mistyped or fake.",
    };
  }
  return { valid: true };
}

// UDYAM-XX-00-1234567 (district "00" is fake in this dataset but accepted).
const UDYAM_RE = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

export function validateUdyam(input: string): { valid: boolean; message?: string } {
  const u = (input ?? "").trim().toUpperCase();
  return UDYAM_RE.test(u)
    ? { valid: true }
    : { valid: false, message: "Bad format: expected UDYAM-XX-00-1234567." };
}

/** Address proof (e.g. a utility bill) must be dated within 90 days before TODAY. */
export function isAddressProofFresh(billDate: string | Date): boolean {
  const d = typeof billDate === "string" ? new Date(billDate + (billDate.length === 10 ? "T00:00:00Z" : "")) : billDate;
  if (isNaN(d.getTime())) return false;
  const ageDays = (TODAY.getTime() - d.getTime()) / 86_400_000;
  return ageDays >= 0 && ageDays <= 90; // a future-dated bill is not valid
}
