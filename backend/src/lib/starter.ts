// Starter bundles built from real history: what similar businesses that STAYED actually bought.
import { Product, getProduct, loadGstinRegistry, loadLeads, loadProducts, parseBundle } from "./data";
import { BusinessProfile, BundleItem, ReasonCode, checkBundle, defaultQuantity, segmentCode, segmentName } from "./rules";
import { ProductCopy, copyFor, friendlyReason } from "./productCopy";
import { listPrice } from "./quote";
import { getQuantityStats } from "./quantities";

/** Thresholds, in one place. share = fraction of similar "stayed" bundles containing the product. */
export const STARTER_CONFIG = {
  baseMinShare: 0.4, // >= 40%  -> in the base bundle
  addonMinShare: 0.1, // 10%..40% -> suggested add-on
};

/** Products that do the same job: a customer should get only one of each group in the base plan. */
const EXCLUSIVE_GROUPS: string[][] = [
  ["P01", "P02", "P03", "P04", "P05", "P06"], // internet connections
  ["P07", "P08"], // business SIM plans
];

// ---------- 1. History statistics, computed once and cached ----------
interface SegmentStats {
  count: number; // activated, not churned, in this segment
  share: Map<string, number>; // product_id -> fraction of those bundles that include it
}
let _stats: Map<string, SegmentStats> | null = null;

export function getSegmentStats(): Map<string, SegmentStats> {
  if (_stats) return _stats;
  const bySegment = new Map<string, Map<string, number>>();
  const counts = new Map<string, number>();
  for (const lead of loadLeads()) {
    if (lead.outcome !== "Activated") continue;
    if (lead.churned_within_6_months) continue; // only customers who stayed
    counts.set(lead.segment, (counts.get(lead.segment) ?? 0) + 1);
    const tally = bySegment.get(lead.segment) ?? new Map<string, number>();
    for (const id of new Set(parseBundle(lead.bundle_products).map((i) => i.product_id))) {
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
    bySegment.set(lead.segment, tally);
  }
  _stats = new Map();
  for (const [segment, n] of counts) {
    const share = new Map<string, number>();
    for (const [id, k] of bySegment.get(segment)!) share.set(id, k / n);
    _stats.set(segment, { count: n, share });
  }
  return _stats;
}

/** Call at server start so the first customer doesn't wait. */
export function warmStarterCache() {
  getQuantityStats();
  loadGstinRegistry();
  getSegmentStats();
}

// ---------- 2. Response shapes ----------
export interface StarterItem {
  product_id: string; // internal only: never shown to customers
  copy: ProductCopy;
  unit: string;
  unit_price_inr: number;
  quantity: number;
  monthly_inr: number;
  share?: number; // how common this is among similar customers (0..1)
}

export interface BlockedProduct {
  product_id: string;
  copy: ProductCopy;
  reason: string; // plain English (the same text as reason_en)
  reason_en: string;
  reason_hi: string;
}

export interface StarterResponse {
  segment: string;
  based_on: { count: number; line_en: string; line_hi: string };
  base: StarterItem[];
  addons: StarterItem[];
  more: StarterItem[];
  blocked: BlockedProduct[];
  /** Dependencies the engine added to the base bundle, e.g. internet for CCTV */
  fixes: { for_product_id: string; added_product_id: string; message: string }[];
}

const SEGMENT_NOUNS: Record<string, { en: string; hi: string }> = {
  micro: { en: "small shops and services", hi: "छोटी दुकानों और सर्विस बिज़नेस" },
  prof: { en: "professional offices", hi: "प्रोफ़ेशनल ऑफ़िस" },
  multi: { en: "multi-location businesses", hi: "कई जगह वाले बिज़नेस" },
  mfg: { en: "small factories", hi: "छोटी फ़ैक्टरियों" },
};

function toItem(p: Product, quantity: number, share?: number): StarterItem {
  const unit_price_inr = listPrice(p);
  return {
    product_id: p.product_id,
    copy: copyFor(p.product_id),
    unit: p.unit,
    unit_price_inr,
    quantity,
    monthly_inr: unit_price_inr * quantity,
    share,
  };
}

/** Can this product be sold on its own to this customer (own rules + dependency fixable)? */
function blockedReason(id: string, profile: BusinessProfile): ReasonCode[] | null {
  const r = checkBundle(profile, [{ product_id: id, quantity: 1 }]);
  return r.blocked.length ? r.blocked[0].codes : null;
}

// ---------- 3. Build a starter bundle for one customer ----------
export function buildStarter(profile: BusinessProfile): StarterResponse {
  const name = segmentName(profile.segment);
  const code = segmentCode(name ?? profile.segment);
  const stats = name ? getSegmentStats().get(name) : undefined;
  const share = stats?.share ?? new Map<string, number>();
  const products = loadProducts();

  // Which products can this customer actually have?
  const blocked: BlockedProduct[] = [];
  const available = new Set<string>();
  for (const p of products) {
    const codes = blockedReason(p.product_id, profile);
    if (codes) {
      const f = friendlyReason(p, codes);
      blocked.push({ product_id: p.product_id, copy: copyFor(p.product_id), reason: f.reason_en, ...f });
    } else {
      available.add(p.product_id);
    }
  }

  // Candidates from history, most popular first, limited to what this customer can have.
  const ranked = [...share.entries()].sort((a, b) => b[1] - a[1]).filter(([id]) => available.has(id));
  const baseIds: string[] = [];
  const addonIds: string[] = [];
  const usedGroups = new Set<number>();
  for (const [id, s] of ranked) {
    const g = EXCLUSIVE_GROUPS.findIndex((grp) => grp.includes(id));
    const isBase = s >= STARTER_CONFIG.baseMinShare;
    const isAddon = !isBase && s >= STARTER_CONFIG.addonMinShare;
    if (!isBase && !isAddon) continue;
    // Only one internet plan / one SIM plan in the base. Others fall back to "more options".
    if (g >= 0 && isBase) {
      if (usedGroups.has(g)) continue;
      usedGroups.add(g);
    } else if (g >= 0 && isAddon && usedGroups.has(g)) {
      continue; // already have one from this group
    }
    (isBase ? baseIds : addonIds).push(id);
  }

  // Show in catalogue order (internet first, then SIMs, then the rest).
  baseIds.sort();
  addonIds.sort();

  // Run the base through the rules engine: sets quantities and adds missing dependencies.
  const baseCheck = checkBundle(
    profile,
    baseIds.map((id) => ({ product_id: id, quantity: defaultQuantity(getProduct(id)!, profile) })),
  );
  const base = baseCheck.allowed.map((i) => toItem(getProduct(i.product_id)!, i.quantity, share.get(i.product_id)));
  const baseSet = new Set(base.map((b) => b.product_id));

  // Add-ons: keep only those that work with the base bundle as it is.
  const addons: StarterItem[] = [];
  for (const id of addonIds) {
    if (baseSet.has(id)) continue;
    const p = getProduct(id)!;
    const trial: BundleItem[] = [
      ...baseCheck.allowed,
      { product_id: id, quantity: defaultQuantity(p, profile) },
    ];
    const t = checkBundle(profile, trial);
    // Suggest it only if it fits the base as-is: nothing blocked and no extra product forced in.
    // (Otherwise it stays under "more options", where the dependency note is shown if chosen.)
    if (t.blocked.length === 0 && t.fixes.length === baseCheck.fixes.length) {
      addons.push(toItem(p, defaultQuantity(p, profile), share.get(id)));
    }
  }
  const addonSet = new Set(addons.map((a) => a.product_id));

  // Everything else the customer could buy.
  const more = products
    .filter((p) => available.has(p.product_id) && !baseSet.has(p.product_id) && !addonSet.has(p.product_id))
    .map((p) => toItem(p, defaultQuantity(p, profile), share.get(p.product_id)));

  const noun = SEGMENT_NOUNS[code] ?? { en: "businesses", hi: "बिज़नेस" };
  const n = stats?.count ?? 0;
  return {
    segment: code,
    based_on: {
      count: n,
      line_en: `Based on ${n} similar ${noun.en} that stayed with us`,
      line_hi: `हमारे साथ बने रहने वाले ${n} ऐसे ही ${noun.hi} के आधार पर`,
    },
    base,
    addons,
    more,
    blocked,
    fixes: baseCheck.fixes,
  };
}
