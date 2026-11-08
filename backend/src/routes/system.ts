// Public system status for the demo: is the AI live, is the OCR engine loaded? No secrets, no personal data.
//   GET /api/status
import { Router } from "express";
import { ADVISOR_CONFIG } from "../lib/advisor/config";
import { activeModels, hasBackupKey, llmStatus } from "../lib/advisor/llm";
import { ocrReady } from "../lib/kyc/ocr";
import { demoControlsEnabled } from "../lib/tracker";

export const systemRouter = Router();
const startedAt = new Date().toISOString();

systemRouter.get("/", (_req, res) => {
  const configured = !!ADVISOR_CONFIG.apiKey();
  const failingNow = !!llmStatus.lastFailAt && (!llmStatus.lastOkAt || llmStatus.lastFailAt > llmStatus.lastOkAt);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    startedAt,
    ai: {
      configured,
      backupKey: configured && hasBackupKey(),
      models: activeModels(),
      state: !configured ? "guided" : failingNow ? "degraded" : "live",
      lastOkAt: llmStatus.lastOkAt,
      usingBackupKey: llmStatus.lastKey === "backup",
    },
    ocr: { ready: ocrReady() },
    demoControls: demoControlsEnabled(),
  });
});
