// Mask identifiers before logging: keep first 4 and last 3 chars.
// 03PJNXS4821G1ZB -> 03PJ********1ZB.  Never log a full ID.
export function maskId(id: string): string {
  if (!id) return "";
  if (id.length <= 7) return "*".repeat(id.length);
  return id.slice(0, 4) + "*".repeat(id.length - 7) + id.slice(-3);
}
