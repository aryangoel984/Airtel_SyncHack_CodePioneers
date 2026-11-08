// Step 6: back-office API for sales teams and channel partners. Every route needs the staff PIN.
//   GET   /api/backoffice/summary            funnel numbers + model quality
//   GET   /api/backoffice/queue              leads the digital journey couldn't close, ranked
//   PATCH /api/backoffice/queue/:id          { owner?, status?, note? }
//   POST  /api/backoffice/queue/:id/reveal   full mobile number (recorded in the audit log)
//   GET   /api/backoffice/reengage           past leads lost to "no visit / unreachable", ranked
//   GET   /api/backoffice/model              how the lead score was built and how good it is
//   GET   /api/backoffice/audit              who saw which number, and when
//   POST  /api/backoffice/demo-reset         clear demo orders, call requests, chats and notes (only when DEMO_CONTROLS is on)
import crypto from "crypto";
import { NextFunction, Request, Response, Router } from "express";
import { rateLimit } from "../lib/rateLimit";
import { auditLog, buildQueue, funnel, OWNERS, reengageList, resetBackoffice, revealNumber, STATUSES, updateItem } from "../lib/backoffice/queue";
import { resetOrders } from "../lib/orders";
import { resetCallbacks } from "../lib/advisor/callbacks";
import { resetSessions } from "../lib/advisor/session";
import { demoControlsEnabled } from "../lib/tracker";
import { modelReport } from "../lib/backoffice/model";

export const backofficeRouter = Router();

export const DEFAULT_PIN = "2468";
const pin = () => process.env.BACKOFFICE_PIN || DEFAULT_PIN;

// Slow down PIN guessing, then check the PIN in constant time.
backofficeRouter.use(rateLimit({ windowMs: 60_000, maxRequests: 120 }));
backofficeRouter.use((req: Request, res: Response, next: NextFunction) => {
  const given = Buffer.from(String(req.header("x-backoffice-pin") ?? ""));
  const want = Buffer.from(pin());
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return res.status(401).json({ error: "Staff PIN required" });
  }
  next();
});

backofficeRouter.get("/summary", (_req, res) => {
  const r = modelReport();
  res.json({ funnel: funnel(), model: { auc: r.auc, lift: r.lift, baseRate: r.baseRate, top20Rate: r.top20Rate }, owners: OWNERS, statuses: STATUSES });
});

backofficeRouter.get("/queue", (_req, res) => res.json(buildQueue()));

backofficeRouter.patch("/queue/:id", (req, res) => {
  const { owner, status, note } = req.body ?? {};
  if (note !== undefined && typeof note !== "string") return res.status(400).json({ error: "note must be text" });
  const r = updateItem(String(req.params.id), { owner, status, note });
  if ("error" in r) return res.status(r.error === "Not found" ? 404 : 400).json(r);
  res.json(r);
});

backofficeRouter.post("/queue/:id/reveal", (req, res) => {
  const r = revealNumber(String(req.params.id));
  if ("error" in r) return res.status(404).json(r);
  res.setHeader("Cache-Control", "no-store");
  res.json(r);
});

backofficeRouter.get("/reengage", (_req, res) => res.json(reengageList(50)));
backofficeRouter.get("/model", (_req, res) => res.json(modelReport()));
backofficeRouter.get("/audit", (_req, res) => res.json(auditLog(50)));

backofficeRouter.post("/demo-reset", (_req, res) => {
  if (!demoControlsEnabled()) return res.status(403).json({ error: "Demo controls are switched off" });
  resetOrders(); resetCallbacks(); resetSessions(); resetBackoffice();
  console.log("[backoffice] demo data reset");
  res.json({ ok: true });
});
