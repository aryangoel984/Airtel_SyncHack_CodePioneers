import { Router } from "express";
import { buildQuote } from "../lib/quote";

export const quoteRouter = Router();

// POST /api/quote  body = { profile, items:[{product_id, quantity}] } -> priced quote
quoteRouter.post("/", (req, res) => {
  const body = req.body;
  if (!body?.profile || !Array.isArray(body?.items)) {
    return res.status(400).json({ error: "Expected { profile, items[] }" });
  }
  res.json(buildQuote(body.profile, body.items));
});
