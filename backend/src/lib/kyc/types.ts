// Shared types for Smart KYC (Step 4).

export const DOC_TYPES = ["gst_certificate", "udyam_certificate", "signatory_id", "address_proof"] as const;
export type DocType = (typeof DOC_TYPES)[number];

/** One check result shown to the customer. */
export interface KycCheck {
  code: string; // e.g. "gst_status", "bill_fresh"
  doc: DocType | "overall";
  result: "pass" | "fail" | "warn";
  /** reject = can't continue online (e.g. cancelled GST, altered document); fix = re-upload / correct and retry */
  severity?: "reject" | "fix";
  en: string;
  hi: string;
}

/** What we read from a document. Identifiers are kept MASKED only. */
export interface DocSummary {
  doc: DocType;
  provided: boolean;
  readable: boolean;
  confidence: number | null;
  rotated: boolean;
  fields: Record<string, string>; // masked / non-sensitive extracted values for display
}

export type KycVerdict = "VERIFIED" | "ACTION_NEEDED" | "REJECTED";

export interface KycResult {
  verdict: KycVerdict;
  checkedAt: string;
  business: { name: string | null; source: "gst" | "udyam" | null; gstin_masked: string | null; udyam_masked: string | null; gst_status: string | null };
  docs: DocSummary[];
  checks: KycCheck[];
  ocrMs: number;
}

/** Stored on the order. Contains NO document images and no full identifiers. */
export interface KycRecord {
  consent?: { accepted: true; at: string; version: string; language: "en" | "hi" };
  attempts: number;
  result?: KycResult;
  digilocker?: { at: string };
  esign?: { at: string; name: string; otpSentTo: string };
  pendingOtp?: { code: string; expires: number }; // demo OTP for e-sign (cleared after use)
}
