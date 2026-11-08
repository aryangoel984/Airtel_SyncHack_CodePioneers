// Conversation state, kept in memory per sessionId. Expires after 30 minutes idle.
// Only a MASKED summary is saved to disk. Raw chat text is deleted when the session ends.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ADVISOR_CONFIG, AdvisorLang } from "./config";
import { GstinResult } from "./redact";
import { CurrentInternet, WishKey } from "./mapping";
import type { Recommendation } from "./recommend";

export type Outcome = "in_progress" | "recommended" | "quote_opened" | "ordered" | "dropped" | "handoff";

export interface AdvisorProfile {
  business_type?: string;
  segment_from_type?: "micro" | "prof" | "multi" | "mfg";
  segment_hint?: "micro" | "prof" | "multi" | "mfg";
  employee_count?: number;
  num_sites?: number;
  city?: string;
  city_tier?: 1 | 2;
  has_gstin?: boolean;
  gstin?: GstinResult;
  business_name?: string;
  state?: string;
  current_internet?: CurrentInternet;
  wishes: WishKey[];
  budget_per_month?: number;
  language: AdvisorLang;
}

/** Chat messages kept for the LLM. They contain only already-redacted text. */
export interface HistoryMessage { role: "user" | "assistant"; content: string }

export interface Session {
  id: string;
  createdAt: number;
  lastActive: number;
  profile: AdvisorProfile;
  history: HistoryMessage[];
  mode: "ai" | "guided";
  guided: { wishesAsked: boolean };
  recommendation: Recommendation | null;
  recommendationCount: number;
  outcome: Outcome;
  lastSlot: string; // last required slot that was filled
  handoff: { reason: string; callbackId: string } | null;
  modelsUsed: Record<string, number>;
  guardrailHits: number;
  tokensUsed: number;
  /** The customer used words like "only", "just", "sirf": a minimal plan (only_these) is allowed. */
  onlyIntent?: boolean;
}

const sessions = new Map<string, Session>();

const summariesFile = () => process.env.ADVISOR_SESSIONS_FILE ?? path.join(process.cwd(), "data", "advisor_sessions.json");

/** Masked chat summaries (also read by the back-office dashboard). */
export function readSummaries(): Record<string, unknown>[] {
  try { return JSON.parse(fs.readFileSync(summariesFile(), "utf8")); } catch { return []; }
}

/** Save/update the MASKED summary (no chat text, no GSTIN, no mobile). Used by the back-office dashboard (Step 6). */
export function saveSummary(s: Session) {
  const p = s.profile;
  const summary = {
    sessionId: s.id,
    startedAt: new Date(s.createdAt).toISOString(),
    updatedAt: new Date(s.lastActive).toISOString(),
    language: p.language,
    mode: s.mode,
    outcome: s.outcome,
    lastSlot: s.lastSlot,
    segment: p.segment_hint ?? p.segment_from_type ?? null,
    city_tier: p.city_tier ?? null,
    employee_count: p.employee_count ?? null,
    num_sites: p.num_sites ?? null,
    has_gst: p.has_gstin ?? null,
    gstin_status: p.gstin?.status ?? null,
    wishes: p.wishes,
    budget_per_month: p.budget_per_month ?? null,
    monthly_total_inr: s.recommendation?.quote.monthly_total_inr ?? null,
    handoff_reason: s.handoff?.reason ?? null,
    modelsUsed: s.modelsUsed,
    guardrailHits: s.guardrailHits,
  };
  const all = readSummaries().filter((x) => x.sessionId !== s.id);
  all.push(summary);
  try {
    const tmp = summariesFile() + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
    fs.renameSync(tmp, summariesFile());
  } catch (e) {
    console.error("[advisor] could not save summary:", (e as Error).message);
  }
}

/** Remove sessions idle for too long. Chat text disappears with them. */
export function expireIdleSessions(now = Date.now()) {
  for (const [id, s] of sessions) {
    if (now - s.lastActive > ADVISOR_CONFIG.sessionTtlMs) {
      if (s.outcome === "in_progress") s.outcome = "dropped";
      saveSummary(s);
      sessions.delete(id);
    }
  }
}

export function newSession(language: AdvisorLang = "en"): Session {
  const now = Date.now();
  const s: Session = {
    id: crypto.randomUUID(),
    createdAt: now, lastActive: now,
    profile: { wishes: [], language },
    history: [], mode: "ai", guided: { wishesAsked: false },
    recommendation: null, recommendationCount: 0,
    outcome: "in_progress", lastSlot: "start", handoff: null,
    modelsUsed: {}, guardrailHits: 0, tokensUsed: 0,
  };
  sessions.set(s.id, s);
  return s;
}

export function getSession(id: string | undefined): Session | undefined {
  expireIdleSessions();
  if (!id) return undefined;
  const s = sessions.get(id);
  if (s) s.lastActive = Date.now();
  return s;
}

export function setOutcome(s: Session, outcome: Outcome) {
  // never move "backwards" from a finished outcome to "recommended"
  const rank: Record<Outcome, number> = { in_progress: 0, dropped: 0, recommended: 1, quote_opened: 2, ordered: 3, handoff: 3 };
  if (rank[outcome] >= rank[s.outcome]) s.outcome = outcome;
  saveSummary(s);
}

// Expire sessions in the background too (does not keep the process alive).
if (process.env.VITEST === undefined) {
  setInterval(() => expireIdleSessions(), 60_000).unref();
}

/** For tests */
export function _clearSessions() { sessions.clear(); }

/** Demo reset: forget open chats and the saved (masked) chat summaries. */
export function resetSessions() {
  sessions.clear();
  try { fs.writeFileSync(summariesFile(), "[]"); } catch { /* nothing saved yet */ }
}
