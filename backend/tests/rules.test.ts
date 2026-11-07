import { describe, it, expect } from "vitest";
import { checkBundle, getEligibleProducts, defaultQuantity, BusinessProfile } from "@/lib/rules";
import { getProduct } from "@/lib/data";
import { buildQuote } from "@/lib/quote";

const base: BusinessProfile = {
  segment: "prof", city_tier: 1, employee_count: 20, num_sites: 1, has_valid_active_gstin: true,
};

describe("rules engine", () => {
  it("blocks P03 (Fibre 1G) for a tier-2 business", () => {
    const r = checkBundle({ ...base, city_tier: 2 }, [{ product_id: "P03", quantity: 1 }]);
    expect(r.blocked.map((b) => b.product_id)).toContain("P03");
    expect(r.blocked[0].reason).toMatch(/tier-1/);
  });
  it("suggests broadband when P23 (CCTV) has none", () => {
    const r = checkBundle(base, [{ product_id: "P23", quantity: 4 }]);
    expect(r.fixes).toHaveLength(1);
    expect(r.fixes[0].added_product_id).toBe("P04"); // cheapest eligible internet
    expect(r.allowed.map((a) => a.product_id).sort()).toEqual(["P04", "P23"]);
  });
  it("does not add anything when CCTV already has broadband", () => {
    const r = checkBundle(base, [{ product_id: "P01", quantity: 1 }, { product_id: "P23", quantity: 4 }]);
    expect(r.fixes).toHaveLength(0);
    expect(r.violation_count).toBe(0);
  });
  it("blocks P15 (WhatsApp API) without a GSTIN", () => {
    const r = checkBundle({ ...base, has_valid_active_gstin: false }, [{ product_id: "P15", quantity: 1 }]);
    expect(r.blocked[0].product_id).toBe("P15");
    expect(r.blocked[0].reason).toMatch(/GSTIN/);
  });
  it("getEligibleProducts respects size and tier", () => {
    const ids = getEligibleProducts({ ...base, city_tier: 2, employee_count: 3 }).map((p) => p.product_id);
    expect(ids).not.toContain("P03");
    expect(ids).not.toContain("P06");
    expect(ids).toContain("P01");
  });
  it("default quantities follow the unit", () => {
    const b = { ...base, employee_count: 200, num_sites: 3 };
    expect(defaultQuantity(getProduct("P01")!, b)).toBe(3); // per site
    expect(defaultQuantity(getProduct("P07")!, b)).toBe(50); // per line, capped
    expect(defaultQuantity(getProduct("P15")!, b)).toBe(1); // per account
  });
});

describe("quote", () => {
  it("prices lines, setup fees, contract and activation date", () => {
    const q = buildQuote(base, [{ product_id: "P01", quantity: 1 }, { product_id: "P23", quantity: 4 }]);
    expect(q.monthly_total_inr).toBe(999 + 4 * 199);
    expect(q.one_time_setup_total_inr).toBe(4 * 1800);
    expect(q.contract_months).toBe(12);
    expect(q.expected_activation_date).toBe("2026-07-20"); // 2026-07-15 + 5 days (Fibre 100 is the slowest)
  });
});
