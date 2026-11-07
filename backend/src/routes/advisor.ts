import { Router } from "express";
import { ADVISOR_CONFIG, AdvisorLang, LANGUAGES } from "../lib/advisor/config";
import { handleChat, recordEvent, sessionView, startSession } from "../lib/advisor/engine";
import { attachMobile } from "../lib/advisor/callbacks";
import { parseMobile } from "../lib/validate";
import { rateLimit } from "../lib/rateLimit";
import { getSession } from "../lib/advisor/session";
import { requestHuman } from "../lib/advisor/tools";

export const advisorRouter = Router();
advisorRouter.use(rateLimit(ADVISOR_CONFIG.rateLimit));

const isLang = (l: unknown): l is AdvisorLang => (LANGUAGES as readonly string[]).includes(l as string);

// POST /api/advisor/start { language } -> greeting in that language (no AI call)
advisorRouter.post("/start", (req, res) => {
  const language = isLang(req.body?.language) ? req.body.language : "en";
  res.json(startSession(language));
});

// POST /api/advisor/chat { sessionId?, message, language? }
advisorRouter.post("/chat", async (req, res, next) => {
  try {
    const { sessionId, message, language } = req.body ?? {};
    if (typeof message !== "string" || !message.trim()) return res.status(400).json({ error: "message is required" });
    if (message.length > ADVISOR_CONFIG.maxMessageChars) return res.status(400).json({ error: `message is too long (max ${ADVISOR_CONFIG.maxMessageChars} characters)` });
    if (sessionId !== undefined && (typeof sessionId !== "string" || sessionId.length > 64)) return res.status(400).json({ error: "bad sessionId" });
    res.json(await handleChat({ sessionId, message, language: isLang(language) ? language : undefined }));
  } catch (e) {
    next(e);
  }
});

// GET /api/advisor/session/:id -> profile + recommendation (used to open /quote with the same items)
advisorRouter.get("/session/:id", (req, res) => {
  const v = sessionView(req.params.id);
  if (!v) return res.status(404).json({ error: "Session not found or expired" });
  res.json(v);
});

// POST /api/advisor/session/:id/event { event: "quote_opened" | "ordered" }
advisorRouter.post("/session/:id/event", (req, res) => {
  const ev = req.body?.event;
  if (ev !== "quote_opened" && ev !== "ordered") return res.status(400).json({ error: "bad event" });
  if (!recordEvent(req.params.id, ev)) return res.status(404).json({ error: "Session not found or expired" });
  res.json({ ok: true });
});

// POST /api/advisor/callback { sessionId, mobile } -> "Talk to a person". The number never goes through the AI.
advisorRouter.post("/callback", (req, res) => {
  const { sessionId, mobile } = req.body ?? {};
  const s = typeof sessionId === "string" ? getSession(sessionId) : undefined;
  if (!s) return res.status(404).json({ error: "Session not found or expired" });
  const m = parseMobile(mobile);
  if (!m) return res.status(400).json({ error: "Enter a valid 10-digit mobile number" });
  requestHuman(s, "user_asked"); // creates the lead if there isn't one yet
  const done = attachMobile(s.id, m);
  if (!done) return res.status(500).json({ error: "Could not save your request" });
  res.status(201).json({ callbackId: done.id, mobile_masked: done.mobile_masked, message: "Our expert will call you within 1 working day" });
});

// POST /api/advisor/handoff { sessionId } -> "Talk to a person" button: create the lead, then the screen asks for a number
advisorRouter.post("/handoff", (req, res) => {
  const s = typeof req.body?.sessionId === "string" ? getSession(req.body.sessionId) : undefined;
  if (!s) return res.status(404).json({ error: "Session not found or expired" });
  const h = requestHuman(s, "user_asked");
  res.status(201).json({ callbackId: h.callbackId, needsMobile: true });
});
