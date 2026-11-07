// Rules engine: decides which products a business may buy, and fixes bundles.
import { Product, loadProducts, getProduct } from "./data";

export interface BusinessProfile {
  segment: string; // lead segment name or catalogue code (micro/prof/multi/mfg)
  city_tier: number; // 1 or 2
  employee_count: number;
  num_sites: number;
  has_valid_active_gstin: boolean;
}

export interface BundleItem {
  product_id: string;
  quantity: number;
}

/** Machine-readable reason, so the UI can show friendly text in any language. */
export interface ReasonCode {
  code: "tier" | "employees" | "sites" | "gstin" | "dependency" | "unknown";
  value?: number; // e.g. the minimum employees / sites required
}

export interface BlockedItem {
  product_id: string;
  product_name: string;
  reason: string; // plain English
  codes: ReasonCode[]; // same reasons as structured data
}

export interface Fix {
  /** The product that needed something */
  for_product_id: string;
  added_product_id: string;
  message: string;
}

export interface RulesResult {
  allowed: BundleItem[]; // includes auto-added dependency products
  blocked: BlockedItem[];
  fixes: Fix[];
  /** Number of problems found in the ORIGINAL bundle (blocked + fixes needed) */
  violation_count: number;
}

// Map the lead file's segment names to the catalogue's short codes.
// Segment is only a recommendation hint (not a blocking rule).
const SEGMENT_CODES: Record<string, string> = {
  "Micro retail & services": "micro",
  "Professional offices": "prof",
  "Small manufacturers": "mfg",
  "Small multi-site businesses": "multi",
};
export const segmentCode = (s: string) => SEGMENT_CODES[s] ?? s;
/** Reverse lookup: catalogue code -> lead segment name (accepts a name as well). */
export const segmentName = (s: string) =>
  Object.keys(SEGMENT_CODES).find((name) => name === s || SEGMENT_CODES[name] === s);

/** Structured reasons this product can't be sold to this business (ignoring dependencies). */
export function ownProblemCodes(p: Product, b: BusinessProfile): ReasonCode[] {
  const out: ReasonCode[] = [];
  if (!p.available_city_tiers.includes(b.city_tier)) out.push({ code: "tier" });
  if (b.employee_count < p.min_employees) out.push({ code: "employees", value: p.min_employees });
  if (b.num_sites < p.min_sites) out.push({ code: "sites", value: p.min_sites });
  if (p.requires_gstin && !b.has_valid_active_gstin) out.push({ code: "gstin" });
  return out;
}

/** The same reasons as plain-English sentences. */
function ownProblems(p: Product, b: BusinessProfile): string[] {
  return ownProblemCodes(p, b).map((c) => {
    switch (c.code) {
      case "tier": {
        const tiers = p.available_city_tiers.map((t) => `tier-${t}`).join(" and ");
        return `${p.product_name} is only available in ${tiers} cities`;
      }
      case "employees":
        return `${p.product_name} needs at least ${p.min_employees} employees`;
      case "sites":
        return `${p.product_name} needs at least ${p.min_sites} sites`;
      default:
        return `${p.product_name} needs a valid, active GSTIN`;
    }
  });
}

const isEligible = (p: Product, b: BusinessProfile) => ownProblems(p, b).length === 0;

/** Sensible default quantity, based on the product's billing unit. */
export function defaultQuantity(p: Product, b: BusinessProfile): number {
  const emp = Math.max(1, b.employee_count);
  const sites = Math.max(1, b.num_sites);
  switch (p.unit) {
    case "per site":
      return sites;
    case "per counter":
      return sites; // one billing counter per site to start
    case "per line":
    case "per user":
      return Math.min(emp, 50);
    case "per channel":
      return Math.min(emp, 10);
    case "per camera":
      return 4 * sites;
    case "per device":
      return Math.min(emp, 25);
    case "per vehicle":
      return 2;
    default: // per account, per pack, per number, per IP
      return 1;
  }
}

/**
 * Every product this business can buy: it passes its own rules AND its dependency
 * can be satisfied (some product it needs is also eligible, so we can add it).
 */
export function getEligibleProducts(b: BusinessProfile): Product[] {
  return loadProducts().filter((p) => isEligible(p, b)).filter(
    (p) =>
      p.requires_one_of.length === 0 ||
      p.requires_one_of.some((id) => {
        const dep = getProduct(id);
        return dep && isEligible(dep, b);
      }),
  );
}

/**
 * Check a bundle. Step 1: per-product rules. Step 2: dependencies — if a needed
 * product is missing we add the cheapest eligible one; if none is eligible, block.
 */
export function checkBundle(b: BusinessProfile, items: BundleItem[]): RulesResult {
  const allowed: BundleItem[] = [];
  const blocked: BlockedItem[] = [];
  const fixes: Fix[] = [];
  const pending: { item: BundleItem; p: Product }[] = [];

  // Step 1: own rules
  for (const item of items) {
    const p = getProduct(item.product_id);
    if (!p) {
      blocked.push({ product_id: item.product_id, product_name: item.product_id, reason: `Unknown product ${item.product_id}`, codes: [{ code: "unknown" }] });
      continue;
    }
    const problems = ownProblems(p, b);
    if (problems.length) {
      blocked.push({ product_id: p.product_id, product_name: p.product_name, reason: problems.join("; "), codes: ownProblemCodes(p, b) });
    } else {
      pending.push({ item, p });
    }
  }

  // Step 2: dependencies. Products with no dependency go in first so they can satisfy others.
  const present = new Set<string>();
  for (const { item, p } of pending) {
    if (p.requires_one_of.length === 0) {
      allowed.push(item);
      present.add(p.product_id);
    }
  }
  for (const { item, p } of pending) {
    if (p.requires_one_of.length === 0) continue;
    if (p.requires_one_of.some((id) => present.has(id))) {
      allowed.push(item);
      present.add(p.product_id);
      continue;
    }
    // Missing dependency: find the cheapest eligible product that would satisfy it.
    const candidates = p.requires_one_of
      .map((id) => getProduct(id))
      .filter((d): d is Product => !!d && isEligible(d, b))
      .sort((x, y) => x.price_min_inr_per_month - y.price_min_inr_per_month);
    if (candidates.length === 0) {
      const names = p.requires_one_of.map((id) => getProduct(id)?.product_name ?? id).join(" / ");
      blocked.push({
        product_id: p.product_id,
        product_name: p.product_name,
        reason: `${p.product_name} needs one of: ${names}, but none is available for this business`,
        codes: [{ code: "dependency" }],
      });
      continue;
    }
    const dep = candidates[0];
    allowed.push({ product_id: dep.product_id, quantity: defaultQuantity(dep, b) });
    present.add(dep.product_id);
    fixes.push({
      for_product_id: p.product_id,
      added_product_id: dep.product_id,
      message: `${p.product_name} needs an internet connection, so we added ${dep.product_name}`,
    });
    allowed.push(item);
    present.add(p.product_id);
  }

  return { allowed, blocked, fixes, violation_count: blocked.length + fixes.length };
}
