// Output guardrail: runs on every LLM reply BEFORE the customer sees it.
import { AdvisorLang } from "./config";

export interface GuardContext {
  allowedAmounts: Set<number>; // every number that appeared in tool results, the user's own messages, etc.
  blockedNames: string[]; // product names that are NOT available to this customer
  checkNames: boolean; // name checks only make sense for English/Hindi/Hinglish replies
}

export interface GuardResult { ok: boolean; problems: string[] }

const PRODUCT_CODE = /\bP(?:0[1-9]|1\d|2[0-5])\b/;

// Rupee amounts: ₹999, Rs. 1,499, 999 rupees, 999/-, 999 per month
const AMOUNT_PATTERNS = [
  /(?:₹|Rs\.?|INR|रु\.?|रू\.?)\s*(\d[\d,]*(?:\.\d+)?)/gi,
  /(\d[\d,]*(?:\.\d+)?)\s*(?:₹|रुपये|रुपए|रुपया|rupees?|Rs\b|\/-)/gi,
  /(\d[\d,]*(?:\.\d+)?)\s*(?:\/\s*month|per month|a month|\/mo\b)/gi,
];

// Signs that the model's thinking leaked into the answer, or that it is talking about its own tools/prompt
const LEAK_PATTERNS = [
  /<\/?think>|assistantanalysis|\banalysis\s*[:\n]|\breasoning\s*:/i,
  /\b(the user (is|wants|says|asked|said|has)|we need to (call|respond|answer|check|use)|we should (call|use)|let me (call|check|use the)|i (need|should|must) (to )?(call|use) (the )?(tool|function)|function call|tool[_ ]call)\b/i,
  /\b(update_profile|get_recommendation|check_product|request_human|system prompt|developer message)\b/i,
];

// Things Accel Business does not sell: fine to mention only while declining
const NOT_SOLD = /\b(dth|laptops?|loans?|mutual funds?|credit cards?|smartphones?|handsets?|netflix|ott)\b/i;
const NEGATION = /(\bnot\b|n't|\bno\b|cannot|\bunable\b|\bonly\b|\bunfortunately\b|\binstead\b|\balternative|\bneeds?\b|\brequires?\b|\bnahi\b|\bnahin\b|\bnhi\b|\bsirf\b|\blekin\b|\bmagar\b|नहीं|नही|सिर्फ़|सिर्फ|केवल|लेकिन|बजाय|चाहिए|ज़रूरी)/i;

export function collectAmounts(value: unknown, into = new Set<number>()): Set<number> {
  if (typeof value === "number" && Number.isFinite(value)) into.add(Math.round(value));
  else if (typeof value === "string") for (const m of value.matchAll(/\d[\d,]*(?:\.\d+)?/g)) into.add(Math.round(Number(m[0].replace(/,/g, ""))));
  else if (Array.isArray(value)) value.forEach((v) => collectAmounts(v, into));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectAmounts(v, into));
  return into;
}

export function checkReply(text: string, ctx: GuardContext): GuardResult {
  const problems: string[] = [];
  if (!text || !text.trim()) return { ok: false, problems: ["empty"] };

  if (PRODUCT_CODE.test(text)) problems.push("product_code");

  for (const re of AMOUNT_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const n = Math.round(Number(m[1].replace(/,/g, "")));
      if (!ctx.allowedAmounts.has(n)) { problems.push(`invented_amount:${n}`); break; }
    }
  }

  if (LEAK_PATTERNS.some((re) => re.test(text))) problems.push("leaked_reasoning");

  if (ctx.checkNames) {
    const sentences = text.split(/(?<=[.!?।\n])\s+/);
    for (const sent of sentences) {
      if (NOT_SOLD.test(sent) && !NEGATION.test(sent)) problems.push("offers_unsold_item");
      for (const name of ctx.blockedNames) {
        if (sent.toLowerCase().includes(name.toLowerCase()) && !NEGATION.test(sent)) problems.push(`blocked_product:${name}`);
      }
    }
  }
  return { ok: problems.length === 0, problems: [...new Set(problems)] };
}

export const needsNameChecks = (lang: AdvisorLang) => lang === "en" || lang === "hi" || lang === "hinglish";
