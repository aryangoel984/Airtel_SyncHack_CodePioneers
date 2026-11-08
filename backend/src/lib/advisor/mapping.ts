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


/**
 * Cities that are not in smb_leads.csv. The dataset's tier 1 is the 8 big metros; we treat their satellite
 * cities (same metro area, same fibre network) as tier 1 too, and every other city as tier 2. Assumption, stated in CLAUDE.md.
 */
const METRO_AREA: Record<string, string> = {
  gurugram: "Gurugram", gurgaon: "Gurugram", गुरुग्राम: "Gurugram", गुड़गांव: "Gurugram", noida: "Noida", नोएडा: "Noida",
  "greater noida": "Greater Noida", ghaziabad: "Ghaziabad", गाज़ियाबाद: "Ghaziabad", गाजियाबाद: "Ghaziabad",
  faridabad: "Faridabad", फरीदाबाद: "Faridabad", thane: "Thane", ठाणे: "Thane", "navi mumbai": "Navi Mumbai",
  secunderabad: "Secunderabad", howrah: "Howrah", "new town": "Kolkata", "pimpri chinchwad": "Pimpri-Chinchwad", "pimpri-chinchwad": "Pimpri-Chinchwad",
};
const OTHER_CITIES = [
  "Agra", "Meerut", "Kanpur", "Varanasi", "Prayagraj", "Allahabad", "Gorakhpur", "Bareilly", "Aligarh", "Moradabad", "Saharanpur", "Jhansi",
  "Chandigarh", "Mohali", "Amritsar", "Jalandhar", "Patiala", "Dehradun", "Haridwar", "Shimla", "Jammu", "Srinagar",
  "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner", "Raipur", "Bilaspur", "Ranchi", "Jamshedpur", "Dhanbad", "Bhubaneswar", "Cuttack",
  "Guwahati", "Siliguri", "Durgapur", "Asansol", "Gwalior", "Jabalpur", "Ujjain", "Rajkot", "Bhavnagar", "Jamnagar", "Gandhinagar", "Anand",
  "Aurangabad", "Chhatrapati Sambhajinagar", "Solapur", "Kolhapur", "Sangli", "Amravati", "Thiruvananthapuram", "Trivandrum", "Kozhikode", "Calicut",
  "Thrissur", "Madurai", "Tiruchirappalli", "Trichy", "Salem", "Tiruppur", "Vellore", "Mangaluru", "Mangalore", "Hubballi", "Hubli", "Belagavi", "Belgaum",
  "Vijayawada", "Guntur", "Nellore", "Tirupati", "Warangal", "Goa", "Panaji", "Puducherry", "Pondicherry", "Gaya", "Muzaffarpur", "Bhagalpur",
];
const OTHER_HINDI: Record<string, string> = {
  आगरा: "Agra", मेरठ: "Meerut", कानपुर: "Kanpur", वाराणसी: "Varanasi", बनारस: "Varanasi", प्रयागराज: "Prayagraj", इलाहाबाद: "Prayagraj",
  गोरखपुर: "Gorakhpur", बरेली: "Bareilly", अलीगढ़: "Aligarh", चंडीगढ़: "Chandigarh", अमृतसर: "Amritsar", देहरादून: "Dehradun", जोधपुर: "Jodhpur",
  उदयपुर: "Udaipur", कोटा: "Kota", अजमेर: "Ajmer", रायपुर: "Raipur", रांची: "Ranchi", ग्वालियर: "Gwalior", जबलपुर: "Jabalpur", राजकोट: "Rajkot",
  औरंगाबाद: "Aurangabad", कोल्हापुर: "Kolhapur", सोलापुर: "Solapur",
};
const OTHER_BY_KEY = new Map<string, string>([
  ...OTHER_CITIES.map((c) => [c.toLowerCase(), c] as [string, string]), ...Object.entries(OTHER_HINDI),
  ["banaras", "Varanasi"], ["allahabad", "Prayagraj"], ["trivandrum", "Thiruvananthapuram"], ["calicut", "Kozhikode"], ["trichy", "Tiruchirappalli"],
  ["mangalore", "Mangaluru"], ["hubli", "Hubballi"], ["belgaum", "Belagavi"], ["pondicherry", "Puducherry"],
]);

/** Known cities outside the dataset: metro-area satellites are tier 1, the rest tier 2. */
function lookupExtraCity(raw: string): { city: string; tier: number } | null {
  const inText = (k: string) => raw === k || new RegExp(`(^|[^a-z\\p{L}])${k}([^a-z\\p{L}]|$)`, "iu").test(raw);
  const metro = Object.keys(METRO_AREA).sort((a, b) => b.length - a.length).find(inText);
  if (metro) return { city: METRO_AREA[metro], tier: 1 };
  const other = [...OTHER_BY_KEY.keys()].sort((a, b) => b.length - a.length).find(inText);
  if (other) return { city: OTHER_BY_KEY.get(other)!, tier: 2 };
  return null;
}

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
  if (!canonical) return lookupExtraCity(raw);
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
  ["micro", /(chemist|medical (?:store|shop|hall)|pharmacy|फार्मेसी|मेडिकल (?:स्टोर|स्टोअर|दुकान)|दवा की दुकान)/i],
  ["prof", /(clinic|doctor|dentist|hospital|diagnostic|\blab\b|\bca\b|chartered|accountant|lawyer|advocate|\blaw\b|coaching|tuition|classes|academy|school|institute|architect|insurance|real estate|travel|physio|consult|\bit\b|software|tech(?:nology)? (?:firm|company|services)|\bfirm\b|\boffice\b|agency|studio|क्लिनिक|डॉक्टर|वकील|कोचिंग|ऑफिस|ऑफ़िस)/i],
  ["micro", /(kirana|किराना|மளிகை|grocery|general store|provision|salon|saloon|parlou?r|beauty|barber|सैलून|सलून|पार्लर|சலூன்|సెలూన్|ಸಲೂನ್|સલૂન|সেলুন|ਸੈਲੂਨ|സലൂൺ|chemist|medical|pharmacy|फार्मेसी|मेडिकल|bakery|sweet|mithai|मिठाई|stationery|boutique|tailor|optician|hardware|repair|tea stall|dhaba|restaurant|cafe|\bhotel\b|\bshop\b|\bstore\b|dukaan|dukan|दुकान|स्टोर|retail)/i],
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


const TYPE_TAIL = /^(shop|store|stores|clinic|office|firm|company|centre|center|unit|chain|services|service|consultancy|consulting|agency|studio|parlou?r|salon|outlet|outlets|business|dukaan|dukan|दुकान|स्टोर|स्टोअर)$/i;

/** The business type as the customer wrote it ("kirana shop", "dental clinic"), when a message clearly says it. */
export function extractBusinessType(text: string): string | null {
  const t = (text ?? "").toLowerCase();
  const known = [...typeTable().keys()].sort((a, b) => b.length - a.length).find((k) => k.length > 3 && t.includes(k));
  if (known) return known;
  for (const [, re] of TYPE_KEYWORDS) {
    const m = t.match(re);
    if (!m) continue;
    // widen "it" -> "it consultancy office", "kirana" -> "kirana shop" (at most 3 words, letters only)
    const words = t.slice(m.index!).split(/[\s,.;!?।]+/).filter(Boolean);
    const out = [words[0]];
    for (const w of words.slice(1, 3)) { if (/^[\p{L}\p{M}]+$/u.test(w) && TYPE_TAIL.test(w)) out.push(w); else break; }
    return out.join(" ");
  }
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

/** Digits (also Devanagari ०-९) in a string -> number. */
const toNumber = (v: unknown): number | undefined => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim()) {
    const ascii = v.replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d)));
    if (/^\s*\d+\s*$/.test(ascii)) return Number(ascii);
  }
  return undefined;
};
const toBool = (v: unknown): boolean | undefined => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (/^(true|yes|y|haan|हाँ|हां)$/i.test(v.trim())) return true;
    if (/^(false|no|n|nahi|nahin|नहीं|नही)$/i.test(v.trim())) return false;
  }
  return undefined;
};
const internetFromText = (t: string): CurrentInternet | undefined => {
  const x = t.toLowerCase().replace(/[\s-]+/g, "_");
  if ((CURRENT_INTERNET as readonly string[]).includes(x)) return x as CurrentInternet;
  if (/hotspot|mobile/.test(x)) return "mobile_hotspot";
  if (/home/.test(x)) return "home_broadband";
  if (/leased/.test(x)) return "leased_line";
  if (/mixed/.test(x)) return "mixed";
  if (/broadband|fib(re|er)|wifi/.test(x)) return "business_broadband";
  if (/none|no_?internet|nothing/.test(x)) return "none";
  return undefined;
};

/** Check every field the LLM sends: normalise what we can, report the rest. Nulls count as "not provided". */
export function validateSlots(input: unknown): { fields: SlotFields; errors: string[] } {
  const errors: string[] = [];
  const f: SlotFields = {};
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const r = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== null && v !== undefined && v !== ""));

  if (r.business_type !== undefined) {
    if (typeof r.business_type === "string" && r.business_type.length <= 80) f.business_type = r.business_type.trim();
    else errors.push("business_type must be a short text");
  }
  if (r.segment !== undefined) {
    const seg = String(r.segment).toLowerCase().trim();
    if (["micro", "prof", "multi", "mfg"].includes(seg)) f.segment = seg as SegCode;
    else errors.push("segment must be one of micro, prof, multi, mfg");
  }
  const int = (name: string, lo: number, hi: number): number | undefined => {
    if (r[name] === undefined) return undefined;
    const v = toNumber(r[name]);
    if (v !== undefined && Number.isInteger(v) && v >= lo && v <= hi) return v;
    errors.push(`${name} must be a whole number from ${lo} to ${hi}`);
    return undefined;
  };
  const emp = int("employee_count", 1, 100000); if (emp !== undefined) f.employee_count = emp;
  const sites = int("num_sites", 1, 10000); if (sites !== undefined) f.num_sites = sites;
  const budget = int("budget_per_month", 100, 10_000_000); if (budget !== undefined) f.budget_per_month = budget;
  if (r.city !== undefined) {
    if (typeof r.city === "string" && r.city.length <= 60) f.city = r.city.trim();
    else errors.push("city must be a short text");
  }
  if (r.city_tier !== undefined) {
    const t = toNumber(r.city_tier);
    if (t === 1 || t === 2) f.city_tier = t;
    else errors.push("city_tier must be 1 (big metro) or 2 (smaller city)");
  }
  if (r.has_gstin !== undefined) {
    const b = toBool(r.has_gstin);
    if (b !== undefined) f.has_gstin = b;
    else errors.push("has_gstin must be true or false");
  }
  if (r.current_internet !== undefined) {
    const ci = internetFromText(String(r.current_internet));
    if (ci) f.current_internet = ci;
    else errors.push(`current_internet must be one of ${CURRENT_INTERNET.join(", ")}`);
  }
  if (r.wishes !== undefined) {
    const list = Array.isArray(r.wishes) ? r.wishes : typeof r.wishes === "string" ? [r.wishes] : null;
    if (!list) errors.push(`wishes must be a list of: ${WISH_KEYS.join(", ")}`);
    else {
      const ok: WishKey[] = [];
      for (const w of list) {
        const t = String(w).toLowerCase().trim().replace(/[\s-]+/g, "_");
        if ((WISH_KEYS as readonly string[]).includes(t)) ok.push(t as WishKey);
        else {
          const guess = extractWishes(String(w))[0]; // e.g. "whatsapp_catalogue" -> whatsapp
          if (guess) ok.push(guess);
          else errors.push(`unknown wish "${String(w).slice(0, 30)}". Use only: ${WISH_KEYS.join(", ")}`);
        }
      }
      f.wishes = [...new Set(ok)];
    }
  }
  if (r.language !== undefined) {
    const l = String(r.language).toLowerCase().trim();
    if ((LANGUAGES as readonly string[]).includes(l)) f.language = l as AdvisorLang;
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

// ---------------- Facts code can read from a message by itself ----------------
// The LLM normally saves details with update_profile. These patterns catch the common, unambiguous phrasings
// ("2 staff", "one shop", "no GST", "budget 1000") so a small or rate-limited model can't miss them.
const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  single: 1, ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, che: 6, saat: 7, aath: 8, nau: 9, das: 10,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, छः: 6, सात: 7, आठ: 8, नौ: 9, दस: 10, एकच: 1, दोन: 2,
};
const NUM = `(\\d+(?:\\s*(?:-|–|to|se|or|ya|या)\\s*\\d+)?|${Object.keys(NUM_WORDS).join("|")})`;
const PEOPLE = "(?:staff|people|persons?|employees?|workers?|members?|teachers?|doctors?|log|logon|lög|लोग|लोगों|लोक|कर्मचारी|आदमी|बंदे|पேர்|பேர்|ఉద్యోగులు|ജീവനക്കാർ|জন|ਲੋਕ|લોકો)";
const SITES = "(?:shops?|outlets?|branch(?:es)?|locations?|stores?|centres?|centers?|offices?|sites?|clinics?|factories|units?|dukaan(?:ein)?|dukan|दुकान(?:ें)?|दुकाने|शाखा(?:एं|ाएँ)?|आउटलेट|ठिकाने|கடை|ஷாப்)";

function wordOrNumber(raw: string): number | null {
  const w = NUM_WORDS[raw.toLowerCase()];
  if (w) return w;
  return parseCount(raw);
}

export interface MessageFacts { employee_count?: number; num_sites?: number; has_gstin?: boolean; budget_per_month?: number }

export function extractFacts(text: string): MessageFacts {
  const t = ` ${(text ?? "").replace(/\s+/g, " ")} `;
  const out: MessageFacts = {};
  const people = t.match(new RegExp(`(?:^|[^\\p{L}\\d])${NUM}\\s*\\+?\\s*${PEOPLE}(?=[^\\p{L}]|$)`, "iu"))
    ?? t.match(new RegExp(`team of\\s+${NUM}`, "i"));
  const negative = (m: RegExpMatchArray) => /(minus|negative|-)\s*$/i.test(t.slice(0, (m.index ?? 0) + m[0].indexOf(m[1])));
  if (people && !negative(people)) { const n = wordOrNumber(people[1]); if (n && n <= 100000) out.employee_count = n; }
  const sites = t.match(new RegExp(`(?:^|[^\\p{L}\\d])${NUM}\\s*${SITES}(?=[^\\p{L}]|$)`, "iu"));
  if (sites && !negative(sites)) { const n = wordOrNumber(sites[1]); if (n && n <= 1000) out.num_sites = n; }
  else if (/(only one|just one|single|ek hi|एक ही|एकच)\s+\p{L}*\s*(shop|outlet|branch|location|store|centre|center|office|clinic|dukaan|dukan|दुकान)/iu.test(t)) out.num_sites = 1;
  const noGst = /(\bno\b|without|don'?t have|do not have|not registered|\bnahi\b|\bnai\b|\bnahin\b|बिना)\s*(?:a\s+|any\s+)?(gst|जीएसटी)|(gst|जीएसटी)\s*(?:number\s*|नंबर\s*|no\.?\s*|registration\s*)?(nahi|nai|nahin|nhi|nahi hai|nahi h|नहीं|नही|नाही|இல்லை|లేదు|ಇಲ್ಲ|નથી|নেই|ਨਹੀਂ|ഇല്ല|\bno\b|:\s*no)/iu;
  const yesGst = /(have|got|with|registered|\byes\b|हाँ|हां)\s*(?:a\s+|the\s+)?(gst|जीएसटी)|(gst|जीएसटी)\s*(?:number\s*|नंबर\s*|no\.?\s*)?(registered|\byes\b|\bhai\b|\bh\b|है|आहे|உள்ளது|இருக்கு|ఉంది|ಇದೆ|છે|আছে|ਹੈ|ഉണ്ട്|:\s*yes)|gst[- ]registered/iu;
  if (noGst.test(t)) out.has_gstin = false;
  else if (yesGst.test(t)) out.has_gstin = true;
  const budget = t.match(/budget\D{0,20}?(\d[\d,]{2,})/i)
    ?? t.match(/(?:under|within|below|upto|up to|max(?:imum)?|tak)\s*(?:₹|rs\.?|inr|rupees)?\s*(\d[\d,]{2,})/i)
    ?? t.match(/(?:₹|rs\.?\s*)\s*(\d[\d,]{2,})\s*(?:a|per|\/|mahina|mahine|महीना|महीने)\s*(?:month|mahina|mahine|महीना|महीने)?/i);
  if (budget) { const n = Number(budget[1].replace(/,/g, "")); if (n >= 100 && n <= 10_000_000) out.budget_per_month = n; }
  return out;
}
