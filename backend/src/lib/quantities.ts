// Default quantities learned from history (activated, not churned customers), computed once.
import { Product, loadLeads, parseBundle } from "./data";
import type { BusinessProfile } from "./rules";
import { segmentName } from "./segments";
import { QUANTITY_CONFIG } from "./quantityConfig";

interface Stat {
  n: number; // how many similar customers bought it
  medianPerEmployee: number;
  medianPerSite: number;
  maxQty: number; // biggest quantity anyone in the segment bought
}

let _stats: Map<string, Stat> | null = null; // key = "segment name|product id"

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function getQuantityStats(): Map<string, Stat> {
  if (_stats) return _stats;
  const raw = new Map<string, { perEmp: number[]; perSite: number[]; max: number }>();
  for (const lead of loadLeads()) {
    if (lead.outcome !== "Activated" || lead.churned_within_6_months) continue;
    const emp = Math.max(1, lead.employee_count);
    const sites = Math.max(1, lead.num_sites);
    for (const { product_id, quantity } of parseBundle(lead.bundle_products)) {
      const key = `${lead.segment}|${product_id}`;
      const e = raw.get(key) ?? { perEmp: [], perSite: [], max: 0 };
      e.perEmp.push(quantity / emp);
      e.perSite.push(quantity / sites);
      e.max = Math.max(e.max, quantity);
      raw.set(key, e);
    }
  }
  _stats = new Map();
  for (const [key, e] of raw) {
    _stats.set(key, {
      n: e.perEmp.length,
      medianPerEmployee: median(e.perEmp),
      medianPerSite: median(e.perSite),
      maxQty: e.max,
    });
  }
  return _stats;
}

/**
 * History-based default quantity, or null when we should use the simple unit rule
 * (unit not configured, or too little history for this segment + product).
 */
export function historicQuantity(p: Product, b: BusinessProfile): number | null {
  const basis = QUANTITY_CONFIG.basisByUnit[p.unit];
  const segment = segmentName(b.segment);
  if (!basis || !segment) return null;
  const stat = getQuantityStats().get(`${segment}|${p.product_id}`);
  if (!stat || stat.n < QUANTITY_CONFIG.minSamples) return null;

  const ratio = basis === "employee" ? stat.medianPerEmployee : stat.medianPerSite;
  const base = basis === "employee" ? b.employee_count : b.num_sites;
  const limits = QUANTITY_CONFIG.limitsByProduct[p.product_id] ?? { min: 1, max: stat.maxQty };
  return Math.min(limits.max, Math.max(limits.min, Math.round(ratio * base)));
}
