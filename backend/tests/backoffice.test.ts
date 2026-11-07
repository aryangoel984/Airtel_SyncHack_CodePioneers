// Step 6: lead score + back-office queue.
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import { modelReport, scoreLead } from "../src/lib/backoffice/model";
import { routeLead } from "../src/lib/backoffice/queue";
import { app } from "../src/server";

const PIN = "2468";

describe("lead score (logistic regression on 5,000 past leads)", () => {
  it("ranks leads better than chance on leads it never saw", () => {
    const r = modelReport();
    expect(r.trainedOn).toBe(4000);
    expect(r.testedOn).toBe(1000);
    expect(r.auc).toBeGreaterThan(0.65);
    expect(r.lift).toBeGreaterThan(1.4); // top 20% convert at least 1.4x the average
    expect(r.deciles[0].rate).toBeGreaterThan(r.deciles[9].rate);
  });

  it("learned the signals visible in the data (GST helps, WhatsApp-campaign leads convert less)", () => {
    const w = Object.fromEntries(modelReport().factors.map((f) => [f.name, f.weight]));
    expect(w.gst).toBeGreaterThan(0);
    expect(w["src_WhatsApp campaign"]).toBeLessThan(0);
  });

  it("a GST-registered office in a big city scores above a no-GST micro shop in a small city", () => {
    const office = scoreLead({ segment: "prof", city_tier: 1, has_gst: true, employee_count: 15, num_sites: 1 });
    const shop = scoreLead({ segment: "micro", city_tier: 2, has_gst: false, employee_count: 2, num_sites: 1 });
    expect(office.probability).toBeGreaterThan(shop.probability);
    expect(shop.reasons.map((r) => r.label)).toContain("No GST number");
  });

  it("unknown details don't break scoring", () => {
    const s = scoreLead({});
    expect(s.probability).toBeGreaterThan(0);
    expect(s.probability).toBeLessThan(1);
  });
});

describe("routing: who should call", () => {
  it("routes by the simple rule set", () => {
    expect(routeLead({ reasonCode: "kyc_rejected", segment: "micro", city_tier: 2, sites: 1 }).owner).toBe("Field sales");
    expect(routeLead({ reasonCode: "user_asked", segment: "multi", city_tier: 1, sites: 8 }).owner).toBe("Field sales");
    expect(routeLead({ reasonCode: "user_asked", segment: "micro", city_tier: 2, sites: 1 }).owner).toBe("Channel partner");
    expect(routeLead({ reasonCode: "user_asked", segment: "prof", city_tier: 1, sites: 1 }).owner).toBe("Inside sales");
  });
});

describe("back-office API", () => {
  let dir = "";
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "udyam-bo-"));
    process.env.ORDERS_FILE = path.join(dir, "orders.json");
    process.env.BACKOFFICE_FILE = path.join(dir, "backoffice.json");
    fs.writeFileSync(process.env.CALLBACKS_FILE!, JSON.stringify([{
      id: "CB-TEST01", createdAt: "2026-07-15T10:00:00.000Z", sessionId: "s1", reason: "user_asked",
      summary: { segment: "prof", city_tier: 1, employee_count: 12, num_sites: 1, has_gst: true, wishes: ["cctv"], language: "en" },
      mobile: "9812345678", status: "new",
    }]));
    // an order that is waiting for verification
    await request(app).post("/api/orders").send({
      profile: { segment: "micro", city_tier: 2, employee_count: 3, num_sites: 1, has_valid_active_gstin: false },
      items: [{ product_id: "P01", quantity: 1 }], language: "hi", mobile: "9876543210",
    });
  });

  it("needs the staff PIN", async () => {
    expect((await request(app).get("/api/backoffice/queue")).status).toBe(401);
    expect((await request(app).get("/api/backoffice/queue").set("x-backoffice-pin", "0000")).status).toBe(401);
  });

  it("lists callback requests first, with masked numbers, owner and score", async () => {
    const q = (await request(app).get("/api/backoffice/queue").set("x-backoffice-pin", PIN)).body;
    expect(q[0]).toMatchObject({ id: "CB-TEST01", owner: "Inside sales", status: "New", mobile_masked: "98******78" });
    expect(q[0].score.band).toMatch(/High|Medium|Low/);
    const order = q.find((x: { kind: string }) => x.kind === "order");
    expect(order).toMatchObject({ owner: "Channel partner", reason: { code: "kyc_not_started" } });
    expect(JSON.stringify(q)).not.toContain("9812345678");
  });

  it("saves owner / status / note, and records number reveals in the audit log", async () => {
    const up = await request(app).patch("/api/backoffice/queue/CB-TEST01").set("x-backoffice-pin", PIN)
      .send({ owner: "Field sales", status: "Contacted", note: "Call back Monday" });
    expect(up.body).toMatchObject({ owner: "Field sales", status: "Contacted", note: "Call back Monday", ownerWhy: "Changed by a team member" });
    expect((await request(app).patch("/api/backoffice/queue/CB-TEST01").set("x-backoffice-pin", PIN).send({ status: "Maybe" })).status).toBe(400);

    const rev = await request(app).post("/api/backoffice/queue/CB-TEST01/reveal").set("x-backoffice-pin", PIN);
    expect(rev.body.mobile).toBe("9812345678");
    const audit = (await request(app).get("/api/backoffice/audit").set("x-backoffice-pin", PIN)).body;
    expect(audit[0]).toMatchObject({ id: "CB-TEST01", action: "reveal_number" });
  });

  it("re-engage list: past leads lost only because nobody visited or reached them", async () => {
    const r = (await request(app).get("/api/backoffice/reengage").set("x-backoffice-pin", PIN)).body;
    expect(r.pool).toBe(1632); // 805 unreachable + 531 no time for a visit + 296 visit never scheduled
    expect(r.leads).toHaveLength(50);
    expect(r.leads[0].expected_value_inr).toBeGreaterThanOrEqual(r.leads[49].expected_value_inr);
    expect(r.expectedCustomersTop20).toBeGreaterThan(0);
  });

  it("summary has the live funnel and model quality", async () => {
    const s = (await request(app).get("/api/backoffice/summary").set("x-backoffice-pin", PIN)).body;
    expect(s.funnel.stages.map((x: { key: string }) => x.key)).toEqual(["chats", "plans", "quotes", "orders", "verified", "live"]);
    expect(s.model.auc).toBeGreaterThan(0.65);
  });
});
