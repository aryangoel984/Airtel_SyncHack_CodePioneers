// Step 4: Smart KYC. Runs real OCR on the 12 sample applicants and checks each verdict
// against the answer we expect from inspecting the documents by hand.
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { verifyKyc } from "../src/lib/kyc/checks";
import { closeOcr } from "../src/lib/kyc/ocr";
import { readGstin, readUdyam, sameText, parseId } from "../src/lib/kyc/parse";
import { loadGstinRegistry } from "../src/lib/data";
import type { DocType } from "../src/lib/kyc/types";
import { app } from "../src/server";

const DIR = path.join(process.cwd(), "data", "kyc_samples");
const DOCS: DocType[] = ["gst_certificate", "udyam_certificate", "signatory_id", "address_proof"];
const filesFor = (id: string) => {
  const f: Partial<Record<DocType, Buffer>> = {};
  for (const d of DOCS) { const p = path.join(DIR, `${id}_${d}.png`); if (fs.existsSync(p)) f[d] = fs.readFileSync(p); }
  return f;
};

afterAll(async () => { await closeOcr(); });

describe("OCR helpers", () => {
  const reg = loadGstinRegistry();
  it("fixes O/0 mix-ups by position and keeps a valid GSTIN", () => {
    expect(readGstin("19E0GXH4115Y1ZL", (g) => reg.has(g))?.value).toBe("19EOGXH4115Y1ZL"); // K02 as OCR reads it
    expect(readGstin("07CPCXNO398P1ZT", (g) => reg.has(g))).toMatchObject({ value: "07CPCXN0398P1ZT", checksumOk: true });
  });
  it("accepts ONE look-alike swap only if the result is real (I vs J on K10)", () => {
    expect(readGstin("27QHIXK0658U1ZL", (g) => reg.has(g))).toMatchObject({ value: "27QHJXK0658U1ZL", ocrFixed: true });
  });
  it("does not 'fix' a tampered GSTIN (K06: one digit changed)", () => {
    expect(readGstin("08YKZXS8189L1Z0", (g) => reg.has(g))?.checksumOk).toBe(false);
  });
  it("reads Udyam numbers with stray spaces", () => {
    expect(readUdyam("UDYAM-MH-00- 9516696")).toBe("UDYAM-MH-00-9516696");
    expect(readUdyam("")).toBeNull();
  });
  it("matches names despite small OCR slips, but not a different name", () => {
    expect(sameText("Harmony Dentaf Care", "Harmony Dental Care")).toBe(true);
    expect(sameText("Neha Banerjee (Prop. Shri Physio Clinic)", "Neha Banerjee (Prop. Neelgiri Physio Clinic)")).toBe(false);
  });
  it("reads ID cards that print the value on the line below the label", () => {
    expect(parseId("Name\nJoseph Singh\nValid till\n2028-07-04").validTill).toBe("2028-07-04");
  });
});

// Expected answers for the sample pack. Each "fails" code must appear; nothing else may fail.
const EXPECTED: Record<string, { verdict: string; fails: string[] }> = {
  K01: { verdict: "REJECTED", fails: ["gst_status", "udyam_number_missing"] }, // GST cancelled + Udyam number blank
  K02: { verdict: "VERIFIED", fails: [] }, // tilted photo, still readable
  K03: { verdict: "VERIFIED", fails: [] },
  K04: { verdict: "ACTION_NEEDED", fails: ["gst_certificate_unreadable"] }, // blurry
  K05: { verdict: "ACTION_NEEDED", fails: ["udyam_certificate_missing"] },
  K06: { verdict: "REJECTED", fails: ["gstin_checksum"] }, // altered GSTIN
  K07: { verdict: "ACTION_NEEDED", fails: ["gst_name_match"] }, // name differs from registry
  K08: { verdict: "VERIFIED", fails: [] },
  K09: { verdict: "VERIFIED", fails: [] },
  K10: { verdict: "VERIFIED", fails: [] },
  K11: { verdict: "ACTION_NEEDED", fails: ["bill_fresh"] }, // bill older than 90 days
  K12: { verdict: "VERIFIED", fails: [] },
};

describe("sample applicants K01-K12 (real OCR)", () => {
  for (const [id, exp] of Object.entries(EXPECTED)) {
    it(`${id} -> ${exp.verdict}${exp.fails.length ? ` (${exp.fails.join(", ")})` : ""}`, async () => {
      const r = await verifyKyc({ files: filesFor(id), noGst: false, noUdyam: false });
      const fails = r.checks.filter((c) => c.result === "fail").map((c) => c.code).sort();
      expect(fails).toEqual([...exp.fails].sort());
      expect(r.verdict).toBe(exp.verdict);
      // privacy: no full GSTIN / Udyam number anywhere in the stored result
      const json = JSON.stringify(r);
      expect(json).not.toMatch(/\b\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/);
      expect(json).not.toMatch(/UDYAM-[A-Z]{2}-\d{2}-\d{7}/);
    }, 60_000);
  }
});

describe("KYC flow over the API: order -> consent -> verify -> e-sign -> tracker", () => {
  let dir = "";
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "udyam-kyc-"));
    process.env.ORDERS_FILE = path.join(dir, "orders.json");
  });

  const newOrder = async () => {
    const res = await request(app).post("/api/orders").send({
      profile: { segment: "prof", city_tier: 1, employee_count: 12, num_sites: 1, has_valid_active_gstin: true },
      items: [{ product_id: "P02", quantity: 1 }, { product_id: "P07", quantity: 2 }],
      language: "en", mobile: "9876543210",
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };
  const attach = (req: request.Test, id: string) => {
    for (const d of DOCS) { const p = path.join(DIR, `${id}_${d}.png`); if (fs.existsSync(p)) req = req.attach(d, p); }
    return req;
  };

  it("refuses documents before consent", async () => {
    const id = await newOrder();
    const res = await attach(request(app).post(`/api/kyc/${id}/verify`), "K03");
    expect(res.status).toBe(409);
  });

  it("verified documents + e-sign -> KYC_VERIFIED, then the demo moves the install forward to ACTIVE", async () => {
    const id = await newOrder();
    expect((await request(app).post(`/api/kyc/${id}/consent`).send({ accepted: true })).status).toBe(200);
    const v = await attach(request(app).post(`/api/kyc/${id}/verify`), "K12");
    expect(v.status).toBe(200);
    expect(v.body.kyc.result.verdict).toBe("VERIFIED");

    const start = await request(app).post(`/api/kyc/${id}/esign/start`);
    expect(start.body.sentTo).toBe("98******10");
    const bad = await request(app).post(`/api/kyc/${id}/esign/confirm`).send({ name: "Pooja Agarwal", otp: "000000" });
    expect(bad.status).toBe(409);
    const ok = await request(app).post(`/api/kyc/${id}/esign/confirm`).send({ name: "Pooja Agarwal", otp: start.body.demoOtp });
    expect(ok.body.status).toBe("KYC_VERIFIED");

    let o = (await request(app).get(`/api/orders/${id}`)).body;
    expect(o.tracker.stages.map((s: { state: string }) => s.state)).toEqual(["done", "done", "current", "upcoming", "upcoming", "upcoming"]);
    expect(o.kyc.pendingOtp).toBeUndefined();
    for (let i = 0; i < 4; i++) o = (await request(app).post(`/api/orders/${id}/advance`)).body;
    expect(o.status).toBe("ACTIVE");
    expect(o.tracker.progress).toBe(1);
    expect(o.notifications.length).toBe(6); // one mock SMS per step: confirmed, verified, site check, technician, installed, live
    expect((await request(app).post(`/api/orders/${id}/advance`)).status).toBe(409);
  }, 60_000);

  it("documents that need a fix -> KYC_ACTION_NEEDED; the tracker shows 'attention'; install can't be advanced", async () => {
    const id = await newOrder();
    await request(app).post(`/api/kyc/${id}/consent`).send({ accepted: true });
    const v = await attach(request(app).post(`/api/kyc/${id}/verify`), "K11");
    expect(v.body.status).toBe("KYC_ACTION_NEEDED");
    expect((await request(app).post(`/api/kyc/${id}/esign/start`)).status).toBe(409);
    const o = (await request(app).get(`/api/orders/${id}`)).body;
    expect(o.tracker.stages[1].state).toBe("attention");
    expect((await request(app).post(`/api/orders/${id}/advance`)).status).toBe(409);
  }, 60_000);

  it("track lookup needs the right mobile number", async () => {
    const id = await newOrder();
    expect((await request(app).post("/api/orders/track").send({ orderId: id, mobile: "9876543210" })).body.id).toBe(id);
    expect((await request(app).post("/api/orders/track").send({ orderId: id, mobile: "9123456789" })).status).toBe(404);
  });

  it("serves sample documents only from the sample list", async () => {
    expect((await request(app).get("/api/kyc/samples")).body).toHaveLength(12);
    expect((await request(app).get("/api/kyc/samples/K01/gst_certificate")).status).toBe(200);
    expect((await request(app).get("/api/kyc/samples/..%2F..%2Fpackage/gst_certificate")).status).toBe(404);
  });
});
