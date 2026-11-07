// Mask identifiers before logging: keep first 4 and last 3 chars.
// 03PJNXS4821G1ZB -> 03PJ********1ZB.  Never log a full ID.
export function maskId(id: string): string {
  if (!id) return "";
  if (id.length <= 7) return "*".repeat(id.length);
  return id.slice(0, 4) + "*".repeat(id.length - 7) + id.slice(-3);
}

// Mask a mobile number: 9876543221 -> 98******21 (first 2 and last 2 digits).
export function maskMobile(mobile: string): string {
  const d = (mobile ?? "").replace(/\D/g, "");
  if (d.length <= 4) return "*".repeat(d.length);
  return d.slice(0, 2) + "*".repeat(d.length - 4) + d.slice(-2);
}

// Udyam numbers: keep the public prefix, hide most digits. UDYAM-KL-00-3078801 -> UDYAM-KL-00-****801
export function maskUdyam(u: string): string {
  const m = (u ?? "").match(/^(UDYAM-[A-Z]{2}-\d{2}-)(\d{7})$/);
  return m ? m[1] + "****" + m[2].slice(-3) : maskId(u);
}
