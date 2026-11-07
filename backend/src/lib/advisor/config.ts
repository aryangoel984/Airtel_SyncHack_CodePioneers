// All advisor settings in one place. Models and key come from backend/.env (never logged).

export const ADVISOR_CONFIG = {
  // Read lazily so values loaded by dotenv at startup are picked up.
  primaryModel: () => process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  fallbackModel: () => process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b",
  apiKey: () => process.env.GROQ_API_KEY || "",

  temperature: 0.3,
  maxCompletionTokens: 2048, // reasoning tokens also count, so keep some room
  timeoutMs: 20_000,
  reasoningEffort: "low" as const, // fast chat replies

  maxToolRounds: 5, // tool calls per user message
  maxMessageChars: 1000,
  maxHistoryMessages: 30,
  sessionTtlMs: 30 * 60 * 1000, // 30 minutes idle

  /** Beyond the SMB journey: a human expert should take over. */
  handoff: { maxSites: 12, maxEmployees: 150 },

  /** Per-IP limit on the chat endpoint (protects the key on a public demo). */
  rateLimit: { windowMs: 60_000, maxRequests: 20 },
};

export const LANGUAGES = ["en", "hi", "hinglish", "mr", "ta", "te", "kn", "gu", "bn", "pa", "ml"] as const;
export type AdvisorLang = (typeof LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<AdvisorLang, string> = {
  en: "English", hi: "Hindi (Devanagari script)", hinglish: "Hinglish (Hindi written in Latin letters)",
  mr: "Marathi", ta: "Tamil", te: "Telugu", kn: "Kannada", gu: "Gujarati", bn: "Bengali",
  pa: "Punjabi", ml: "Malayalam",
};

/** Phrases that mean "I want a person" or "I'm frustrated" (checked by code, not only the LLM). */
export const HUMAN_REQUEST_PATTERNS = [
  /\b(talk|speak|connect|call)\b.{0,25}\b(person|human|agent|executive|expert|representative|someone|sales)\b/i,
  /\b(real|actual)\s+(person|human)\b/i,
  /\bcall me\b/i,
  /(इंसान|व्यक्ति|एक्सपर्ट|एजेंट|एग्ज़ीक्यूटिव).{0,20}(बात|कॉल)/,
  /(बात|कॉल).{0,20}(इंसान|व्यक्ति|एक्सपर्ट|एजेंट|एग्ज़ीक्यूटिव|किसी से)/,
  /\b(insaan|aadmi|banda|executive|agent|expert)\b.{0,20}\b(baat|bat|call)\b/i,
  /\b(baat|bat)\b.{0,20}\b(kisi se|insaan|aadmi|executive|agent|expert)\b/i,
];

export const FRUSTRATION_PATTERNS = [
  /\b(useless|worst|stupid|waste of time|rubbish|nonsense|not helping|you are not helping|hate this)\b/i,
  /\b(bakwaas|bekar|bekaar|faltu|time barbaad)\b/i,
  /(बकवास|बेकार|फालतू)/,
];
