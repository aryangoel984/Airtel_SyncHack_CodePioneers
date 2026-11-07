import { describe, it, expect } from "vitest";
import { buildRecommendation } from "../../src/lib/advisor/recommend";
import { AdvisorProfile } from "../../src/lib/advisor/session";
import { WISH_KEYS, WishKey } from "../../src/lib/advisor/mapping";
import { checkBundle } from "../../src/lib/rules";

const mk = (o: Partial<AdvisorProfile> = {}): AdvisorProfile => ({
  wishes: [], language: "en", segment_from_type: "micro", employee_count: 2, num_sites: 1,
  city: "Lucknow", city_tier: 2, has_gstin: false, ...o,
});
const ids = (r: ReturnType<typeof buildRecommendation>) => r.items.map((i) => i.product_id);

describe("get_recommendation", () => {
  it("never returns a blocked item, for any combination of profile and wishes", () => {
    const wishSets: WishKey[][] = [[], ["gigabit"], ["whatsapp", "sms"], ["cctv", "firewall", "iot"], [...WISH_KEYS].filter((w) => w !== "sim_only")];
    let checked = 0;
    for (const tier of [1, 2] as const) for (const gst of [true, false]) for (const emp of [1, 3, 15, 70]) for (const sites of [1, 2, 8])
      for (const seg of ["micro", "prof", "multi", "mfg"] as const) for (const wishes of wishSets) for (const only of [false, true]) {
        const p = mk({ segment_from_type: seg, city_tier: tier, has_gstin: gst, employee_count: emp, num_sites: sites });
        const r = buildRecommendation(p, { wishes, only_these: only && wishes.length > 0 }, 1);
        const check = checkBundle(r.profile, r.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })));
        expect(check.blocked, JSON.stringify({ tier, gst, emp, sites, seg, wishes })).toHaveLength(0);
        expect(check.fixes).toHaveLength(0); // every dependency is already in the plan
        checked++;
      }
    expect(checked).toBeGreaterThan(1000);
  });

  it("tier-2 micro shop without GST: no Fibre 1G, no WhatsApp API, no SMS; reasons are plain", () => {
    const r = buildRecommendation(mk(), { wishes: ["gigabit", "whatsapp", "sms"] }, 1);
    for (const bad of ["P03", "P15", "P14"]) expect(ids(r)).not.toContain(bad);
    const wa = r.blocked_wishes.find((b) => b.product_id === "P15")!;
    expect(wa.reason_en).toBe("Needs a GST number");
    expect(wa.alternative?.product_id).toBe("P18"); // website as the allowed alternative
    const fibre = r.blocked_wishes.find((b) => b.product_id === "P03")!;
    expect(fibre.reason_en).toMatch(/big cities/);
  });

  it("1 Gbps for a tier-2 clinic is blocked and the 300 Mbps plan is the alternative", () => {
    const p = mk({ segment_from_type: "prof", employee_count: 15, city: "Nagpur", has_gstin: true });
    const r = buildRecommendation(p, { wishes: ["gigabit"] }, 1);
    expect(ids(r)).not.toContain("P03");
    const b = r.blocked_wishes[0];
    expect(b.alternative?.product_id).toBe("P02");
    expect(b.alternative?.in_plan).toBe(true);
  });

  it("'only CCTV' gives CCTV plus the internet it needs, with the dependency marked", () => {
    const r = buildRecommendation(mk({ employee_count: 3 }), { wishes: ["cctv"], only_these: true }, 1);
    expect(ids(r)).toContain("P23");
    expect(r.items.filter((i) => i.role === "dependency")).toHaveLength(1);
    expect(r.quote.fixes).toHaveLength(1);
    expect(r.minimal).toBe(true);
    expect(r.items).toHaveLength(2);
  });

  it("'only a mobile plan' for a 1-person shop is a minimal SIM-only plan", () => {
    const r = buildRecommendation(mk({ employee_count: 1 }), { wishes: ["sim_only"] }, 1);
    expect(r.items.map((i) => [i.product_id, i.quantity])).toEqual([["P07", 1]]);
    expect(r.quote.monthly_total_inr).toBe(299);
    expect(r.minimal).toBe(true);
  });

  it("an 8-outlet chain with GST gets a multi-site plan with central management and backup internet", () => {
    const p = mk({ segment_from_type: "multi", employee_count: 70, num_sites: 8, city: "Kolkata", city_tier: 1, has_gstin: true });
    const r = buildRecommendation(p, {}, 1);
    expect(ids(r)).toContain("P10"); // managed network (SD-WAN)
    expect(ids(r)).toContain("P09"); // backup internet
  });

  it("a factory in a tier-2 city with GST gets a dedicated line and can add machine monitoring", () => {
    const p = mk({ segment_from_type: "mfg", employee_count: 85, city: "Surat", has_gstin: true });
    const r = buildRecommendation(p, { wishes: ["iot"] }, 1);
    expect(ids(r)).toContain("P05");
    expect(ids(r)).toContain("P24");
  });
});

describe("budget trimming", () => {
  it("drops wished add-ons (most expensive first) until the plan fits, and says which", () => {
    const p = mk({ segment_from_type: "prof", employee_count: 15, city_tier: 1, city: "Delhi", has_gstin: true });
    const full = buildRecommendation(p, { wishes: ["sms", "phone_lines"] }, 1);
    const base = buildRecommendation(p, {}, 1);
    const budget = base.quote.monthly_total_inr + 100; // room for neither wish
    const r = buildRecommendation(p, { wishes: ["sms", "phone_lines"], budget }, 1);
    expect(full.quote.monthly_total_inr).toBeGreaterThan(budget);
    expect(r.budget.within).toBe(true);
    expect(r.quote.monthly_total_inr).toBeLessThanOrEqual(budget);
    expect(r.dropped_for_budget.length).toBeGreaterThan(0);
    expect(r.dropped_for_budget[0].product_id).toBe("P12"); // 3 phone lines cost more than 1 SMS pack
  });

  it("falls back to the cheapest essentials when even the base is over budget", () => {
    const r = buildRecommendation(mk(), { budget: 1000 }, 1);
    expect(r.budget.within).toBe(true);
    expect(r.quote.monthly_total_inr).toBeLessThanOrEqual(1000);
    expect(r.items.length).toBeGreaterThan(0);
  });

  it("is honest when the budget is impossible", () => {
    const r = buildRecommendation(mk(), { budget: 200 }, 1);
    expect(r.budget.within).toBe(false);
    expect(r.budget.cheapest_possible_inr).toBe(299);
    expect(r.quote.monthly_total_inr).toBe(299);
  });
});
