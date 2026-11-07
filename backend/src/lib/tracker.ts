// Step 5: the order tracker. Turns an order's status history into a simple timeline with dates,
// so the owner can check progress instead of calling support.
import type { Order, OrderStatus, PublicOrder } from "./orders";
import { setStatus } from "./orders";

export const TRACK_STAGES = ["QUOTE_ACCEPTED", "KYC_VERIFIED", "SITE_CHECK", "TECH_SCHEDULED", "INSTALLED", "ACTIVE"] as const;
export type TrackStage = (typeof TRACK_STAGES)[number];

export interface StageView {
  key: TrackStage;
  state: "done" | "current" | "attention" | "blocked" | "upcoming";
  at: string | null; // when it happened
  expected: string | null; // YYYY-MM-DD, for stages not done yet
}

export interface TrackerView {
  stages: StageView[];
  progress: number; // 0..1
  expected_live: string; // YYYY-MM-DD
  canAdvance: boolean; // demo button allowed?
}

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => ymd(new Date(new Date(iso.slice(0, 10) + "T00:00:00Z").getTime() + n * DAY));

/** Days after business verification at which each later stage is expected. */
function offsets(installDays: number): Record<"SITE_CHECK" | "TECH_SCHEDULED" | "INSTALLED" | "ACTIVE", number> {
  const install = Math.max(1, installDays);
  return { SITE_CHECK: 1, TECH_SCHEDULED: Math.max(1, Math.min(2, install - 1)), INSTALLED: install, ACTIVE: install };
}

export function trackerFor(o: Order | PublicOrder): TrackerView {
  const reached = new Map<OrderStatus, string>();
  for (const h of o.statusHistory) reached.set(h.status, h.at);
  const verifiedAt = reached.get("KYC_VERIFIED");
  // Not verified yet: count from "tomorrow", assuming the customer verifies today.
  const base = verifiedAt ?? addDays(o.statusHistory[o.statusHistory.length - 1].at, 0);
  const off = offsets(o.quote.install_days);

  const order = TRACK_STAGES.indexOf(o.status as TrackStage);
  let currentFound = false;
  const stages: StageView[] = TRACK_STAGES.map((key) => {
    const at = reached.get(key) ?? null;
    const done = !!at && (order === -1 ? key === "QUOTE_ACCEPTED" : TRACK_STAGES.indexOf(key) <= order);
    let state: StageView["state"] = done ? "done" : "upcoming";
    if (!done && !currentFound) {
      currentFound = true;
      state = key === "KYC_VERIFIED" && o.status === "KYC_ACTION_NEEDED" ? "attention"
        : key === "KYC_VERIFIED" && o.status === "KYC_REJECTED" ? "blocked" : "current";
    }
    const expected = done ? null
      : key === "QUOTE_ACCEPTED" ? null
      : key === "KYC_VERIFIED" ? ymd(new Date(base))
      : addDays(base, off[key]);
    return { key, state, at: done ? at : null, expected };
  });

  const doneCount = stages.filter((s) => s.state === "done").length;
  return {
    stages,
    progress: doneCount / TRACK_STAGES.length,
    expected_live: stages[stages.length - 1].at?.slice(0, 10) ?? stages[stages.length - 1].expected ?? o.quote.expected_activation_date,
    canAdvance: demoControlsEnabled() && TRACK_STAGES.indexOf(o.status as TrackStage) >= TRACK_STAGES.indexOf("KYC_VERIFIED") && o.status !== "ACTIVE",
  };
}

/** The demo "move to next step" button is on unless DEMO_CONTROLS=false (turn it off for a real launch). */
export const demoControlsEnabled = () => process.env.DEMO_CONTROLS !== "false";

/**
 * DEMO ONLY: move a verified order to its next installation step. The time stamp is the stage's
 * expected date, so the timeline looks like a real installation.
 */
export function advanceOrder(o: Order): string | void {
  if (!demoControlsEnabled()) return "Demo controls are switched off";
  const i = TRACK_STAGES.indexOf(o.status as TrackStage);
  if (i < TRACK_STAGES.indexOf("KYC_VERIFIED")) return "Verify the business first";
  if (o.status === "ACTIVE") return "Already active";
  const next = TRACK_STAGES[i + 1];
  const t = trackerFor(o).stages.find((s) => s.key === next);
  const day = t?.expected ?? new Date().toISOString().slice(0, 10);
  const now = new Date();
  const at = `${day}T${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}:00.000Z`;
  setStatus(o, next, "demo: advanced", at);
}
