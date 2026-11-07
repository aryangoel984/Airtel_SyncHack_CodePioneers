import { Router } from "express";
import { buildStarter } from "../lib/starter";
import { parseProfile } from "../lib/validate";

export const bundlesRouter = Router();

// POST /api/bundles/starter  body = business profile
// -> base bundle, suggested add-ons, more options, and blocked products (with reasons)
bundlesRouter.post("/starter", (req, res) => {
  const p = parseProfile(req.body);
  if (!p.ok) return res.status(400).json({ error: p.error });
  res.json(buildStarter(p.value));
});
