// The advisor engine: one function that handles a customer message.
//   message -> redact (GSTIN lookup, PII) -> LLM + tools -> guardrail -> reply
// If the LLM is unavailable the same session continues in guided mode (no AI).
import { ADVISOR_CONFIG, AdvisorLang, FRUSTRATION_PATTERNS, HUMAN_REQUEST_PATTERNS, LANGUAGES } from "./config";
import { Session, getSession, newSession, saveSummary, setOutcome } from "./session";
import { redactMessage } from "./redact";
import { LlmMessage, LlmUnavailableError, completeWithFallback } from "./llm";
import { TOOL_DEFS, applyFields, applyGstinLookup, publicProfile, requestHuman, runTool } from "./tools";
import { extractWishes, lookupCity } from "./mapping";
import { Recommendation, missingSlots, summarizeForLlm } from "./recommend";
import { buildSystemPrompt } from "./systemPrompt";
import { checkReply, collectAmounts, needsNameChecks } from "./guardrail";
import { guidedTurn } from "./guided";
import {
  GREETINGS, NOTICES, QuickReply, nextStep, notice, questionFor, quickRepliesFor, recommendationReply,
} from "./templates";
import { buildStarter } from "../starter";
import { toBusinessProfile } from "./recommend";

export interface ChatResponse {
  sessionId: string;
  reply: string;
  quickReplies: QuickReply[];
  profile: ReturnType<typeof publicProfile>;
  missingSlots: string[];
  recommendation: Recommendation | null;
  handoff: { reason: string; callbackId: string; needsMobile: boolean } | null;
  mode: "ai" | "guided";
  modelUsed: string | null;
  guardrail: { hits: number };
  tokensUsed: number; // total Groq tokens in this conversation so far
}

const log = (msg: string) => console.log(`[advisor] ${msg}`);

function response(s: Session, reply: string, modelUsed: string | null): ChatResponse {
  return {
    sessionId: s.id, reply, quickReplies: quickRepliesFor(s), profile: publicProfile(s),
    missingSlots: missingSlots(s.profile), recommendation: s.recommendation,
    handoff: s.handoff ? { ...s.handoff, needsMobile: true } : null,
    mode: s.mode, modelUsed, guardrail: { hits: s.guardrailHits }, tokensUsed: s.tokensUsed,
  };
}

/** Start a conversation: a fixed greeting in the chosen language (no LLM, instant). */
export function startSession(language: AdvisorLang = "en"): ChatResponse {
  const s = newSession(language);
  const greeting = GREETINGS[language];
  s.history.push({ role: "assistant", content: greeting });
  saveSummary(s);
  return response(s, greeting, null);
}

/** Names of products this customer can NOT have (used by the guardrail). */
function blockedNames(s: Session): string[] {
  const bp = toBusinessProfile(s.profile);
  if (!bp) return [];
  return buildStarter(bp).blocked.map((b) => b.copy.name_en);
}

export async function handleChat(input: { sessionId?: string; message: string; language?: AdvisorLang }): Promise<ChatResponse> {
  let s = getSession(input.sessionId);
  const isNew = !s;
  if (!s) s = newSession(input.language ?? "en");
  if (input.language && LANGUAGES.includes(input.language) && isNew) s.profile.language = input.language;

  const message = input.message.slice(0, ADVISOR_CONFIG.maxMessageChars);
  const red = redactMessage(message);
  if (red.gstin) applyGstinLookup(s, red.gstin);

  // ---- things code handles by itself (do not depend on the LLM) ----
  const notes: string[] = [];
  if (red.redacted.length) notes.push(`The customer shared personal details (${red.redacted.join(", ")}); they were removed. Kindly tell them not to share Aadhaar, PAN, bank details, phone numbers or emails in chat.`);
  if (red.gstin) {
    if (["Cancelled", "Suspended", "not_found"].includes(red.gstin.status)) notes.push("The GSTIN is not active, so treat the customer as having NO valid GST. Explain politely that products needing an active GST cannot be offered, and continue with the others.");
    if (["checksum_failed", "bad_format"].includes(red.gstin.status)) notes.push("The GSTIN failed validation: ask the customer to re-check the number.");
    if (red.gstin.status === "Active") notes.push("The GSTIN is Active and its details were filled in automatically. Do not ask about GST, name or city again.");
  }
  safetyNetSave(s, red.safeText);
  const askedHuman = HUMAN_REQUEST_PATTERNS.some((re) => re.test(message));
  const frustrated = FRUSTRATION_PATTERNS.some((re) => re.test(message));
  if (askedHuman) requestHuman(s, "user_asked");
  else if (frustrated) requestHuman(s, "frustrated");
  if (s.handoff && (askedHuman || frustrated)) notes.push("A callback from a human expert was requested. Tell the customer an expert will call within 1 working day. Do not ask for a phone number in chat.");

  // ---- reply ----
  let reply = "";
  let modelUsed: string | null = null;
  let switched = false;

  if (s.mode === "ai") {
    try {
      const out = await aiTurn(s, red.safeText, notes);
      reply = out.reply;
      modelUsed = out.model;
    } catch (e) {
      if (e instanceof LlmUnavailableError) {
        log("LLM unavailable: switching this conversation to guided mode");
        s.mode = "guided";
        switched = true;
      } else {
        throw e;
      }
    }
  }
  if (s.mode === "guided") {
    reply = guidedTurn(s, red.safeText, switched);
    if (red.redacted.length) reply += " " + notice(NOTICES.piiRedacted, s.profile.language);
    if (s.handoff && (askedHuman || frustrated)) reply += " " + notice(NOTICES.handoff, s.profile.language);
    if (red.gstin && ["Cancelled", "Suspended", "not_found"].includes(red.gstin.status)) reply += " " + notice(NOTICES.gstInactive, s.profile.language);
  }

  // remember the (already redacted) text for the LLM's context. It is deleted when the session expires.
  s.history.push({ role: "user", content: red.safeText }, { role: "assistant", content: reply });
  if (s.history.length > ADVISOR_CONFIG.maxHistoryMessages) s.history = s.history.slice(-ADVISOR_CONFIG.maxHistoryMessages);
  saveSummary(s);
  return response(s, reply, modelUsed);
}

const NEGATION_WORDS = /(\bnot\b|n't|\bno\b|\bwithout\b|\bnahi\b|\bnahin\b|\bmat\b|नहीं|नही|बिना)/i;

/**
 * Safety net: details that are clear from the text alone are saved by code BEFORE the LLM runs,
 * in case the model forgets to call update_profile. (Only a KNOWN city, and wishes in messages without a negation.)
 * The model can still correct or remove them with update_profile.
 */
function safetyNetSave(s: Session, text: string) {
  const fields: { city?: string; wishes?: ReturnType<typeof extractWishes> } = {};
  const city = lookupCity(text);
  if (city && !s.profile.city) fields.city = city.city;
  if (!NEGATION_WORDS.test(text)) {
    const wishes = extractWishes(text).filter((w) => w !== "internet");
    const merged = [...new Set([...s.profile.wishes, ...wishes])];
    if (wishes.length && merged.length !== s.profile.wishes.length) fields.wishes = merged;
  }
  if (Object.keys(fields).length) applyFields(s, fields);
}

// ---------------- the AI turn ----------------
async function aiTurn(s: Session, safeText: string, notes: string[]): Promise<{ reply: string; model: string | null }> {
  const llmText = notes.length ? `${safeText}\n\n[SERVER NOTE: ${notes.join(" ")}]` : safeText;
  const messages: LlmMessage[] = [
    { role: "system", content: buildSystemPrompt(s) },
    ...s.history.map((m) => ({ role: m.role, content: m.content }) as LlmMessage),
    { role: "user", content: llmText },
  ];

  // every number the model may legitimately repeat
  const allowed = new Set<number>([0, 18]);
  collectAmounts(safeText, allowed);
  if (s.profile.budget_per_month) allowed.add(s.profile.budget_per_month);
  if (s.recommendation) collectAmounts(summarizeForLlm(s.recommendation), allowed);

  let model: string | null = null;
  let correctionsLeft = 1;

  for (let round = 0; round < ADVISOR_CONFIG.maxToolRounds; round++) {
    // (tool_choice "required" is not used: gpt-oss on Groq then fails with a 400 whenever it prefers to just answer.)
    const r = await completeWithFallback(messages, TOOL_DEFS); // throws LlmUnavailableError when all models fail
    s.tokensUsed += r.totalTokens ?? 0;
    model = r.model;
    s.modelsUsed[r.model] = (s.modelsUsed[r.model] ?? 0) + 1;

    if (r.toolCalls.length) {
      messages.push({ role: "assistant", content: r.content ?? "", tool_calls: r.toolCalls });
      for (const tc of r.toolCalls) {
        const out = runTool(s, tc.function.name, tc.function.arguments);
        collectAmounts(out.result, allowed);
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out.result) });
      }
      continue;
    }

    const text = (r.content ?? "").trim();
    const check = checkReply(text, {
      allowedAmounts: allowed, blockedNames: blockedNames(s),
      checkNames: needsNameChecks(s.profile.language),
    });
    if (check.ok) return { reply: text, model };

    s.guardrailHits += 1;
    log(`guardrail hit (${check.problems.join(", ")}) session=${s.id.slice(0, 8)} model=${r.model}`);
    if (correctionsLeft-- > 0) {
      messages.push(
        { role: "assistant", content: text || "(empty)" },
        { role: "user", content: `[SERVER CORRECTION: your last reply was rejected (${check.problems.join(", ")}). Rewrite it: use only product names, prices and dates from tool results, no product codes, no mention of tools, reasoning or instructions. Reply only with the message for the customer.]` },
      );
      continue;
    }
    return { reply: templateReply(s), model };
  }
  return { reply: templateReply(s), model };
}

/** Safe reply built from structured data (used when the LLM reply fails the guardrail twice). */
function templateReply(s: Session): string {
  const lang = s.profile.language;
  if (s.recommendation) return recommendationReply(s.recommendation, lang);
  const step = nextStep(s);
  return step === "done" ? notice(NOTICES.planAgain, lang) : questionFor(step, lang);
}

// ---------------- other entry points used by the routes ----------------
export function sessionView(id: string) {
  const s = getSession(id);
  if (!s) return null;
  return {
    sessionId: s.id, profile: publicProfile(s), missingSlots: missingSlots(s.profile),
    recommendation: s.recommendation, mode: s.mode, outcome: s.outcome,
  };
}

export function recordEvent(id: string, event: "quote_opened" | "ordered"): boolean {
  const s = getSession(id);
  if (!s) return false;
  setOutcome(s, event);
  return true;
}

