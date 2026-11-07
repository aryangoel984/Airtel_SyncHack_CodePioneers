import { Router } from "express";
import { lookupGstin } from "../lib/lookups";
import { maskId } from "../lib/mask";

export const gstinRouter = Router();

// GET /api/gstin/:gstin -> validation result + registry record
gstinRouter.get("/:gstin", (req, res) => {
  const result = lookupGstin(req.params.gstin);
  console.log(`[gstin lookup] ${maskId(result.gstin)} valid=${result.valid} found=${result.found}`); // masked only
  res.status(result.valid ? 200 : 400).json(result);
});
