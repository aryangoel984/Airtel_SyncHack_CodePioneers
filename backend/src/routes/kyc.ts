// Smart KYC API (Step 4).
//   GET  /api/kyc/samples                      sample applicants K01-K12 (for the demo "DigiLocker" button)
//   GET  /api/kyc/samples/:id/:doc             one sample document image
//   GET  /api/kyc/:orderId                     KYC state of an order (no images, no full numbers)
//   POST /api/kyc/:orderId/consent             { language }  record the consent
//   POST /api/kyc/:orderId/digilocker          record the (mock) DigiLocker consent
//   POST /api/kyc/:orderId/verify              multipart: 4 files + noGst/noUdyam/gstin -> check results
//   POST /api/kyc/:orderId/esign/start         -> demo OTP
//   POST /api/kyc/:orderId/esign/confirm       { name, otp } -> order becomes KYC_VERIFIED
import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { getOrder } from "../lib/orders";
import { rateLimit } from "../lib/rateLimit";
import { DOC_TYPES, DocType } from "../lib/kyc/types";
import { confirmEsign, publicKyc, recordConsent, recordDigilocker, runVerification, startEsign } from "../lib/kyc/service";

export const kycRouter = Router();

// Files stay in memory only (never written to disk). Max 8 MB each, 4 files, images only.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpe?g|webp)$/.test(file.mimetype)),
});

const SAMPLE_DIR = () => path.join(process.cwd(), "data", "kyc_samples");
const SAMPLES: [string, string][] = [
  ["K01", "Vindhya Tours & Travels"], ["K02", "Harmony Dental Care"], ["K03", "Ganesh Woodcraft"],
  ["K04", "Saffron Dental Care LLP"], ["K05", "Balaji Realty LLP"], ["K06", "Saffron Unisex Salon"],
  ["K07", "Neelgiri Physio Clinic"], ["K08", "Green Leaf Legal Associates"], ["K09", "Kaveri Insurance Advisors"],
  ["K10", "Kaveri Stays LLP"], ["K11", "Trinity Bake House Pvt Ltd"], ["K12", "Star Electronics"],
];

kycRouter.get("/samples", (_req, res) => {
  res.json(SAMPLES.map(([id, business]) => ({
    id, business,
    docs: DOC_TYPES.filter((d) => fs.existsSync(path.join(SAMPLE_DIR(), `${id}_${d}.png`))),
  })));
});

kycRouter.get("/samples/:id/:doc", (req, res) => {
  const { id, doc } = req.params;
  if (!/^K(0[1-9]|1[0-2])$/.test(id) || !(DOC_TYPES as readonly string[]).includes(doc)) return res.status(404).json({ error: "Not found" });
  const file = path.join(SAMPLE_DIR(), `${id}_${doc}.png`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: "Not found" });
  res.type("png").sendFile(file);
});

kycRouter.get("/:orderId", (req, res) => {
  const o = getOrder(String(req.params.orderId));
  if (!o) return res.status(404).json({ error: "Order not found" });
  res.json({ orderId: o.id, status: o.status, kyc: publicKyc(o.kyc) });
});

const send = (res: import("express").Response, r: { order: { id: string; status: string; kyc?: import("../lib/kyc/types").KycRecord } } | { error: string; notFound?: boolean }) =>
  "error" in r ? res.status(r.notFound ? 404 : 409).json({ error: r.error }) : res.json({ orderId: r.order.id, status: r.order.status, kyc: publicKyc(r.order.kyc) });

kycRouter.post("/:orderId/consent", async (req, res, next) => {
  try {
    if (req.body?.accepted !== true) return res.status(400).json({ error: "Consent must be accepted" });
    send(res, await recordConsent(String(req.params.orderId), req.body?.language === "hi" ? "hi" : "en"));
  } catch (e) { next(e); }
});

kycRouter.post("/:orderId/digilocker", async (req, res, next) => {
  try { send(res, await recordDigilocker(String(req.params.orderId))); } catch (e) { next(e); }
});

const verifyLimit = rateLimit({ windowMs: 60_000, maxRequests: 6 });
kycRouter.post("/:orderId/verify", verifyLimit, upload.fields(DOC_TYPES.map((name) => ({ name, maxCount: 1 }))), async (req, res, next) => {
  try {
    const uploaded = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const files: Partial<Record<DocType, Buffer>> = {};
    for (const d of DOC_TYPES) if (uploaded[d]?.[0]) files[d] = uploaded[d][0].buffer;
    const typed = typeof req.body?.gstin === "string" && req.body.gstin.trim() ? req.body.gstin.trim().toUpperCase().slice(0, 20) : undefined;
    const r = await runVerification(String(req.params.orderId), {
      files, noGst: req.body?.noGst === "true", noUdyam: req.body?.noUdyam === "true", typedGstin: typed,
    });
    if ("error" in r) return res.status(r.status).json({ error: r.error });
    const o = getOrder(String(req.params.orderId))!;
    res.json({ orderId: o.id, status: o.status, kyc: publicKyc(o.kyc) });
  } catch (e) { next(e); }
});

kycRouter.post("/:orderId/esign/start", async (req, res, next) => {
  try {
    const r = await startEsign(String(req.params.orderId));
    if ("error" in r) return res.status(r.notFound ? 404 : 409).json({ error: r.error });
    res.json(r);
  } catch (e) { next(e); }
});

kycRouter.post("/:orderId/esign/confirm", async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
    if (name.length < 2) return res.status(400).json({ error: "Please type your full name" });
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: "Enter the 6-digit code" });
    send(res, await confirmEsign(String(req.params.orderId), name, otp));
  } catch (e) { next(e); }
});
