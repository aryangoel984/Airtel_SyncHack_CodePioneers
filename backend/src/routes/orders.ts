import { Router } from "express";
import { createOrder, getOrder } from "../lib/orders";
import { parseItems, parseMobile, parseProfile } from "../lib/validate";
import { quoteWithCopy } from "../lib/productCopy";

export const ordersRouter = Router();

// POST /api/orders  body = { profile, items:[{product_id, quantity}], language, mobile }
// Any price or total sent by the browser is ignored: the server recalculates everything.
ordersRouter.post("/", async (req, res, next) => {
  try {
    const profile = parseProfile(req.body?.profile);
    if (!profile.ok) return res.status(400).json({ error: profile.error });
    const items = parseItems(req.body?.items);
    if (!items.ok) return res.status(400).json({ error: items.error });
    const mobile = parseMobile(req.body?.mobile);
    if (!mobile) return res.status(400).json({ error: "Enter a valid 10-digit mobile number" });
    const language = req.body?.language === "hi" ? "hi" : "en";

    const result = await createOrder({ profile: profile.value, items: items.value, language, mobile });
    if ("error" in result) return res.status(422).json({ error: result.error });
    res.status(201).json({ ...result.order, quote: quoteWithCopy(result.order.quote) });
  } catch (e) {
    next(e);
  }
});

// GET /api/orders/:id -> the order, with the mobile number masked
ordersRouter.get("/:id", (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ ...order, quote: quoteWithCopy(order.quote) });
});
