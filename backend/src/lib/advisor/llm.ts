// Groq wrapper: model check at startup, timeout, fallback model. The key is read from the environment and never logged.
// Only message.content and tool_calls are ever used. The model's reasoning is switched off in the request and never read.
import Groq from "groq-sdk";
import { ADVISOR_CONFIG } from "./config";

export interface ToolCall { id: string; type: "function"; function: { name: string; arguments: string } }
export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
export interface LlmReply { content: string | null; toolCalls: ToolCall[]; totalTokens?: number }

/** Anything that can answer a chat (the real Groq client, or a fake one in tests). */
export interface LlmClient {
  complete(model: string, messages: LlmMessage[], tools: unknown[], toolChoice?: "auto" | "required"): Promise<LlmReply>;
  listModels(): Promise<string[]>;
}

export class LlmUnavailableError extends Error {}

/** Short, safe description of an API error for logs (status + first part of the message; never headers or keys). */
function describeError(e: unknown): string {
  const err = e as { status?: number; message?: string; name?: string };
  return `${err.status ?? err.name ?? "error"}: ${(err.message ?? "").replace(/\s+/g, " ").slice(0, 200)}`;
}

// ---------- the real client ----------
export class GroqClient implements LlmClient {
  private sdk: Groq;
  private effortAndHide = true; // some models may reject reasoning_effort + include_reasoning together

  constructor(apiKey: string) {
    this.sdk = new Groq({ apiKey, timeout: ADVISOR_CONFIG.timeoutMs, maxRetries: 0 });
  }

  async listModels(): Promise<string[]> {
    const res = await this.sdk.models.list();
    return res.data.map((m) => m.id);
  }

  async complete(model: string, messages: LlmMessage[], tools: unknown[], toolChoice: "auto" | "required" = "auto"): Promise<LlmReply> {
    const base = {
      model, messages, tools, tool_choice: toolChoice,
      temperature: ADVISOR_CONFIG.temperature,
      max_completion_tokens: ADVISOR_CONFIG.maxCompletionTokens,
      include_reasoning: false, // documented switch: reasoning is not returned
    };
    const body = this.effortAndHide ? { ...base, reasoning_effort: ADVISOR_CONFIG.reasoningEffort } : base;
    let res;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res = await this.sdk.chat.completions.create(body as any, { timeout: ADVISOR_CONFIG.timeoutMs, maxRetries: 0 });
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (this.effortAndHide && err.status === 400 && /reasoning/i.test(err.message ?? "")) {
        this.effortAndHide = false; // fall back to just hiding reasoning, then retry once
        console.warn("[advisor] reasoning_effort + include_reasoning rejected; using include_reasoning=false only");
        return this.complete(model, messages, tools, toolChoice);
      }
      throw e;
    }
    const full = res as { choices: { message: { content?: string | null; tool_calls?: ToolCall[] } }[]; usage?: { total_tokens?: number } };
    const msg = full.choices[0].message;
    return { totalTokens: full.usage?.total_tokens, content: msg.content ?? null, toolCalls: (msg.tool_calls ?? []).map((t) => ({ id: t.id, type: "function", function: { name: t.function.name, arguments: t.function.arguments } })) };
  }
}

// ---------- shared state ----------
let client: LlmClient | null = null;
let models = { primary: "", fallback: "" };

/** Tests (and the eval script) can plug in their own client. */
export function setLlmClient(c: LlmClient | null) { client = c; models = { primary: "", fallback: "" }; }

function getClient(): LlmClient {
  if (client) return client;
  const key = ADVISOR_CONFIG.apiKey();
  if (!key) throw new LlmUnavailableError("no GROQ_API_KEY configured");
  client = new GroqClient(key);
  return client;
}

export function activeModels() {
  return {
    primary: models.primary || ADVISOR_CONFIG.primaryModel(),
    fallback: models.fallback || ADVISOR_CONFIG.fallbackModel(),
  };
}

/** Call once at startup: confirm both models exist on Groq. Logs model names only, never the key. */
export async function initModels(): Promise<void> {
  const wantPrimary = ADVISOR_CONFIG.primaryModel();
  const wantFallback = ADVISOR_CONFIG.fallbackModel();
  try {
    const available = await getClient().listModels();
    const hasP = available.includes(wantPrimary);
    const hasF = available.includes(wantFallback);
    models = {
      primary: hasP ? wantPrimary : hasF ? wantFallback : wantPrimary,
      fallback: hasF ? wantFallback : hasP ? wantPrimary : wantFallback, // no fallback model? retry the primary instead
    };
    console.log(`[advisor] Groq models: primary=${models.primary} (${hasP ? "available" : "NOT listed"}), fallback=${models.fallback} (${hasF ? "available" : "NOT listed"})`);
  } catch (e) {
    models = { primary: wantPrimary, fallback: wantFallback };
    console.warn(`[advisor] could not check Groq models (${(e as Error).message}). The advisor will use guided mode if Groq is unreachable.`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Groq says "Please try again in 3.5s" (or 1m2s) in its 429 message. Returns milliseconds, or null if it's not a rate limit. */
export function retryAfterMs(e: unknown): number | null {
  const err = e as { status?: number; message?: string };
  if (err.status !== 429) return null;
  const m = (err.message ?? "").match(/try again in (?:(\d+)m)?\s*([\d.]+)s/i);
  if (!m) return 5000;
  return Math.ceil(((Number(m[1] ?? 0) * 60) + Number(m[2])) * 1000) + 300;
}

/**
 * Primary model first; on any error, timeout or 429, one retry on the fallback model.
 * If BOTH are rate-limited and Groq says the limit clears soon, wait that long and try the primary once more.
 * Only then does the caller switch to guided mode.
 */
export async function completeWithFallback(
  messages: LlmMessage[], tools: unknown[], toolChoice: "auto" | "required" = "auto",
): Promise<LlmReply & { model: string }> {
  const { primary, fallback } = activeModels();
  const c = getClient(); // throws LlmUnavailableError when there is no key
  let e1: unknown, e2: unknown;
  try {
    return { ...(await c.complete(primary, messages, tools, toolChoice)), model: primary };
  } catch (e) { e1 = e; }
  console.warn(`[advisor] ${primary} failed (${describeError(e1)}); trying ${fallback}`);
  try {
    return { ...(await c.complete(fallback, messages, tools, toolChoice)), model: fallback };
  } catch (e) { e2 = e; }
  console.warn(`[advisor] ${fallback} failed (${describeError(e2)})`);

  const waits = [retryAfterMs(e1), retryAfterMs(e2)].filter((w): w is number => w !== null);
  if (waits.length === 2) {
    const wait = Math.min(...waits);
    if (wait <= ADVISOR_CONFIG.rateLimitPatienceMs) {
      console.warn(`[advisor] both models rate-limited; waiting ${Math.round(wait / 1000)}s then retrying ${primary}`);
      await sleep(wait);
      try {
        return { ...(await c.complete(primary, messages, tools, toolChoice)), model: primary };
      } catch (e) {
        console.warn(`[advisor] ${primary} failed again (${describeError(e)}); switching to guided mode`);
      }
    }
  }
  throw new LlmUnavailableError("both models failed");
}
