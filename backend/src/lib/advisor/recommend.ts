// Builds the recommendation: starter bundle + wishes + dependencies + budget. All code, no LLM.
// Every item, quantity, price and reason here comes from the existing rules engine, starter and quote code.
import { getProduct } from "../data";
import { BusinessProfile, BundleItem, defaultQuantity } from "../rules";
import { buildQuote, listPrice } from "../quote";
import { ProductCopy, copyFor, quoteWithCopy } from "../productCopy";
import { buildStarter } from "../starter";
import { AdvisorProfile } from "./session";
import { WISH_PRODUCTS, WishKey, resolveSegment } from "./mapping";
import { ADVISOR_CONFIG } from "./config";

export interface RecItem {
  product_id: string; // internal only
  copy: ProductCopy;
  unit: string;
  unit_price_inr: number;
  quantity: number;
  monthly_inr: number;
  setup_inr: number;
  role: "base" | "wish" | "dependency";
}

export interface BlockedWish {
  wish: WishKey | null;
  product_id: string;
  copy: ProductCopy;
  reason_en: string;
  reason_hi: string;
  alternative: { product_id: string; copy: ProductCopy; unit: string; unit_price_inr: number; in_plan: boolean } | null;
}

export interface Recommendation {
  id: number;
  profile: BusinessProfile;
  items: RecItem[];
  quote: ReturnType<typeof quoteWithCopy>;
  blocked_wishes: BlockedWish[];
  dropped_for_budget: { product_id: string; copy: ProductCopy }[];
  budget: { requested: number | null; within: boolean | null; cheapest_possible_inr: number | null };
  minimal: boolean; // customer wanted only specific things
  indicative: boolean; // too large for the SMB journey: a human expert will confirm
  /** Popular extras among similar customers that are not in the plan yet (shown as "you may also like") */
  suggested_addons: { product_id: string; copy: ProductCopy; unit: string; unit_price_inr: number; quantity: number; monthly_inr: number }[];
  based_on: { count: number; line_en: string; line_hi: string } | null;
}

// ---------------- Slots ----------------
export type RequiredSlot = "business_type" | "employee_count" | "num_sites" | "city" | "gst";

export function missingSlots(p: AdvisorProfile): RequiredSlot[] {
  const m: RequiredSlot[] = [];
  const seg = resolveSegment(p.segment_hint ?? p.segment_from_type ?? null, p.num_sites);
  if (!seg) m.push("business_type");
  if (p.employee_count === undefined) m.push("employee_count");
  if (p.num_sites === undefined) m.push("num_sites");
  if (p.city_tier === undefined) m.push("city");
  // GST is known when they told us yes/no, or a looked-up GSTIN gave a definite answer
  const gstKnown = p.has_gstin !== undefined || (p.gstin && !["checksum_failed", "bad_format"].includes(p.gstin.status));
  if (!gstKnown) m.push("gst");
  return m;
}

/** A looked-up GSTIN must be Active. A claimed one (no number given yet) is trusted until KYC. */
export function hasValidActiveGstin(p: AdvisorProfile): boolean {
  if (p.gstin) return p.gstin.status === "Active";
  return p.has_gstin === true;
}

export function toBusinessProfile(p: AdvisorProfile): BusinessProfile | null {
  if (missingSlots(p).length) return null;
  const segment = resolveSegment(p.segment_hint ?? p.segment_from_type ?? null, p.num_sites)!;
  return {
    segment,
    city_tier: p.city_tier!,
    employee_count: p.employee_count!,
    num_sites: p.num_sites!,
    has_valid_active_gstin: hasValidActiveGstin(p),
  };
}

/** Does this profile need a human expert (too big for the SMB journey)? */
export function needsHuman(p: AdvisorProfile): string | null {
  const h = ADVISOR_CONFIG.handoff;
  if ((p.num_sites ?? 0) > h.maxSites) return "too_large";
  if ((p.employee_count ?? 0) > h.maxEmployees) return "too_large";
  return null;
}

// If a wished-for product is blocked, suggest the closest allowed one (first eligible in the list).
const ALTERNATIVES: Record<string, string[]> = {
  P03: ["P02", "P01"], P05: ["P03", "P02", "P01"], P06: ["P05", "P03", "P02"],
  P15: ["P18"], P14: ["P18"], P10: ["P09"], P21: ["P20"],
};

/** Closest allowed alternative for a blocked product, for this business (or null). */
export function alternativeFor(bp: BusinessProfile, pid: string) {
  const starter = buildStarter(bp);
  const ok = new Set([...starter.base, ...starter.addons, ...starter.more].map((i) => i.product_id));
  const altId = (ALTERNATIVES[pid] ?? []).find((a) => ok.has(a));
  if (!altId) return null;
  const prod = getProduct(altId)!;
  return { product_id: altId, copy: copyFor(altId), unit: prod.unit, unit_price_inr: listPrice(prod) };
}

const INTERNET_IDS = ["P01", "P02", "P03", "P04", "P05", "P06"];

export function buildRecommendation(
  p: AdvisorProfile,
  opts: { wishes?: WishKey[]; only_these?: boolean; budget?: number },
  id: number,
): Recommendation {
  const bp = toBusinessProfile(p);
  if (!bp) throw new Error("profile incomplete");
  const starter = buildStarter(bp);
  const eligibleById = new Map([...starter.base, ...starter.addons, ...starter.more].map((i) => [i.product_id, i]));
  const blockedById = new Map(starter.blocked.map((b) => [b.product_id, b]));
  const baseIds = new Set(starter.base.map((i) => i.product_id));

  const wishes = opts.wishes ?? p.wishes;
  const realWishes = wishes.filter((w) => w !== "sim_only");
  const simOnly = wishes.includes("sim_only") && realWishes.length === 0;
  const onlyThese = simOnly || !!opts.only_these;

  const qty = (pid: string) => defaultQuantity(getProduct(pid)!, bp);
  const cheapestInternet = () =>
    INTERNET_IDS.filter((i) => eligibleById.has(i)).sort((a, b) => listPrice(getProduct(a)!) - listPrice(getProduct(b)!))[0];

  // ---- 1. choose items ----
  let items: BundleItem[] = [];
  const wishProductIds = new Set<string>();
  const blocked_wishes: BlockedWish[] = [];

  if (simOnly) {
    // One SIM per person, between 1 and 6 (explicit "only a mobile plan" request)
    items = [{ product_id: "P07", quantity: Math.min(6, Math.max(1, bp.employee_count)) }];
  } else {
    if (!onlyThese) items = starter.base.map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
    for (const w of realWishes) {
      const pids = w === "internet" ? (cheapestInternet() ? [cheapestInternet()!] : []) : WISH_PRODUCTS[w];
      for (const pid of pids) {
        const blockedInfo = blockedById.get(pid);
        if (blockedInfo) {
          const altId = (ALTERNATIVES[pid] ?? []).find((a) => eligibleById.has(a));
          blocked_wishes.push({
            wish: w, product_id: pid, copy: copyFor(pid),
            reason_en: blockedInfo.reason_en, reason_hi: blockedInfo.reason_hi,
            alternative: altId
              ? {
                  product_id: altId, copy: copyFor(altId), unit: getProduct(altId)!.unit,
                  unit_price_inr: listPrice(getProduct(altId)!),
                  in_plan: baseIds.has(altId) && !onlyThese,
                }
              : null,
          });
        } else {
          wishProductIds.add(pid);
          if (!items.some((i) => i.product_id === pid)) items.push({ product_id: pid, quantity: eligibleById.get(pid)!.quantity });
        }
      }
    }
  }

  // ---- 2. price it (the rules engine adds missing dependencies, e.g. internet for CCTV) ----
  let quote = buildQuote(bp, items);
  const dropped: { product_id: string; copy: ProductCopy }[] = [];
  const budget = { requested: opts.budget ?? null, within: null as boolean | null, cheapest_possible_inr: null as number | null };

  // ---- 3. budget: drop wished add-ons first, then fall back to essentials ----
  if (opts.budget !== undefined) {
    budget.within = quote.monthly_total_inr <= opts.budget;
    if (!budget.within) {
      const byCostDesc = items.filter((i) => wishProductIds.has(i.product_id))
        .sort((a, b) => listPrice(getProduct(b.product_id)!) * b.quantity - listPrice(getProduct(a.product_id)!) * a.quantity);
      for (const w of byCostDesc) {
        items = items.filter((i) => i.product_id !== w.product_id);
        dropped.push({ product_id: w.product_id, copy: copyFor(w.product_id) });
        if (items.length) { quote = buildQuote(bp, items); if (quote.monthly_total_inr <= opts.budget) break; }
      }
      budget.within = items.length > 0 && quote.monthly_total_inr <= opts.budget;
    }
    if (!budget.within) {
      // Essentials: cheapest internet and/or SIMs, in order of how much they cover
      const net = cheapestInternet();
      const sims = (n: number): BundleItem[] => [{ product_id: "P07", quantity: Math.min(n, bp.employee_count) || 1 }];
      const netItem: BundleItem[] = net ? [{ product_id: net, quantity: qty(net) }] : [];
      const candidates: BundleItem[][] = [
        [...netItem, ...sims(2)], [...netItem, ...sims(1)], netItem, sims(2), sims(1),
      ].filter((c) => c.length > 0);
      const priced = candidates.map((c) => ({ c, q: buildQuote(bp, c) }));
      const fit = priced.find((x) => x.q.monthly_total_inr <= opts.budget!);
      const chosen = fit ?? priced.reduce((a, b) => (b.q.monthly_total_inr < a.q.monthly_total_inr ? b : a));
      for (const it of items) if (!dropped.some((d) => d.product_id === it.product_id)) dropped.push({ product_id: it.product_id, copy: copyFor(it.product_id) });
      items = chosen.c;
      quote = chosen.q;
      budget.within = !!fit;
      if (!fit) budget.cheapest_possible_inr = chosen.q.monthly_total_inr;
    }
  }

  // ---- 4. final structured items (what the frontend shows) ----
  const addedDeps = new Set(quote.fixes.map((f) => f.added_product_id));
  const recItems: RecItem[] = quote.lines.map((l) => ({
    product_id: l.product_id,
    copy: copyFor(l.product_id),
    unit: l.unit,
    unit_price_inr: l.unit_price_inr,
    quantity: l.quantity,
    monthly_inr: l.monthly_inr,
    setup_inr: l.setup_inr,
    role: wishProductIds.has(l.product_id) ? "wish" : addedDeps.has(l.product_id) && !items.some((i) => i.product_id === l.product_id) ? "dependency" : "base",
  }));

  return {
    id,
    profile: bp,
    items: recItems,
    quote: quoteWithCopy(quote),
    blocked_wishes,
    dropped_for_budget: dropped,
    budget,
    minimal: onlyThese,
    indicative: needsHuman(p) !== null,
    suggested_addons: starter.addons
      .filter((a) => !quote.lines.some((l) => l.product_id === a.product_id))
      .slice(0, 4)
      .map((a) => ({ product_id: a.product_id, copy: a.copy, unit: a.unit, unit_price_inr: a.unit_price_inr, quantity: a.quantity, monthly_inr: a.monthly_inr })),
    based_on: starter.based_on.count ? starter.based_on : null,
  };
}

// ---------------- What the LLM is allowed to see ----------------
const UNIT_EN: Record<string, string> = {
  "per site": "per location", "per line": "per SIM", "per user": "per person", "per camera": "per camera",
  "per IP": "per address", "per channel": "per line", "per number": "per number", "per pack": "per pack",
  "per account": "per account", "per counter": "per counter", "per device": "per device", "per vehicle": "per vehicle",
};

/** Compact, plain JSON of the recommendation. The LLM may quote ONLY these names, numbers and dates. */
export function summarizeForLlm(r: Recommendation) {
  return {
    plan_items: r.items.map((i) => ({
      name: i.copy.name_en, name_hindi: i.copy.name_hi, why: i.copy.why_en, quantity: i.quantity,
      unit: UNIT_EN[i.unit] ?? i.unit, unit_price_inr: i.unit_price_inr, monthly_inr: i.monthly_inr,
    })),
    monthly_total_inr: r.quote.monthly_total_inr,
    one_time_setup_inr: r.quote.one_time_setup_total_inr,
    contract_months: r.quote.contract_months,
    ready_by_date: r.quote.expected_activation_date,
    automatically_added: r.quote.fixes.length ? r.quote.fixes.map((f) => ({ added: f.added_copy.name_en, because_of: f.for_copy.name_en })) : undefined,
    not_available_wishes: r.blocked_wishes.length ? r.blocked_wishes.map((b) => ({
      product: b.copy.name_en, reason: b.reason_en,
      closest_alternative: b.alternative
        ? { name: b.alternative.copy.name_en, unit_price_inr: b.alternative.unit_price_inr, unit: UNIT_EN[b.alternative.unit] ?? b.alternative.unit, already_in_plan: b.alternative.in_plan }
        : null,
    })) : undefined,
    removed_to_fit_budget: r.dropped_for_budget.length ? r.dropped_for_budget.map((d) => d.copy.name_en) : undefined,
    budget: r.budget.requested !== null ? r.budget : undefined,
    indicative_only_expert_will_confirm: r.indicative || undefined,
    optional_extras: r.suggested_addons.length ? r.suggested_addons.map((a) => ({ name: a.copy.name_en, monthly_inr: a.monthly_inr })) : undefined,
    based_on: r.based_on?.line_en,
  };
}
