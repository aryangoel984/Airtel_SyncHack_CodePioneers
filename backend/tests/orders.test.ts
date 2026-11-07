import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";

// Use a throw-away orders file so tests never touch real data.
process.env.ORDERS_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "udyam-orders-")), "orders.json");

import { app } from "../src/server";

const profile = { segment: "micro", city_tier: 1, employee_count: 3, num_sites: 1, has_valid_active_gstin: true };
const body = (extra = {}) => ({
  profile, items: [{ product_id: "P01", quantity: 1 }, { product_id: "P07", quantity: 3 }],
  language: "hi", mobile: "9876543221", ...extra,
});

describe("orders", () => {
  let id = "";
  beforeAll(async () => {
    // Client lies about the total and the unit prices: the server must ignore this.
    const res = await request(app).post("/api/orders").send(body({
      total: 1, monthly_total_inr: 1, quote: { monthly_total_inr: 1 },
      items: [{ product_id: "P01", quantity: 1, price: 1 }, { product_id: "P07", quantity: 3, price: 1 }],
    }));
    expect(res.status).toBe(201);
    id = res.body.id;
  });

  it("recalculates the price on the server even if the client sends a wrong total", async () => {
    const res = await request(app).get(`/api/orders/${id}`);
    expect(res.body.quote.monthly_total_inr).toBe(999 + 3 * 299); // 1896
    expect(res.body.quote.contract_months).toBe(12);
    expect(res.body.quote.expected_activation_date).toBe("2026-07-20");
  });

  it("uses the id format UD-2026-0001 and starts as QUOTE_ACCEPTED with history", async () => {
    expect(id).toBe("UD-2026-0001");
    const res = await request(app).get(`/api/orders/${id}`);
    expect(res.body.status).toBe("QUOTE_ACCEPTED");
    expect(res.body.statusHistory).toHaveLength(1);
  });

  it("never returns the full mobile number", async () => {
    const res = await request(app).get(`/api/orders/${id}`);
    expect(res.body.mobile_masked).toBe("98******21");
    expect(JSON.stringify(res.body)).not.toContain("9876543221");
    expect(res.body.mobile).toBeUndefined();
  });

  it("numbers orders in sequence, even when created at the same moment", async () => {
    const [a, b] = await Promise.all([
      request(app).post("/api/orders").send(body()),
      request(app).post("/api/orders").send(body()),
    ]);
    expect([a.body.id, b.body.id].sort()).toEqual(["UD-2026-0002", "UD-2026-0003"]);
  });

  it("rejects a bad mobile number, an unknown order, and unsellable items", async () => {
    expect((await request(app).post("/api/orders").send(body({ mobile: "12345" }))).status).toBe(400);
    expect((await request(app).get("/api/orders/UD-2026-9999")).status).toBe(404);
    // tier-2 shop without GST asking only for Fibre 1G: nothing sellable
    const res = await request(app).post("/api/orders").send(body({
      profile: { ...profile, city_tier: 2, has_valid_active_gstin: false },
      items: [{ product_id: "P03", quantity: 1 }],
    }));
    expect(res.status).toBe(422);
  });
});
