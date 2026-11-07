// Express API server (port 4000). Exports `app` so tests can call it with supertest.
import "dotenv/config"; // loads backend/.env (GROQ key etc.): never logged, never sent to the browser
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { gstinRouter } from "./routes/gstin";
import { udyamRouter } from "./routes/udyam";
import { catalogueRouter } from "./routes/catalogue";
import { eligibleRouter } from "./routes/eligible";
import { quoteRouter } from "./routes/quote";
import { bundlesRouter } from "./routes/bundles";
import { ordersRouter } from "./routes/orders";
import { warmStarterCache } from "./lib/starter";
import { advisorRouter } from "./routes/advisor";
import { kycRouter } from "./routes/kyc";
import { backofficeRouter, DEFAULT_PIN } from "./routes/backoffice";
import { trainModel } from "./lib/backoffice/model";
import { initModels } from "./lib/advisor/llm";

// Load CSVs and compute the starter-bundle statistics once, at startup.
warmStarterCache();
trainModel(); // lead score for the back office (about 1 second)

export const app = express();

// Only our own frontend may call this API from a browser.
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json({ limit: "20kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/gstin", gstinRouter);
app.use("/api/udyam", udyamRouter);
app.use("/api/catalogue", catalogueRouter);
app.use("/api/eligible", eligibleRouter);
app.use("/api/quote", quoteRouter);
app.use("/api/bundles", bundlesRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/advisor", advisorRouter);
app.use("/api/kyc", kycRouter);
app.use("/api/backoffice", backofficeRouter);

// Simple error handler: bad JSON -> 400, anything else -> 500 (no stack traces to the client).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status === 500) console.error("[error]", err.message);
  res.status(status).json({ error: status === 500 ? "Something went wrong" : "Bad request" });
});

if (process.env.VITEST === undefined) {
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
  initModels(); // confirm the Groq models exist (logs model names only)
  if (!process.env.BACKOFFICE_PIN) console.warn(`[backoffice] using the demo staff PIN ${DEFAULT_PIN}. Set BACKOFFICE_PIN in backend/.env before going live.`);
}
