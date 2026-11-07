// The tools the LLM can call. Each one is plain code that validates input and uses our own backend logic.
import { getProduct, loadProducts } from "../data";
import { buildStarter } from "../starter";
import { listPrice } from "../quote";
import { Session, setOutcome } from "./session";
import {
  CURRENT_INTERNET, WISH_KEYS, WISH_PRODUCTS, lookupCity, mapBusinessType, resolveProductQuery, validateSlots, SlotFields,
} from "./mapping";
import { GstinResult } from "./redact";
import {
  RequiredSlot, alternativeFor, buildRecommendation, missingSlots, needsHuman, summarizeForLlm, toBusinessProfile,
} from "./recommend";
import { createCallback } from "./callbacks";
import { copyFor } from "../productCopy";
import { LANGUAGES } from "./config";

// ---------------- Tool definitions (OpenAI-style function calling) ----------------
export const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "update_profile",
      description:
        "Save facts the customer told you about their business. Call it every time you learn something new, with ONLY the new or changed fields. Returns which required details are still missing.",
      parameters: {
        type: "object",
        properties: {
          business_type: { type: "string", description: "What the business is, in the customer's words (e.g. kirana store, dental clinic)" },
          segment: { type: "string", enum: ["micro", "prof", "multi", "mfg"], description: "Only if you are sure and business_type is unusual: micro = small shop/salon/pharmacy; prof = clinic/CA/coaching/office; multi = several outlets; mfg = factory/workshop" },
          employee_count: { type: "integer", description: "Number of people working in the business (convert vague answers like '4-5 log' to one number and confirm it)" },
          num_sites: { type: "integer", description: "Number of locations (shops, outlets, offices, factories)" },
          city: { type: "string", description: "City name in English letters (e.g. Lucknow)" },
          city_tier: { type: "integer", enum: [1, 2], description: "ONLY if the city is unknown to you and the customer told you: 1 = big metro city, 2 = smaller city" },
          has_gstin: { type: "boolean", description: "Whether the business has a GST number" },
          current_internet: { type: "string", enum: [...CURRENT_INTERNET], description: "Current internet setup" },
          wishes: { type: "array", items: { type: "string", enum: [...WISH_KEYS] }, description: "FULL list of what the customer wants (replaces the old list). sim_only = wants ONLY a mobile plan" },
          budget_per_month: { type: "integer", description: "Monthly budget in rupees, only if the customer stated one" },
          language: { type: "string", enum: [...LANGUAGES], description: "Language the customer is writing in" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_product",
      description: "Check whether something the customer asks about can be sold to THIS business, with the reason and the closest allowed alternative. Use for questions like 'can I get 1 Gbps?' or 'do you have WhatsApp?'.",
      parameters: {
        type: "object",
        properties: { item: { type: "string", description: "What they asked about, e.g. '1 Gbps internet', 'CCTV', 'WhatsApp API', 'DTH'" } },
        required: ["item"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recommendation",
      description: "Build the recommended plan with exact items, quantities, prices and the monthly total. Call it once the required details are known, and again whenever the business details, wishes or budget change. Never call it with missing details.",
      parameters: {
        type: "object",
        properties: {
          wishes: { type: "array", items: { type: "string", enum: [...WISH_KEYS] }, description: "Optional: override the saved wishes" },
          only_these: { type: "boolean", description: "true when the customer wants ONLY the things in wishes (e.g. 'only CCTV', 'only a mobile plan') and not a full starter plan" },
          budget_per_month: { type: "integer", description: "Optional monthly budget in rupees" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_human",
      description: "Ask a human expert to call the customer back. Use when they ask for a person, are clearly frustrated, or their business is very large.",
      parameters: {
        type: "object",
        properties: { reason: { type: "string", enum: ["user_asked", "too_large", "frustrated", "other"] } },
        required: ["reason"],
        additionalProperties: false,
      },
    },
  },
];

// ---------------- Profile changes ----------------
const REC_FIELDS = ["segment", "employee_count", "num_sites", "city_tier", "has_gstin", "wishes", "budget_per_month"];
const ORDER: RequiredSlot[] = ["business_type", "employee_count", "num_sites", "city", "gst"];

/** Remember how far the conversation got (for the back-office view). */
function updateLastSlot(s: Session) {
  const missing = missingSlots(s.profile);
  const filled = ORDER.filter((slot) => !missing.includes(slot));
  s.lastSlot = missing.length === 0 ? "complete" : filled.length ? filled[filled.length - 1] : "start";
}

/** Apply validated fields to the session. Returns what changed and any notes for the LLM. */
export function applyFields(s: Session, f: SlotFields): { changed: string[]; notes: string[] } {
  const p = s.profile;
  const changed: string[] = [];
  const notes: string[] = [];
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K], label = String(k)) => {
    if (JSON.stringify(p[k]) !== JSON.stringify(v)) { p[k] = v; changed.push(label); }
  };

  if (f.business_type) {
    set("business_type", f.business_type);
    const seg = mapBusinessType(f.business_type);
    set("segment_from_type", seg ?? undefined, "segment");
    if (!seg && !f.segment && !p.segment_hint) notes.push("business_type not recognised: if you know the segment pass `segment`, otherwise ask what the business does");
  }
  if (f.segment) set("segment_hint", f.segment, "segment");
  if (f.employee_count !== undefined) set("employee_count", f.employee_count);
  if (f.num_sites !== undefined) set("num_sites", f.num_sites);
  if (f.city) {
    const hit = lookupCity(f.city);
    if (hit) { set("city", hit.city); set("city_tier", hit.tier as 1 | 2, "city_tier"); }
    else {
      set("city", f.city);
      if (f.city_tier === undefined) notes.push(`city "${f.city}" is not in our table: ask "Is it a big metro city or a smaller city?" then pass city_tier`);
    }
  }
  if (f.city_tier !== undefined && !(f.city && lookupCity(f.city))) set("city_tier", f.city_tier, "city_tier");
  if (f.has_gstin !== undefined) {
    // A looked-up GSTIN is more reliable than what the customer says
    if (p.gstin && ["Active", "Cancelled", "Suspended", "not_found"].includes(p.gstin.status)) notes.push("GST status already known from the GSTIN lookup: not changed");
    else set("has_gstin", f.has_gstin);
  }
  if (f.current_internet) set("current_internet", f.current_internet);
  if (f.wishes) set("wishes", f.wishes);
  if (f.budget_per_month !== undefined) set("budget_per_month", f.budget_per_month);
  if (f.language) set("language", f.language);

  if (changed.some((c) => REC_FIELDS.includes(c)) && s.recommendation) s.recommendation = null; // old numbers are no longer valid
  updateLastSlot(s);
  return { changed, notes };
}

/** A GSTIN lookup (done before the LLM sees the message) fills in what the registry knows. */
export function applyGstinLookup(s: Session, g: GstinResult) {
  const p = s.profile;
  p.gstin = g;
  if (g.status === "Active") p.has_gstin = true;
  else if (["Cancelled", "Suspended", "not_found"].includes(g.status)) p.has_gstin = false; // not a usable GST
  if (g.business_name) p.business_name = g.business_name;
  if (g.state) p.state = g.state;
  if (g.city) {
    const hit = lookupCity(g.city);
    if (hit) { p.city = hit.city; p.city_tier = hit.tier as 1 | 2; }
    else p.city = g.city;
  }
  if (s.recommendation) s.recommendation = null;
  updateLastSlot(s);
}

/** Create a callback lead once per reason. */
export function requestHuman(s: Session, reason: string) {
  if (s.handoff) return s.handoff;
  const p = s.profile;
  const lead = createCallback(s.id, reason, {
    segment: p.segment_hint ?? p.segment_from_type ?? null, city_tier: p.city_tier ?? null,
    employee_count: p.employee_count ?? null, num_sites: p.num_sites ?? null, has_gst: p.has_gstin ?? null,
    wishes: p.wishes, language: p.language, outcome: s.outcome,
  });
  s.handoff = { reason, callbackId: lead.id };
  setOutcome(s, "handoff");
  return s.handoff;
}

/** Non-sensitive view of the profile (what the LLM and the API may show). */
export function publicProfile(s: Session) {
  const p = s.profile;
  return {
    business_type: p.business_type ?? null,
    segment: p.segment_hint ?? p.segment_from_type ?? null,
    employee_count: p.employee_count ?? null,
    num_sites: p.num_sites ?? null,
    city: p.city ?? null,
    city_tier: p.city_tier ?? null,
    has_gst: p.has_gstin ?? null,
    gstin_status: p.gstin?.status ?? null,
    business_name: p.business_name ?? null,
    current_internet: p.current_internet ?? null,
    wishes: p.wishes,
    budget_per_month: p.budget_per_month ?? null,
    language: p.language,
  };
}

// ---------------- Tool handlers ----------------
export interface ToolOutcome { result: unknown; newRecommendation?: boolean }

export function runTool(s: Session, name: string, rawArgs: string): ToolOutcome {
  let args: unknown;
  try { args = rawArgs ? JSON.parse(rawArgs) : {}; } catch { return { result: { error: "arguments were not valid JSON" } }; }

  switch (name) {
    case "update_profile": {
      const { fields, errors } = validateSlots(args);
      const { changed, notes } = applyFields(s, fields);
      const human = needsHuman(s.profile);
      let handoffNote: string | undefined;
      if (human && !s.handoff) {
        requestHuman(s, human);
        handoffNote = "This business is larger than our online journey handles. A callback from a human expert was requested automatically. Still give an indicative plan, and tell the customer an expert will call within 1 working day.";
      }
      const missing = missingSlots(s.profile);
      return {
        result: {
          saved: changed, problems: [...errors, ...notes], missing_required: missing,
          ready_for_recommendation: missing.length === 0,
          recommendation_outdated: changed.some((c) => REC_FIELDS.includes(c)),
          profile: publicProfile(s), handoff_note: handoffNote,
        },
      };
    }

    case "check_product": {
      const item = typeof (args as { item?: unknown }).item === "string" ? (args as { item: string }).item : "";
      const q = resolveProductQuery(item);
      let pid = q.productIds[0];
      if (!pid) {
        // try a direct match on a catalogue name ("Business Email", "Static IP")
        const lower = item.toLowerCase();
        pid = loadProducts().find((pr) => copyFor(pr.product_id).name_en.toLowerCase().includes(lower) || pr.product_name.toLowerCase().includes(lower))?.product_id ?? "";
      }
      if (!pid) return { result: { found: false, message: "That is not something Accel Business sells. Say so politely and steer back to business connectivity and tools." } };
      const prod = getProduct(pid)!;
      const info = { name: copyFor(pid).name_en, unit_price_inr: listPrice(prod), unit: prod.unit };
      const bp = toBusinessProfile(s.profile);
      if (!bp) return { result: { found: true, product: info, eligibility: "unknown until we know: " + missingSlots(s.profile).join(", ") } };
      const starter = buildStarter(bp);
      const blocked = starter.blocked.find((b) => b.product_id === pid);
      if (!blocked) return { result: { found: true, eligible: true, product: info } };
      const alt = alternativeFor(bp, pid);
      return {
        result: {
          found: true, eligible: false, product: info, reason: blocked.reason_en,
          closest_alternative: alt ? { name: alt.copy.name_en, unit_price_inr: alt.unit_price_inr, unit: alt.unit } : null,
        },
      };
    }

    case "get_recommendation": {
      const a = args as { wishes?: unknown; only_these?: unknown; budget_per_month?: unknown };
      const { fields } = validateSlots({ wishes: a.wishes, budget_per_month: a.budget_per_month });
      if (fields.wishes) s.profile.wishes = fields.wishes;
      if (fields.budget_per_month !== undefined) s.profile.budget_per_month = fields.budget_per_month;
      const missing = missingSlots(s.profile);
      if (missing.length) return { result: { error: "missing_required_details", missing_required: missing } };
      s.recommendationCount += 1;
      const rec = buildRecommendation(s.profile, {
        wishes: s.profile.wishes, only_these: a.only_these === true,
        budget: s.profile.budget_per_month,
      }, s.recommendationCount);
      s.recommendation = rec;
      setOutcome(s, "recommended");
      return { result: summarizeForLlm(rec), newRecommendation: true };
    }

    case "request_human": {
      const r = (args as { reason?: string }).reason;
      const reason = ["user_asked", "too_large", "frustrated", "other"].includes(r ?? "") ? r! : "other";
      const h = requestHuman(s, reason);
      return { result: { created: true, callback_id: h.callbackId, note: "Tell the customer an expert will call within 1 working day. Do NOT ask for a phone number in chat: they can leave it on the next screen." } };
    }

    default:
      return { result: { error: `unknown tool ${name}` } };
  }
}

export { WISH_PRODUCTS };
