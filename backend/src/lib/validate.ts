// Input checks for data sent by the browser. Never trust the client.
import { BusinessProfile, BundleItem, segmentName } from "./rules";
import { getProduct } from "./data";

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseProfile(raw: unknown): Parsed<BusinessProfile> {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return { ok: false, error: "profile is required" };
  if (typeof r.segment !== "string" || !segmentName(r.segment)) return { ok: false, error: "unknown segment" };
  if (r.city_tier !== 1 && r.city_tier !== 2) return { ok: false, error: "city_tier must be 1 or 2" };
  const emp = r.employee_count, sites = r.num_sites;
  if (!Number.isInteger(emp) || (emp as number) < 1 || (emp as number) > 100000) return { ok: false, error: "employee_count must be 1-100000" };
  if (!Number.isInteger(sites) || (sites as number) < 1 || (sites as number) > 10000) return { ok: false, error: "num_sites must be 1-10000" };
  if (typeof r.has_valid_active_gstin !== "boolean") return { ok: false, error: "has_valid_active_gstin must be true/false" };
  return {
    ok: true,
    value: {
      segment: r.segment, city_tier: r.city_tier, employee_count: emp as number,
      num_sites: sites as number, has_valid_active_gstin: r.has_valid_active_gstin,
    },
  };
}

export function parseItems(raw: unknown): Parsed<BundleItem[]> {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "items must be a non-empty list" };
  if (raw.length > 50) return { ok: false, error: "too many items" };
  const out: BundleItem[] = [];
  for (const i of raw) {
    if (!i || typeof i.product_id !== "string" || !getProduct(i.product_id)) return { ok: false, error: "unknown product" };
    if (!Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 9999) return { ok: false, error: "quantity must be 1-9999" };
    out.push({ product_id: i.product_id, quantity: i.quantity });
  }
  return { ok: true, value: out };
}

/** Indian mobile: 10 digits starting 6-9 (a leading +91 / 0 is allowed). Returns digits or null. */
export function parseMobile(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const d = raw.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
