import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/server";
import { buildStarter, STARTER_CONFIG } from "../src/lib/starter";
import { checkBundle, BusinessProfile } from "../src/lib/rules";

// A typical profile for each segment (tier 1, with GST).
const TYPICAL: Record<string, BusinessProfile> = {
  micro: { segment: "micro", city_tier: 1, employee_count: 3, num_sites: 1, has_valid_active_gstin: true },
  prof: { segment: "prof", city_tier: 1, employee_count: 15, num_sites: 1, has_valid_active_gstin: true },
  multi: { segment: "multi", city_tier: 1, employee_count: 40, num_sites: 5, has_valid_active_gstin: true },
  mfg: { segment: "mfg", city_tier: 1, employee_count: 60, num_sites: 1, has_valid_active_gstin: true },
};

describe("starter bundles", () => {
  for (const [seg, profile] of Object.entries(TYPICAL)) {
    it(`${seg}: starter bundle passes the rules engine with zero blocked items`, () => {
      const s = buildStarter(profile);
      expect(s.base.length).toBeGreaterThan(0);
      const everything = [...s.base, ...s.addons].map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
      const r = checkBundle(profile, everything);
      expect(r.blocked).toHaveLength(0);
      expect(r.fixes).toHaveLength(0); // dependencies already satisfied
    });
  }

  it("has only one internet plan and one SIM plan in the base bundle", () => {
    for (const profile of Object.values(TYPICAL)) {
      const ids = buildStarter(profile).base.map((b) => b.product_id);
      expect(ids.filter((i) => ["P01", "P02", "P03", "P04", "P05", "P06"].includes(i)).length).toBeLessThanOrEqual(1);
      expect(ids.filter((i) => ["P07", "P08"].includes(i)).length).toBeLessThanOrEqual(1);
    }
  });

  it("tier-2 micro shop without GST gets no Fibre 1G and no WhatsApp API anywhere", async () => {
    const res = await request(app)
      .post("/api/bundles/starter")
      .send({ segment: "micro", city_tier: 2, employee_count: 3, num_sites: 1, has_valid_active_gstin: false });
    expect(res.status).toBe(200);
    const offered = [...res.body.base, ...res.body.addons, ...res.body.more].map((i: { product_id: string }) => i.product_id);
    expect(offered).not.toContain("P03");
    expect(offered).not.toContain("P15");
    const blockedIds = res.body.blocked.map((b: { product_id: string }) => b.product_id);
    expect(blockedIds).toContain("P03");
    expect(blockedIds).toContain("P15");
    const p15 = res.body.blocked.find((b: { product_id: string }) => b.product_id === "P15");
    expect(p15.reason_en).toBe("Needs a GST number");
    expect(p15.reason_hi).toBeTruthy();
  });

  it("explains where the bundle comes from and uses the config thresholds", () => {
    const s = buildStarter(TYPICAL.micro);
    expect(s.based_on.line_en).toMatch(/^Based on \d+ similar .* that stayed with us$/);
    for (const b of s.base) expect(b.share).toBeGreaterThanOrEqual(STARTER_CONFIG.baseMinShare);
    for (const a of s.addons) {
      expect(a.share).toBeGreaterThanOrEqual(STARTER_CONFIG.addonMinShare);
      expect(a.share).toBeLessThan(STARTER_CONFIG.baseMinShare);
    }
  });

  it("rejects an invalid profile", async () => {
    const res = await request(app).post("/api/bundles/starter").send({ segment: "nope" });
    expect(res.status).toBe(400);
  });
});

describe("product copy", () => {
  it("every catalogue product has English and Hindi text, and the catalogue API returns it", async () => {
    const res = await request(app).get("/api/catalogue");
    expect(res.body.products).toHaveLength(25);
    for (const p of res.body.products) {
      expect(p.copy.name_en).toBeTruthy();
      expect(p.copy.name_hi).toBeTruthy();
      expect(p.copy.why_en).toBeTruthy();
      expect(p.copy.why_hi).toBeTruthy();
      expect(p.copy.name_en).not.toMatch(/\bP\d{2}\b/); // no product codes shown to customers
    }
  });
});
