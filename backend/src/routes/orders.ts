import { Router } from "express";
import { createOrder, getOrder, getOrderPrivate, PublicOrder, updateOrder } from "../lib/orders";
import { parseItems, parseMobile, parseProfile } from "../lib/validate";
import { quoteWithCopy } from "../lib/productCopy";
import { advanceOrder, trackerFor } from "../lib/tracker";
import { publicKyc } from "../lib/kyc/service";
import { rateLimit } from "../lib/rateLimit";

export const ordersRouter = Router();

/** The order as the browser sees it: masked mobile, product names, KYC without secrets, and the tracker timeline. */
const view = (o: PublicOrder) => ({ ...o, quote: quoteWithCopy(o.quote), kyc: publicKyc(o.kyc), tracker: trackerFor(o) });

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
    res.status(201).json(view(result.order));
  } catch (e) {
    next(e);
  }
});

// POST /api/orders/track { orderId, mobile } -> { id } when the mobile number matches the order.
// Lets the owner find their order from any phone. Rate-limited so order numbers can't be guessed.
ordersRouter.post("/track", rateLimit({ windowMs: 60_000, maxRequests: 10 }), (req, res) => {
  const id = typeof req.body?.orderId === "string" ? req.body.orderId.trim().toUpperCase() : "";
  const mobile = parseMobile(req.body?.mobile);
  const o = id && mobile ? getOrderPrivate(id) : undefined;
  if (!o || o.mobile !== mobile) return res.status(404).json({ error: "No order found with this number and mobile" });
  res.json({ id: o.id });
});

// GET /api/orders/:id -> the order, with the mobile number masked and the tracker timeline
ordersRouter.get("/:id", (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(view(order));
});

// POST /api/orders/:id/advance -> DEMO ONLY: move the installation to its next step (off when DEMO_CONTROLS=false)
ordersRouter.post("/:id/advance", async (req, res, next) => {
  try {
    const r = await updateOrder(req.params.id, advanceOrder);
    if ("error" in r) return res.status(r.notFound ? 404 : 409).json({ error: r.error });
    res.json(view(r.order));
  } catch (e) {
    next(e);
  }
});
