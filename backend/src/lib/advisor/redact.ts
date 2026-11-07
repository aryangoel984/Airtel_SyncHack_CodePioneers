// Runs BEFORE any text goes to the LLM. Looks up GSTINs on our server and strips personal numbers.
import { lookupGstin } from "../lookups";
import { maskId } from "../mask";

export type GstinStatus = "Active" | "Cancelled" | "Suspended" | "not_found" | "checksum_failed" | "bad_format";

export interface GstinResult {
  status: GstinStatus;
  masked: string; // 03PJ********1ZB
  business_name?: string;
  city?: string;
  state?: string;
}

export interface RedactionResult {
  safeText: string; // what the LLM is allowed to see
  gstin?: GstinResult; // result of a server-side lookup, if the user typed a GSTIN
  redacted: string[]; // kinds of personal data removed, e.g. ["aadhaar", "mobile"]
}

// 15 characters shaped like a GSTIN (also catches mistyped ones so we can say "please re-check")
const GSTIN_LIKE = /\b\d{2}[A-Za-z]{5}\d{4}[A-Za-z][A-Za-z0-9]{3}\b/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const AADHAAR = /(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g; // 12 digits
const MOBILE = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;
const PAN = /\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g;

/** "Shop/Unit 83, Market Yard, Ludhiana, Punjab - 416059" -> "Ludhiana" */
function cityFromAddress(addr: string): string | undefined {
  const parts = (addr ?? "").split(",").map((p) => p.trim());
  return parts.length >= 2 ? parts[parts.length - 2] : undefined;
}

export function redactMessage(text: string): RedactionResult {
  let out = text;
  const redacted: string[] = [];
  let gstin: GstinResult | undefined;

  out = out.replace(GSTIN_LIKE, (match) => {
    const r = lookupGstin(match);
    const masked = maskId(match.toUpperCase());
    if (!r.valid) {
      gstin = { status: r.error === "checksum_failed" ? "checksum_failed" : "bad_format", masked };
      return `[GSTIN_PROVIDED: INVALID, ${r.error === "checksum_failed" ? "checksum failed" : "bad format"}]`;
    }
    if (!r.found) {
      gstin = { status: "not_found", masked };
      return "[GSTIN_PROVIDED: valid format but NOT FOUND in the registry]";
    }
    const rec = r.record;
    const city = cityFromAddress(rec.principal_place_of_business);
    gstin = {
      status: rec.status as GstinStatus, masked,
      business_name: rec.trade_name, city, state: rec.state,
    };
    console.log(`[advisor] GSTIN looked up ${masked} status=${rec.status}`); // masked only
    return `[GSTIN_PROVIDED: ${rec.status}, ${rec.trade_name}, ${city ?? "unknown city"}, ${rec.state}]`;
  });

  const strip = (re: RegExp, kind: string) => {
    out = out.replace(re, () => { if (!redacted.includes(kind)) redacted.push(kind); return "[REDACTED]"; });
  };
  strip(EMAIL, "email");
  strip(AADHAAR, "aadhaar");
  strip(MOBILE, "mobile");
  strip(PAN, "pan");

  return { safeText: out, gstin, redacted };
}
