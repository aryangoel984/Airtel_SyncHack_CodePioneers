// Callback leads for sales/partners (used by the back-office view in Step 6).
// The mobile number is NOT collected in chat. It arrives separately via POST /api/advisor/callback.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { maskMobile } from "../mask";
import { TODAY } from "../validators";

export interface CallbackLead {
  id: string;
  createdAt: string;
  sessionId: string;
  reason: string; // user_asked | too_large | frustrated | other
  summary: Record<string, unknown>; // masked profile summary, no chat text
  mobile: string | null; // stored in full for the callback, returned only masked
  status: "new";
}

const file = () => process.env.CALLBACKS_FILE ?? path.join(process.cwd(), "data", "callbacks.json");

function readAll(): CallbackLead[] {
  try { return JSON.parse(fs.readFileSync(file(), "utf8")); } catch { return []; }
}
function writeAll(all: CallbackLead[]) {
  const tmp = file() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
  fs.renameSync(tmp, file());
}

export function createCallback(sessionId: string, reason: string, summary: Record<string, unknown>): CallbackLead {
  const d = new Date(TODAY);
  const now = new Date();
  d.setUTCHours(now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), 0); // simulated clock like orders
  const lead: CallbackLead = {
    id: "CB-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
    createdAt: d.toISOString(), sessionId, reason, summary, mobile: null, status: "new",
  };
  const all = readAll();
  all.push(lead);
  writeAll(all);
  console.log(`[advisor] callback lead ${lead.id} reason=${reason}`);
  return lead;
}

/** Attach the customer's mobile number to their callback lead. Returns the masked number. */
export function attachMobile(sessionId: string, mobile: string): { id: string; mobile_masked: string } | null {
  const all = readAll();
  const lead = [...all].reverse().find((l) => l.sessionId === sessionId);
  if (!lead) return null;
  lead.mobile = mobile;
  writeAll(all);
  console.log(`[advisor] callback ${lead.id} mobile=${maskMobile(mobile)}`);
  return { id: lead.id, mobile_masked: maskMobile(mobile) };
}
