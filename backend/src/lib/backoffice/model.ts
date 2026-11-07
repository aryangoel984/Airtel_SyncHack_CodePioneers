// Step 6: "Who to call first" score.
// A small logistic regression trained on the 5,000 historic leads (smb_leads.csv): it learns which
// kinds of leads became paying customers. No ML library: plain gradient descent, trained once at startup.
// Honest evaluation: trained on 80% of leads, measured on the other 20% it has never seen.
import { loadLeads, Lead } from "../data";
import { segmentName } from "../rules";

/** Everything the score can use. Unknown fields are allowed: they count as "average". */
export interface LeadFeatures {
  segment?: string | null; // micro | prof | multi | mfg
  city_tier?: number | null;
  has_gst?: boolean | null;
  has_udyam?: boolean | null;
  employee_count?: number | null;
  num_sites?: number | null;
  source?: string | null; // Field sales | Website form | Channel partner | Inbound call | Referral | WhatsApp campaign
  provider?: string | null; // Accel | Accel (mobile only) | Competitor A | Competitor B | Local ISP | None
  internet?: string | null; // Mobile hotspot | Home broadband | Business broadband | Leased line | Mixed per site | None
  language?: string | null; // en | hi | ... (or "English", "Hindi", ...)
  owner_contact?: boolean | null; // talking to the owner?
  monthly_spend?: number | null;
  interests?: number | null; // how many products they asked about
}

const SEGMENTS = ["micro", "prof", "multi", "mfg"];
const SOURCES = ["Field sales", "Website form", "Channel partner", "Inbound call", "Referral", "WhatsApp campaign"];
const PROVIDERS = ["Accel", "Accel (mobile only)", "Competitor A", "Competitor B", "Local ISP"];
const INTERNET = ["Mobile hotspot", "Home broadband", "Business broadband", "Leased line", "Mixed per site"];

/** Plain-language name of every model input (shown on the dashboard). */
const LABELS: Record<string, string> = {
  gst: "Has a GST number", udyam: "Has Udyam registration", tier1: "In a big (tier-1) city",
  log_staff: "More staff", multi_site: "3 or more locations", hi_en: "Prefers Hindi or English",
  owner: "Talking to the owner", log_spend: "Higher current telecom spend", interests: "Asked about more products",
  ...Object.fromEntries(SEGMENTS.map((s) => [`seg_${s}`, `Segment: ${segmentLabel(s)}`])),
  ...Object.fromEntries(SOURCES.map((s) => [`src_${s}`, `Came via ${s.toLowerCase()}`])),
  ...Object.fromEntries(PROVIDERS.map((s) => [`prov_${s}`, `Current provider: ${s}`])),
  ...Object.fromEntries(INTERNET.map((s) => [`net_${s}`, `Today uses ${s.toLowerCase()}`])),
};
/** What to say when a yes/no input is "no", or a number is below average. */
const LOW_LABELS: Record<string, string> = {
  gst: "No GST number", udyam: "No Udyam registration", tier1: "In a smaller (tier-2) city",
  log_staff: "Fewer staff", multi_site: "Fewer than 3 locations", hi_en: "Prefers a regional language",
  owner: "Not talking to the owner", log_spend: "Lower current telecom spend", interests: "Asked about fewer products",
};
function segmentLabel(code: string) {
  return { micro: "micro retail", prof: "professional office", multi: "multi-site", mfg: "manufacturer" }[code] ?? code;
}

const NAMES = Object.keys(LABELS);

/** Lead -> list of numbers in NAMES order. null = unknown (filled with the training average). */
function encode(f: LeadFeatures): (number | null)[] {
  const oneHot = (prefix: string, values: string[], v: string | null | undefined) =>
    values.map((x) => (v == null ? null : v === x ? 1 : 0)).map((n, i) => [`${prefix}_${values[i]}`, n] as const);
  const lang = f.language == null ? null : ["en", "hi", "hinglish", "english", "hindi"].includes(f.language.toLowerCase()) ? 1 : 0;
  const map: Record<string, number | null> = {
    gst: f.has_gst == null ? null : f.has_gst ? 1 : 0,
    udyam: f.has_udyam == null ? null : f.has_udyam ? 1 : 0,
    tier1: f.city_tier == null ? null : f.city_tier === 1 ? 1 : 0,
    log_staff: f.employee_count == null ? null : Math.log1p(f.employee_count),
    multi_site: f.num_sites == null ? null : f.num_sites >= 3 ? 1 : 0,
    hi_en: lang,
    owner: f.owner_contact == null ? null : f.owner_contact ? 1 : 0,
    log_spend: f.monthly_spend == null ? null : Math.log1p(f.monthly_spend),
    interests: f.interests ?? null,
    ...Object.fromEntries(oneHot("seg", SEGMENTS, f.segment)),
    ...Object.fromEntries(oneHot("src", SOURCES, f.source)),
    ...Object.fromEntries(oneHot("prov", PROVIDERS, f.provider)),
    ...Object.fromEntries(oneHot("net", INTERNET, f.internet)),
  };
  return NAMES.map((n) => map[n] ?? null);
}

/** Historic lead -> features (everything is known). */
export function featuresFromLead(l: Lead): LeadFeatures {
  return {
    segment: segmentCode(l.segment), city_tier: l.city_tier, has_gst: l.has_gstin, has_udyam: l.has_udyam,
    employee_count: l.employee_count, num_sites: l.num_sites, source: l.lead_source, provider: l.current_provider,
    internet: l.current_internet, language: l.preferred_language, owner_contact: l.contact_role === "Owner",
    monthly_spend: l.monthly_telecom_spend_inr, interests: l.products_of_interest.length,
  };
}
function segmentCode(name: string): string | null {
  return SEGMENTS.find((c) => segmentName(c) === name) ?? null;
}

// ---------------- training ----------------
export interface ModelReport {
  trainedOn: number;
  testedOn: number;
  auc: number; // 0.5 = coin toss, 1 = perfect
  baseRate: number; // share of test leads that activated
  top20Rate: number; // activation rate among the 20% highest-scored test leads
  lift: number; // top20Rate / baseRate
  deciles: { decile: number; rate: number; avgScore: number }[]; // 1 = highest scores
  thresholds: { high: number; medium: number }; // score cut-offs for High / Medium
  factors: { name: string; label: string; weight: number }[]; // sorted by strength
}

interface Model { w: number[]; b: number; mean: number[]; std: number[]; report: ModelReport }
let cached: Model | null = null;

/** Small seeded random generator so the train/test split is the same every run. */
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function auc(scores: number[], labels: number[]): number {
  const idx = scores.map((s, i) => i).sort((a, b) => scores[a] - scores[b]);
  let rankSum = 0, pos = 0;
  idx.forEach((i, r) => { if (labels[i]) { rankSum += r + 1; pos++; } });
  const neg = labels.length - pos;
  return pos && neg ? (rankSum - (pos * (pos + 1)) / 2) / (pos * neg) : 0.5;
}

export function trainModel(): Model {
  if (cached) return cached;
  const leads = loadLeads();
  const X = leads.map((l) => encode(featuresFromLead(l)).map((v) => v ?? 0));
  const y: number[] = leads.map((l) => (l.outcome === "Activated" ? 1 : 0));

  // 80 / 20 split, same every time
  const r = rng(7);
  const order = leads.map((_, i) => i).sort(() => r() - 0.5);
  const cut = Math.floor(order.length * 0.8);
  const tr = order.slice(0, cut), te = order.slice(cut);

  // standardise each input using the training rows
  const d = NAMES.length;
  const mean = Array(d).fill(0), std = Array(d).fill(0);
  for (const i of tr) X[i].forEach((v, j) => { mean[j] += v / tr.length; });
  for (const i of tr) X[i].forEach((v, j) => { std[j] += (v - mean[j]) ** 2 / tr.length; });
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j]) || 1;
  const Z = X.map((row) => row.map((v, j) => (v - mean[j]) / std[j]));

  // gradient descent with a little L2 regularisation
  const w = Array(d).fill(0);
  let b = 0;
  const lr = 0.3, l2 = 0.01, epochs = 400;
  for (let e = 0; e < epochs; e++) {
    const gw = Array(d).fill(0);
    let gb = 0;
    for (const i of tr) {
      const p = sigmoid(Z[i].reduce((s, v, j) => s + v * w[j], b));
      const err = p - y[i];
      for (let j = 0; j < d; j++) gw[j] += err * Z[i][j];
      gb += err;
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / tr.length + l2 * w[j]);
    b -= lr * (gb / tr.length);
  }

  // evaluate on the 20% the model never saw
  const ps = te.map((i) => sigmoid(Z[i].reduce((s, v, j) => s + v * w[j], b)));
  const ys: number[] = te.map((i) => y[i]);
  const ranked = ps.map((p, k) => [p, ys[k]] as const).sort((a, b2) => b2[0] - a[0]);
  const baseRate = ys.reduce((a, c) => a + c, 0) / ys.length;
  const top = ranked.slice(0, Math.round(ranked.length * 0.2));
  const top20Rate = top.reduce((a, c) => a + c[1], 0) / top.length;
  const per = Math.ceil(ranked.length / 10);
  const deciles = Array.from({ length: 10 }, (_, k) => {
    const part = ranked.slice(k * per, (k + 1) * per);
    return { decile: k + 1, rate: part.reduce((a, c) => a + c[1], 0) / part.length, avgScore: part.reduce((a, c) => a + c[0], 0) / part.length };
  });
  const thresholds = { high: ranked[Math.round(ranked.length * 0.2) - 1][0], medium: ranked[Math.round(ranked.length * 0.5) - 1][0] };

  const factors = NAMES.map((n, j) => ({ name: n, label: LABELS[n], weight: Math.round(w[j] * 100) / 100 }))
    .filter((f) => Math.abs(f.weight) >= 0.05)
    .sort((a, b2) => Math.abs(b2.weight) - Math.abs(a.weight));

  cached = {
    w, b, mean, std,
    report: {
      trainedOn: tr.length, testedOn: te.length, auc: Math.round(auc(ps, ys) * 1000) / 1000,
      baseRate, top20Rate, lift: Math.round((top20Rate / baseRate) * 100) / 100, deciles, thresholds, factors,
    },
  };
  console.log(`[score] lead model trained: AUC ${cached.report.auc}, top-20% lift ${cached.report.lift}x`);
  return cached;
}

export interface Score {
  probability: number; // chance this lead becomes a customer (0-1)
  band: "High" | "Medium" | "Low";
  reasons: { label: string; effect: "up" | "down" }[]; // the 3 biggest pushes for THIS lead
}

/** Score one lead. Unknown inputs use the training average, so they neither help nor hurt. */
export function scoreLead(f: LeadFeatures): Score {
  const m = trainModel();
  const raw = encode(f);
  const z = raw.map((v, j) => (v == null ? 0 : (v - m.mean[j]) / m.std[j]));
  const contrib = z.map((v, j) => ({ j, c: v * m.w[j], known: raw[j] != null }));
  const p = sigmoid(contrib.reduce((s, x) => s + x.c, m.b));
  const reasons = contrib
    .filter((x) => x.known && Math.abs(x.c) > 0.05 && (raw[x.j] !== 0 || !NAMES[x.j].includes("_"))) // skip "is NOT segment X" style reasons
    .sort((a, b) => Math.abs(b.c) - Math.abs(a.c))
    .slice(0, 3)
    .map((x) => ({
      label: z[x.j] < 0 && LOW_LABELS[NAMES[x.j]] ? LOW_LABELS[NAMES[x.j]] : LABELS[NAMES[x.j]],
      effect: x.c > 0 ? ("up" as const) : ("down" as const),
    }));
  const band = p >= m.report.thresholds.high ? "High" : p >= m.report.thresholds.medium ? "Medium" : "Low";
  return { probability: Math.round(p * 1000) / 1000, band, reasons };
}

export const modelReport = () => trainModel().report;
