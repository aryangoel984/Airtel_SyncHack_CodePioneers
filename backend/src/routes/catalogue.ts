import { Router } from "express";
import { loadProducts } from "../lib/data";

export const catalogueRouter = Router();

// GET /api/catalogue -> all products
catalogueRouter.get("/", (_req, res) => {
  res.json({ products: loadProducts() });
});
