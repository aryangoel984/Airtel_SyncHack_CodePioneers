import { Router } from "express";
import { lookupUdyam } from "../lib/lookups";
import { maskId } from "../lib/mask";

export const udyamRouter = Router();

// GET /api/udyam/:udyam -> validation result + registry record
udyamRouter.get("/:udyam", (req, res) => {
  const result = lookupUdyam(req.params.udyam);
  console.log(`[udyam lookup] ${maskId(result.udyam)} valid=${result.valid} found=${result.found}`); // masked only
  res.status(result.valid ? 200 : 400).json(result);
});
