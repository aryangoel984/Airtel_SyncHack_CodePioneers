// Step 6: the back-office queue for sales teams and partners.
// It lists the people the digital journey could NOT close on its own, says who should call them
// (field sales, a local channel partner, or the inside-sales phone team), and ranks them by the lead score.
import fs from "fs";
import path from "path";
import { readCallbacks } from "../advisor/callbacks";
import { readSummaries } from "../advisor/session";
import { listOrdersPrivate, Order, simNow } from "../orders";
import { loadLeads } from "../data";
import { maskMobile } from "../mask";
import { segmentName } from "../rules";
import { featuresFromLead, scoreLead, Score, modelReport } from "./model";

export const OWNERS = ["Field sales", "Channel partner", "Inside sales"] as const;
export type Owner = (typeof OWNERS)[number];
export const STATUSES = ["New", "Contacted", "Won", "Lost"] as const;
export type WorkStatus = (typeof STATUSES)[number];

export interface QueueItem {
  id: string; // CB-xxxx (callback request) or UD-2026-xxxx (order)
  kind: "callback" | "order";
  createdAt: string;
  reason: { code: string; label: string; detail?: string };
  business: { name: string | null; segment: string | null; city_tier: number | null; employees: number | null; sites: number | null; has_gst: boolean | null; language: string | null };
  wishes: string[];
  value_inr: number | null; // monthly plan value (estimate when "estimated" is true)
  valueEstimated: boolean;
  score: Score;
  expected_value_inr: number; // chance x monthly value: used to sort
  owner: Owner;
  ownerWhy: string;
  status: WorkStatus;
  note: string;
  updatedAt: string | null;
  mobile_masked: string | null;
  orderStatus?: string;
  kycIssues?: string[];
}

// ---------------- saved work (owner / status / notes) + audit log ----------------
interface Store {
  updates: Record<string, { owner?: Owner; status: WorkStatus; note: string; updatedAt: string }>;
  audit: { at: string; id: string; action: "reveal_number" | "update" | "demo_reset"; detail?: string }[];
}
const storeFile = () => process.env.BACKOFFICE_FILE ?? path.join(process.cwd(), "data", "backoffice.json");
function readStore(): Store {
  try { return JSON.parse(fs.readFileSync(storeFile(), "utf8")); } catch { return { updates: {}, audit: [] }; }
}
function writeStore(s: Store) {
  const tmp = storeFile() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
  fs.renameSync(tmp, storeFile());
}

/** Demo reset: clear owners/status/notes; the audit log keeps a record that a reset happened. */
export function resetBackoffice() {
  const store = readStore();
  writeStore({ updates: {}, audit: [...store.audit, { at: simNow(), id: "-", action: "demo_reset" }] });
}

// ---------------- helpers ----------------
const SEG_NAMES: Record<string, string> = { micro: "Micro retail", prof: "Professional office", multi: "Multi-site", mfg: "Manufacturer" };

/** Typical monthly bundle value per segment (median of activated leads): used when we don't know the plan yet. */
let medians: Record<string, number> | null = null;
export function segmentMedianValue(segment: string | null): number {
  if (!medians) {
    medians = {};
    for (const code of Object.keys(SEG_NAMES)) {
      const vals = loadLeads().filter((l) => l.segment === segmentName(code) && l.monthly_bundle_value_inr)
        .map((l) => l.monthly_bundle_value_inr!).sort((a, b) => a - b);
      medians[code] = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
    }
  }
  return segment ? medians[segment] ?? 0 : 0;
}

/** Who should take this lead, and why (one simple rule set, easy to change). */
export function routeLead(x: { reasonCode: string; segment: string | null; city_tier: number | null; sites: number | null }): { owner: Owner; why: string } {
  if (x.reasonCode === "kyc_rejected") return { owner: "Field sales", why: "Needs an in-person document check" };
  if (x.reasonCode === "too_large" || x.segment === "multi" || x.segment === "mfg" || (x.sites ?? 0) >= 3) {
    return { owner: "Field sales", why: "Large or multi-site business: worth a visit" };
  }
  if (x.segment === "micro" && x.city_tier === 2) return { owner: "Channel partner", why: "Small shop in a smaller city: the local partner is closest" };
  return { owner: "Inside sales", why: "Can be closed on a phone call" };
}

const REASONS: Record<string, { label: string; urgency: number }> = {
  user_asked: { label: "Asked for a call", urgency: 4 },
  frustrated: { label: "Got stuck in the chat", urgency: 4 },
  too_large: { label: "Large business", urgency: 3 },
  other: { label: "Advisor handed over", urgency: 3 },
  kyc_rejected: { label: "Couldn't verify online", urgency: 3 },
  kyc_fix: { label: "Documents need a fix", urgency: 2 },
  kyc_not_started: { label: "Plan confirmed, verification not started", urgency: 1 },
};

// ---------------- build the queue ----------------
export function buildQueue(): QueueItem[] {
  const store = readStore();
  const items: Omit<QueueItem, "owner" | "ownerWhy" | "status" | "note" | "updatedAt">[] = [];
  const meta: Record<string, { reasonCode: string }> = {};

  // 1. "Talk to a person" requests and hand-overs from the AI Advisor
  const summaries = new Map(readSummaries().map((s) => [String(s.sessionId), s]));
  for (const c of readCallbacks()) {
    const sm = c.summary as Record<string, unknown>;
    const chat = summaries.get(c.sessionId) as Record<string, unknown> | undefined;
    const segment = (sm.segment as string) ?? null;
    const known = (chat?.monthly_total_inr as number | null) ?? null;
    const f = {
      segment, city_tier: (sm.city_tier as number) ?? null, has_gst: (sm.has_gst as boolean) ?? null,
      employee_count: (sm.employee_count as number) ?? null, num_sites: (sm.num_sites as number) ?? null,
      language: (sm.language as string) ?? null,
    };
    const reasonCode = REASONS[c.reason] ? c.reason : "other";
    meta[c.id] = { reasonCode };
    const value = known ?? segmentMedianValue(segment);
    const score = scoreLead(f);
    items.push({
      id: c.id, kind: "callback", createdAt: c.createdAt,
      reason: { code: reasonCode, label: REASONS[reasonCode].label },
      business: { name: null, segment, city_tier: f.city_tier, employees: f.employee_count, sites: f.num_sites, has_gst: f.has_gst, language: f.language },
      wishes: (sm.wishes as string[]) ?? [],
      value_inr: value || null, valueEstimated: known == null,
      score, expected_value_inr: Math.round(score.probability * (value || 0)),
      mobile_masked: c.mobile ? maskMobile(c.mobile) : null,
    });
  }

  // 2. Orders stuck before verification
  for (const o of listOrdersPrivate()) {
    const reasonCode = o.status === "KYC_REJECTED" ? "kyc_rejected" : o.status === "KYC_ACTION_NEEDED" ? "kyc_fix" : o.status === "QUOTE_ACCEPTED" ? "kyc_not_started" : null;
    if (!reasonCode) continue;
    meta[o.id] = { reasonCode };
    const p = o.profile;
    const score = scoreLead({ segment: p.segment, city_tier: p.city_tier, has_gst: p.has_valid_active_gstin, employee_count: p.employee_count, num_sites: p.num_sites, language: o.language });
    const issues = o.kyc?.result?.checks.filter((c) => c.result === "fail").map((c) => c.en) ?? [];
    items.push({
      id: o.id, kind: "order", createdAt: o.createdAt,
      reason: { code: reasonCode, label: REASONS[reasonCode].label, detail: issues[0] },
      business: { name: o.kyc?.result?.business.name ?? null, segment: p.segment, city_tier: p.city_tier, employees: p.employee_count, sites: p.num_sites, has_gst: p.has_valid_active_gstin, language: o.language },
      wishes: [],
      value_inr: o.quote.monthly_total_inr, valueEstimated: false,
      score, expected_value_inr: Math.round(score.probability * o.quote.monthly_total_inr),
      mobile_masked: maskMobile(o.mobile), orderStatus: o.status, kycIssues: issues,
    });
  }

  const full: QueueItem[] = items.map((it) => {
    const route = routeLead({ reasonCode: meta[it.id].reasonCode, segment: it.business.segment, city_tier: it.business.city_tier, sites: it.business.sites });
    const saved = store.updates[it.id];
    return {
      ...it,
      owner: saved?.owner ?? route.owner,
      ownerWhy: saved?.owner && saved.owner !== route.owner ? "Changed by a team member" : route.why,
      status: saved?.status ?? "New",
      note: saved?.note ?? "",
      updatedAt: saved?.updatedAt ?? null,
    };
  });

  // Open work first; then the most urgent reason; then the biggest expected value.
  const open = (s: WorkStatus) => (s === "New" ? 0 : s === "Contacted" ? 1 : 2);
  return full.sort((a, b) => open(a.status) - open(b.status)
    || REASONS[b.reason.code].urgency - REASONS[a.reason.code].urgency
    || b.expected_value_inr - a.expected_value_inr);
}

export function updateItem(id: string, change: { owner?: string; status?: string; note?: string }): QueueItem | { error: string } {
  const item = buildQueue().find((x) => x.id === id);
  if (!item) return { error: "Not found" };
  if (change.owner !== undefined && !(OWNERS as readonly string[]).includes(change.owner)) return { error: "Unknown owner" };
  if (change.status !== undefined && !(STATUSES as readonly string[]).includes(change.status)) return { error: "Unknown status" };
  const store = readStore();
  const prev = store.updates[id] ?? { status: item.status, note: item.note };
  store.updates[id] = {
    ...prev,
    ...(change.owner !== undefined ? { owner: change.owner as Owner } : {}),
    ...(change.status !== undefined ? { status: change.status as WorkStatus } : {}),
    ...(change.note !== undefined ? { note: change.note.slice(0, 500) } : {}),
    updatedAt: simNow(),
  };
  store.audit.push({ at: simNow(), id, action: "update", detail: Object.keys(change).join(",") });
  writeStore(store);
  return buildQueue().find((x) => x.id === id)!;
}

/** Show the full number to a team member, and record that it was shown (audit trail). */
export function revealNumber(id: string): { mobile: string } | { error: string } {
  let mobile: string | null = null;
  if (id.startsWith("CB-")) mobile = readCallbacks().find((c) => c.id === id)?.mobile ?? null;
  else mobile = listOrdersPrivate().find((o) => o.id === id)?.mobile ?? null;
  if (!mobile) return { error: "No number for this lead" };
  const store = readStore();
  store.audit.push({ at: simNow(), id, action: "reveal_number" });
  writeStore(store);
  console.log(`[backoffice] number shown for ${id} (${maskMobile(mobile)})`);
  return { mobile };
}

export function auditLog(limit = 50) {
  return readStore().audit.slice(-limit).reverse();
}

// ---------------- funnel numbers for the dashboard ----------------
const AFTER_KYC = ["KYC_VERIFIED", "SITE_CHECK", "TECH_SCHEDULED", "INSTALLED", "ACTIVE"];

export function funnel() {
  const chats = readSummaries();
  const orders: Order[] = listOrdersPrivate();
  const outcome = (o: string) => chats.filter((c) => c.outcome === o).length;
  const planShown = chats.filter((c) => ["recommended", "quote_opened", "ordered"].includes(String(c.outcome)) || c.monthly_total_inr != null).length;
  const stopped: Record<string, number> = {};
  for (const c of chats) {
    if (c.outcome === "in_progress" || c.outcome === "dropped") {
      const k = String(c.lastSlot ?? "start");
      stopped[k] = (stopped[k] ?? 0) + 1;
    }
  }
  return {
    stages: [
      { key: "chats", label: "Chats started", value: chats.length },
      { key: "plans", label: "Plan shown", value: planShown },
      { key: "quotes", label: "Quote opened", value: outcome("quote_opened") + outcome("ordered") },
      { key: "orders", label: "Orders placed", value: orders.length },
      { key: "verified", label: "Business verified", value: orders.filter((o) => AFTER_KYC.includes(o.status)).length },
      { key: "live", label: "Live", value: orders.filter((o) => o.status === "ACTIVE").length },
    ],
    handoffs: outcome("handoff"),
    callbacks: readCallbacks().length,
    stoppedAt: stopped, // where unfinished chats stopped (last detail collected)
    aiShare: chats.length ? chats.filter((c) => c.mode === "ai").length / chats.length : 0,
  };
}

// ---------------- re-engage: past leads lost for reasons the digital journey fixes ----------------
/** Drop reasons that happened only because a person had to visit or call. A WhatsApp link to the advisor fixes these. */
export const RECOVERABLE = ["Unreachable after 3 attempts", "Owner had no time for a visit", "Visit not scheduled by sales"];

export function reengageList(limit = 50) {
  const pool = loadLeads().filter((l) => l.outcome === "Dropped" && RECOVERABLE.includes(l.drop_reason));
  const scored = pool.map((l) => {
    const seg = Object.keys(SEG_NAMES).find((c) => segmentName(c) === l.segment) ?? null;
    const s = scoreLead(featuresFromLead(l));
    const value = segmentMedianValue(seg);
    return {
      lead_id: l.lead_id, business_name: l.business_name, contact_name: l.contact_name, segment: seg, city: l.city,
      city_tier: l.city_tier, language: l.preferred_language, drop_reason: l.drop_reason, source: l.lead_source,
      score: s, value_inr: value, expected_value_inr: Math.round(s.probability * value),
      channel: routeLead({ reasonCode: "reengage", segment: seg, city_tier: l.city_tier, sites: l.num_sites }).owner,
    };
  }).sort((a, b) => b.expected_value_inr - a.expected_value_inr);

  const totalExpected = scored.reduce((a, x) => a + x.score.probability, 0);
  const top = scored.slice(0, Math.max(1, Math.round(scored.length * 0.2)));
  return {
    pool: scored.length,
    byReason: Object.fromEntries(RECOVERABLE.map((r) => [r, pool.filter((l) => l.drop_reason === r).length])),
    expectedCustomersAll: Math.round(totalExpected),
    expectedCustomersTop20: Math.round(top.reduce((a, x) => a + x.score.probability, 0)),
    expectedMonthlyTop20: Math.round(top.reduce((a, x) => a + x.expected_value_inr, 0)),
    leads: scored.slice(0, limit),
    model: { auc: modelReport().auc, lift: modelReport().lift },
  };
}
