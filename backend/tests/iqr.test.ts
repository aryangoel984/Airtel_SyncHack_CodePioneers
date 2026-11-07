import { describe, it, expect } from "vitest";
import { buildStarter } from "../src/lib/starter";
import { BusinessProfile, segmentName } from "../src/lib/rules";
import { loadLeads } from "../src/lib/data";

// Typical profile per segment (tier 1, with GST) and the historic interquartile range (IQR)
// of monthly_bundle_value_inr for that segment (given by the project owner).
// `expected` is the verdict we currently get. micro and mfg come out BELOW the range: the range is for whole
// bundles (base + add-ons), while we compare only the base plan. We REPORT this instead of forcing the
// numbers. If the verdict changes (better or worse) this test fails, so the change gets noticed.
type Verdict = "inside range" | "BELOW range" | "ABOVE range";
const CASES: { seg: string; profile: BusinessProfile; iqr: [number, number]; expected: Verdict }[] = [
  { seg: "micro", expected: "BELOW range", iqr: [1862, 2995], profile: { segment: "micro", city_tier: 1, employee_count: 3, num_sites: 1, has_valid_active_gstin: true } },
  { seg: "prof", expected: "inside range", iqr: [4742, 8015], profile: { segment: "prof", city_tier: 1, employee_count: 15, num_sites: 1, has_valid_active_gstin: true } },
  { seg: "multi", expected: "inside range", iqr: [20975, 40430], profile: { segment: "multi", city_tier: 1, employee_count: 40, num_sites: 5, has_valid_active_gstin: true } },
  { seg: "mfg", expected: "BELOW range", iqr: [13330, 21250], profile: { segment: "mfg", city_tier: 1, employee_count: 60, num_sites: 1, has_valid_active_gstin: true } },
];

const quartile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q, lo = Math.floor(pos);
  return s[lo] + (s[Math.ceil(pos)] - s[lo]) * (pos - lo);
};

describe("starter base price vs historic interquartile range", () => {
  it("the IQR figures we were given match the data", () => {
    for (const c of CASES) {
      const vals = loadLeads()
        .filter((l) => l.outcome === "Activated" && l.segment === segmentName(c.seg) && l.monthly_bundle_value_inr != null)
        .map((l) => l.monthly_bundle_value_inr as number);
      expect(Math.round(quartile(vals, 0.25))).toBeGreaterThanOrEqual(c.iqr[0] - 5);
      expect(Math.round(quartile(vals, 0.25))).toBeLessThanOrEqual(c.iqr[0] + 5);
      expect(Math.round(quartile(vals, 0.75))).toBeGreaterThanOrEqual(c.iqr[1] - 5);
      expect(Math.round(quartile(vals, 0.75))).toBeLessThanOrEqual(c.iqr[1] + 5);
    }
  });

  for (const c of CASES) {
    it(`${c.seg}: base price vs ${c.iqr[0]}-${c.iqr[1]} is "${c.expected}"`, () => {
      const s = buildStarter(c.profile);
      const price = s.base.reduce((sum, i) => sum + i.monthly_inr, 0);
      const verdict: Verdict = price < c.iqr[0] ? "BELOW range" : price > c.iqr[1] ? "ABOVE range" : "inside range";
      console.log(`IQR CHECK ${c.seg}: base Rs ${price} vs ${c.iqr[0]}-${c.iqr[1]} -> ${verdict}`);
      expect(verdict).toBe(c.expected);
    });
  }
});
