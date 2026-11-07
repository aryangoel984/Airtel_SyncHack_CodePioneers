// Guided mode: NO AI. Fixed questions with button choices, same tools and same recommendation code.
// Used automatically when Groq is unavailable, so the demo never breaks because of the LLM.
import { Session, setOutcome } from "./session";
import { applyFields } from "./tools";
import { buildRecommendation } from "./recommend";
import { extractWishes, lookupCity, mapBusinessType, parseCount, parseTierWords, SlotFields } from "./mapping";
import { NextStep, nextStep, notice, NOTICES, questionFor, recommendationReply } from "./templates";

const NO = /\b(no|nahi|nahin|nope|don'?t|dont|do not)\b|नहीं|नही/i;
const YES = /\b(yes|yeah|yep|haan|han|ha)\b|हाँ|हां|\bहै\b/i;
const NOTHING = /(nothing|none|no thanks|kuch nahi|kuch khas nahi|show me a plan|कुछ खास नहीं|कुछ नहीं|सिर्फ़? प्लान|skip)/i;
const JUST_ME = /(just me|only me|akela|akeli|सिर्फ़? मैं|अकेला|अकेली)/i;

/** Read the customer's answer for the question we asked (`step`). */
function parseAnswer(step: NextStep, text: string): SlotFields & { wishesDone?: boolean } {
  const out: SlotFields & { wishesDone?: boolean } = {};
  switch (step) {
    case "business_type":
      if (mapBusinessType(text)) out.business_type = text.slice(0, 80);
      break;
    case "employee_count": {
      const n = JUST_ME.test(text) ? 1 : parseCount(text);
      if (n) out.employee_count = n;
      break;
    }
    case "num_sites": {
      const n = parseCount(text);
      if (n) out.num_sites = n;
      break;
    }
    case "city": {
      const hit = lookupCity(text);
      const tier = parseTierWords(text);
      if (hit) out.city = hit.city;
      else if (tier) out.city_tier = tier;
      else if (/^[\p{L}\s.'-]{2,40}$/u.test(text.trim())) out.city = text.trim(); // unknown city: we will ask big or small next
      break;
    }
    case "tier": {
      const tier = parseTierWords(text);
      if (tier) out.city_tier = tier;
      break;
    }
    case "gst":
    case "gst_recheck":
      if (NO.test(text)) out.has_gstin = false;
      else if (YES.test(text)) out.has_gstin = true;
      break;
    case "wishes":
      out.wishesDone = true;
      if (NOTHING.test(text)) out.wishes = [];
      break;
    default:
      break;
  }
  // wishes and a budget can be mentioned at any point
  const wishes = extractWishes(text);
  if (wishes.length) out.wishes = wishes;
  const budget = text.match(/budget[^\d]{0,20}(\d[\d,]*)|(\d[\d,]*)\s*(?:rupees?|₹|rs)\s*(?:budget|tak|max)/i);
  const b = budget && Number((budget[1] ?? budget[2]).replace(/,/g, ""));
  if (b && b >= 100) out.budget_per_month = b;
  return out;
}

/** `askedStep` = the question the customer is answering (computed before any automatic saving). */
export function guidedTurn(s: Session, text: string, justSwitched: boolean, askedStep?: NextStep): string {
  const lang = s.profile.language;
  const step = askedStep ?? nextStep(s);
  const prefix = justSwitched ? notice(NOTICES.guidedMode, lang) + " " : "";

  if (step === "done" && s.recommendation) return prefix + notice(NOTICES.planAgain, lang);

  const parsed = parseAnswer(step, text);
  const { wishesDone, ...fields } = parsed;
  if (wishesDone) s.guided.wishesAsked = true;
  const before = JSON.stringify([s.profile.business_type, s.profile.employee_count, s.profile.num_sites, s.profile.city, s.profile.city_tier, s.profile.has_gstin]);
  applyFields(s, fields);
  const after = JSON.stringify([s.profile.business_type, s.profile.employee_count, s.profile.num_sites, s.profile.city, s.profile.city_tier, s.profile.has_gstin]);

  const next = nextStep(s);
  if (next === "done") {
    const rec = buildRecommendation(s.profile, { wishes: s.profile.wishes, budget: s.profile.budget_per_month }, ++s.recommendationCount);
    s.recommendation = rec;
    setOutcome(s, "recommended");
    return prefix + recommendationReply(rec, lang);
  }
  // Same question again if we could not read the answer (nothing changed and it wasn't a wishes step)
  const again = before === after && next === step && step !== "wishes" && !(step === "city" && s.profile.city_tier !== undefined);
  const q = questionFor(next, lang);
  return prefix + (again ? (lang === "hi" ? "माफ़ कीजिए, मैं समझ नहीं पाया। " : "Sorry, I didn't catch that. ") : "") + q;
}
