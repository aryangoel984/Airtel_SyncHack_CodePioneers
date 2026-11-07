// Plain-code helpers: city -> tier, business type -> segment, wishes -> products, slot validation.
// (The LLM never decides these. It can only pass values that we check here.)
import { loadLeads, getProduct } from "../data";
import { SEGMENT_CODES, segmentName } from "../segments";
import { LANGUAGES, AdvisorLang } from "./config";

// ---------------- Cities ----------------
const CITY_ALIASES: Record<string, string> = {
  bangalore: "Bengaluru", bengaluru: "Bengaluru", बेंगलुरु: "Bengaluru", बैंगलोर: "Bengaluru", बेंगलूरु: "Bengaluru",
  bombay: "Mumbai", mumbai: "Mumbai", मुंबई: "Mumbai", "new delhi": "Delhi", delhi: "Delhi", दिल्ली: "Delhi",
  calcutta: "Kolkata", kolkata: "Kolkata", कोलकाता: "Kolkata", madras: "Chennai", chennai: "Chennai", चेन्नई: "Chennai",
  hyderabad: "Hyderabad", हैदराबाद: "Hyderabad", poona: "Pune", pune: "Pune", पुणे: "Pune",
  ahmedabad: "Ahmedabad", अहमदाबाद: "Ahmedabad", bhopal: "Bhopal", भोपाल: "Bhopal",
  coimbatore: "Coimbatore", कोयंबटूर: "Coimbatore", indore: "Indore", इंदौर: "Indore", jaipur: "Jaipur", जयपुर: "Jaipur",
  kochi: "Kochi", cochin: "Kochi", कोच्चि: "Kochi", lucknow: "Lucknow", लखनऊ: "Lucknow",
  ludhiana: "Ludhiana", लुधियाना: "Ludhiana", mysuru: "Mysuru", mysore: "Mysuru", मैसूर: "Mysuru",
  nagpur: "Nagpur", नागपुर: "Nagpur", nashik: "Nashik", nasik: "Nashik", नाशिक: "Nashik", नासिक: "Nashik",
  patna: "Patna", पटना: "Patna", surat: "Surat", सूरत: "Surat", vadodara: "Vadodara", baroda: "Vadodara",
  वडोदरा: "Vadodara", बड़ौदा: "Vadodara", visakhapatnam: "Visakhapatnam", vizag: "Visakhapatnam",
  विशाखापत्तनम: "Visakhapatnam", vishakhapatnam: "Visakhapatnam",
};

let _cityTier: Map<string, number> | null = null;
/** City -> tier table, built from smb_leads.csv. */
function cityTierTable(): Map<string, number> {
  if (!_cityTier) {
    _cityTier = new Map();
    for (const l of loadLeads()) _cityTier.set(l.city, l.city_tier);
  }
  return _cityTier;
}

/** "lucknow", "Lucknow, UP", "लखनऊ" -> { city: "Lucknow", tier: 2 } or null when unknown. */
export function lookupCity(text: string): { city: string; tier: number } | null {
  const table = cityTierTable();
  const raw = (text ?? "").trim().toLowerCase();
  if (!raw) return null;
  let canonical: string | undefined = CITY_ALIASES[raw];
  if (!canonical) {
    // "Lucknow, Uttar Pradesh" or "lucknow mein": look for any known name inside the text
    const hit = Object.keys(CITY_ALIASES).find((k) => new RegExp(`(^|[^a-z\\p{L}])${k}([^a-z\\p{L}]|$)`, "iu").test(raw));
    if (hit) canonical = CITY_ALIASES[hit];
  }
  if (!canonical) {
    const exact = [...table.keys()].find((c) => c.toLowerCase() === raw);
    if (exact) canonical = exact;
  }
  if (!canonical) return null;
  const tier = table.get(canonical);
  return tier ? { city: canonical, tier } : null;
}

/** "big metro city" / "smaller city" in English, Hindi and Hinglish -> 1 | 2 | null */
export function parseTierWords(text: string): 1 | 2 | null {
  const t = (text ?? "").toLowerCase();
  if (/(small|smaller|chhota|chota|tier[\s-]?2|town|छोटा|छोटे|कस्बा)/i.test(t)) return 2;
  if (/(metro|big|large|bada|bade|tier[\s-]?1|बड़ा|बड़े|मेट्रो)/i.test(t)) return 1;
  return null;
}

// ---------------- Business type -> segment ----------------
type SegCode = "micro" | "prof" | "multi" | "mfg";
let _typeTable: Map<string, SegCode> | null = null;

function typeTable() {
  if (!_typeTable) {
    _typeTable = new Map();
    for (const l of loadLeads()) {
      const code = SEGMENT_CODES[l.segment] as SegCode | undefined;
      if (code) _typeTable.set(l.business_type.toLowerCase(), code);
    }
  }
  return _typeTable;
}

// Extra words people actually use (English, Hindi, Hinglish). Checked in this order.
const TYPE_KEYWORDS: [SegCode, RegExp][] = [
  ["multi", /(chain|outlets?|franchise|branches|आउटलेट|चेन)/i],
  ["mfg", /(factory|factories|manufactur|workshop|\bunit\b|textile|mill|फैक्ट्री|फैक्टरी|कारखाना|वर्कशॉप)/i],
  ["prof", /(clinic|doctor|dentist|hospital|diagnostic|\blab\b|\bca\b|chartered|accountant|lawyer|advocate|\blaw\b|coaching|tuition|classes|architect|insurance|real estate|travel|physio|consultant|\boffice\b|agency|studio|क्लिनिक|डॉक्टर|वकील|कोचिंग|ऑफिस|ऑफ़िस)/i],
  ["micro", /(kirana|किराना|grocery|general store|provision|salon|parlou?r|beauty|barber|सैलून|पार्लर|chemist|medical|pharmacy|फार्मेसी|मेडिकल|bakery|sweet|mithai|मिठाई|stationery|boutique|tailor|optician|hardware|repair|tea stall|dhaba|restaurant|cafe|\bhotel\b|\bshop\b|\bstore\b|dukaan|dukan|दुकान|स्टोर|retail)/i],
];

/** Free text -> segment code, or null if we can't tell (then the LLM may pass a `segment` hint). */
export function mapBusinessType(text: string): SegCode | null {
  const t = (text ?? "").trim().toLowerCase();
  if (!t) return null;
  const table = typeTable();
  if (table.has(t)) return table.get(t)!;
  // longest known type contained in the text ("my kirana store" -> "kirana store")
  const known = [...table.keys()].sort((a, b) => b.length - a.length).find((k) => t.includes(k));
  if (known) return table.get(known)!;
  for (const [seg, re] of TYPE_KEYWORDS) if (re.test(t)) return seg;
  return null;
}

/** Rule: 3 or more sites is always a multi-site business, whatever the type. */
export function resolveSegment(segmentFromType: SegCode | null, numSites?: number): SegCode | null {
  if (numSites !== undefined && numSites >= 3) return "multi";
  return segmentFromType;
}

// ---------------- Wishes ----------------
export const WISH_KEYS = [
  "cctv", "whatsapp", "billing", "email", "website", "sim_only", "wifi", "sms", "tollfree", "firewall",
  "iot", "fleet", "phone_lines", "security", "static_ip", "backup_internet", "cloud_backup",
  "gigabit", "dedicated_line", "sdwan", "internet",
] as const;
export type WishKey = (typeof WISH_KEYS)[number];

/** Wish -> product ids. `sim_only` and `internet` are handled specially in recommend.ts. */
export const WISH_PRODUCTS: Record<WishKey, string[]> = {
  cctv: ["P23"], whatsapp: ["P15"], billing: ["P19"], email: ["P16"], website: ["P18"], sim_only: [],
  wifi: ["P22"], sms: ["P14"], tollfree: ["P13"], firewall: ["P21"], iot: ["P24"], fleet: ["P25"],
  phone_lines: ["P12"], security: ["P20"], static_ip: ["P11"], backup_internet: ["P09"], cloud_backup: ["P17"],
  gigabit: ["P03"], dedicated_line: ["P05"], sdwan: ["P10"], internet: [],
};

// Synonyms in English, Hindi and Hinglish. Order matters: more specific first.
const WISH_SYNONYMS: [WishKey, RegExp][] = [
  // "only a mobile plan", "just want a SIM", "sirf mobile plan", "सिर्फ़ मोबाइल प्लान" (the dotted letter can be 1 or 2 characters)
  ["sim_only", /(sirf|only|just|bas|सिर्फ|सिर्फ़|सिर्फ़|केवल)\s+(?:(?:want|need|chahiye|चाहिए)\s+)?(?:a\s+|an\s+|ek\s+|एक\s+)?(mobile|sim|phone|postpaid|मोबाइल|सिम)/i],
  ["sim_only", /(mobile|sim)\s+(plan\s+)?(hi\s+)?(chahiye|chahie|only)\s*$/i],
  ["gigabit", /(1\s*gbps|1\s*gb\b|gigabit|1000\s*mbps|1g\b)/i],
  ["dedicated_line", /(leased\s*line|dedicated\s*(internet\s*)?line|डेडिकेटेड)/i],
  ["sdwan", /(sd-?wan)/i],
  ["backup_internet", /(backup\s*(internet|connection|net)|failover|standby\s*internet|बैकअप\s*इंटरनेट)/i],
  ["cloud_backup", /(cloud\s*backup|data\s*backup|online\s*backup|storage|बैकअप)/i],
  ["cctv", /(cctv|camera|cameras|कैमरा|कैमरे|सीसीटीवी|nigrani|निगरानी)/i],
  ["whatsapp", /(whats\s*app|whatsap|व्हाट्?सएप|व्हाट्सऐप|वाट्सएप|व्हाट्सअप)/i],
  ["billing", /(billing|\bpos\b|upi\s*machine|card\s*machine|bill\s*machine|swipe\s*machine|बिलिंग|पीओएस|कार्ड\s*मशीन)/i],
  ["email", /(e-?mail|ईमेल|mail\s*id|office\s*apps?)/i],
  ["website", /(website|web\s*site|domain|वेबसाइट|वेबसाईट)/i],
  ["wifi", /(wi-?fi|वाई-?फ़?ाई|guest\s*network)/i],
  ["sms", /(bulk\s*sms|\bsms\b|एसएमएस)/i],
  ["tollfree", /(toll[\s-]?free|1800|टोल\s*फ़्?री)/i],
  ["firewall", /(firewall|फायरवॉल)/i],
  ["iot", /(machine\s*monitor|iot|मशीन\s*मॉनिटर)/i],
  ["fleet", /(fleet|vehicle|gps|tracker|गाड़ी\s*ट्रैक|ट्रैकर)/i],
  ["phone_lines", /(cloud\s*telephony|telephony|ivr|call\s*cent(er|re)|sip|business\s*phone\s*lines?|landline)/i],
  ["security", /(antivirus|anti-virus|endpoint|virus|cyber\s*security|security|सुरक्षा|एंटीवायरस)/i],
  ["static_ip", /(static\s*ip|fixed\s*ip)/i],
  ["internet", /(internet|broadband|fibre|fiber|wifi\s*connection|इंटरनेट|ब्रॉडबैंड)/i],
];

/** Free text -> wish keys (used by guided mode and as a safety net for the LLM). */
export function extractWishes(text: string): WishKey[] {
  const found = new Set<WishKey>();
  for (const [key, re] of WISH_SYNONYMS) {
    if (re.test(text ?? "")) found.add(key);
  }
  // "email" must not match everything with "mail"; "internet" is only a wish when nothing else is
  if (found.size > 1) found.delete("internet");
  if (found.has("sim_only") && found.size > 1) found.delete("sim_only") ;
  return [...found];
}

/** Find a product from a wish key or a product name typed by the LLM ("Fibre 1G", "1 Gbps internet"). */
export function resolveProductQuery(q: string): { wish?: WishKey; productIds: string[] } {
  const t = (q ?? "").trim();
  const wish = extractWishes(t)[0];
  if (wish) return { wish, productIds: WISH_PRODUCTS[wish] };
  return { productIds: [] };
}

// ---------------- Slots ----------------
export const CURRENT_INTERNET = ["none", "mobile_hotspot", "home_broadband", "business_broadband", "leased_line", "mixed"] as const;
export type CurrentInternet = (typeof CURRENT_INTERNET)[number];

export interface SlotFields {
  business_type?: string;
  segment?: SegCode;
  employee_count?: number;
  num_sites?: number;
  city?: string;
  city_tier?: 1 | 2;
  has_gstin?: boolean;
  current_internet?: CurrentInternet;
  wishes?: WishKey[];
  budget_per_month?: number;
  language?: AdvisorLang;
}

/** Check every field the LLM sends. Returns the clean fields and a list of problems. */
export function validateSlots(input: unknown): { fields: SlotFields; errors: string[] } {
  const errors: string[] = [];
  const f: SlotFields = {};
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  if (r.business_type !== undefined) {
    if (typeof r.business_type === "string" && r.business_type.trim() && r.business_type.length <= 80) f.business_type = r.business_type.trim();
    else errors.push("business_type must be a short text");
  }
  if (r.segment !== undefined) {
    if (["micro", "prof", "multi", "mfg"].includes(r.segment as string)) f.segment = r.segment as SegCode;
    else errors.push("segment must be one of micro, prof, multi, mfg");
  }
  const int = (name: string, lo: number, hi: number): number | undefined => {
    const v = r[name];
    if (v === undefined) return undefined;
    if (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi) return v;
    errors.push(`${name} must be a whole number from ${lo} to ${hi}`);
    return undefined;
  };
  const emp = int("employee_count", 1, 100000); if (emp !== undefined) f.employee_count = emp;
  const sites = int("num_sites", 1, 10000); if (sites !== undefined) f.num_sites = sites;
  const budget = int("budget_per_month", 100, 10_000_000); if (budget !== undefined) f.budget_per_month = budget;
  if (r.city !== undefined) {
    if (typeof r.city === "string" && r.city.trim() && r.city.length <= 60) f.city = r.city.trim();
    else errors.push("city must be a short text");
  }
  if (r.city_tier !== undefined) {
    if (r.city_tier === 1 || r.city_tier === 2) f.city_tier = r.city_tier;
    else errors.push("city_tier must be 1 (big metro) or 2 (smaller city)");
  }
  if (r.has_gstin !== undefined) {
    if (typeof r.has_gstin === "boolean") f.has_gstin = r.has_gstin;
    else errors.push("has_gstin must be true or false");
  }
  if (r.current_internet !== undefined) {
    if ((CURRENT_INTERNET as readonly string[]).includes(r.current_internet as string)) f.current_internet = r.current_internet as CurrentInternet;
    else errors.push(`current_internet must be one of ${CURRENT_INTERNET.join(", ")}`);
  }
  if (r.wishes !== undefined) {
    if (Array.isArray(r.wishes) && r.wishes.every((w) => (WISH_KEYS as readonly string[]).includes(w as string))) f.wishes = [...new Set(r.wishes as WishKey[])];
    else errors.push(`wishes must be a list of: ${WISH_KEYS.join(", ")}`);
  }
  if (r.language !== undefined) {
    if ((LANGUAGES as readonly string[]).includes(r.language as string)) f.language = r.language as AdvisorLang;
    else errors.push("unknown language");
  }
  return { fields: f, errors };
}

/** Parse a count from vague text: "15", "4-5 log", "10 se 12" -> a single number (upper end of a range). */
export function parseCount(text: string): number | null {
  const nums = (text ?? "").match(/\d+/g)?.map(Number).filter((n) => n > 0);
  if (!nums?.length) return null;
  return Math.max(...nums.slice(0, 2));
}

export { getProduct, segmentName };
