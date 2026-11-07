import { Router } from "express";
import { getEligibleProducts, defaultQuantity } from "../lib/rules";

export const eligibleRouter = Router();

// POST /api/eligible  body = business profile -> every product it can buy + suggested quantity
eligibleRouter.post("/", (req, res) => {
  const profile = req.body;
  if (!profile || typeof profile !== "object" || !Object.keys(profile).length) {
    return res.status(400).json({ error: "Expected a profile" });
  }
  const products = getEligibleProducts(profile).map((p) => ({
    ...p,
    suggested_quantity: defaultQuantity(p, profile),
  }));
  res.json({ products });
});
