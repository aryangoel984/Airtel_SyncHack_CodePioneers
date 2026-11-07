import { Router } from "express";
import { loadProducts } from "../lib/data";
import { copyFor } from "../lib/productCopy";

export const catalogueRouter = Router();

// GET /api/catalogue -> all products
catalogueRouter.get("/", (_req, res) => {
  res.json({ products: loadProducts().map((p) => ({ ...p, copy: copyFor(p.product_id) })) });
});
