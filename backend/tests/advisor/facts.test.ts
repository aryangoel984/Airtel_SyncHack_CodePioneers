// Details code reads from a message by itself, so a small or rate-limited model can't miss them.
import { describe, it, expect } from "vitest";
import { extractBusinessType, extractFacts, lookupCity, mapBusinessType } from "../../src/lib/advisor/mapping";
import { buildRecommendation } from "../../src/lib/advisor/recommend";
import { AdvisorProfile } from "../../src/lib/advisor/session";

describe("extractFacts", () => {
  const cases: [string, object][] = [
    ["Kirana shop in Agra, 2 staff, one shop, no GST. Need internet for UPI payments.", { employee_count: 2, num_sites: 1, has_gstin: false }],
    ["Small salon in Indore, 3 people, one shop, no GST. My budget is 1000 rupees a month.", { employee_count: 3, num_sites: 1, has_gstin: false, budget_per_month: 1000 }],
    ["Restaurant chain with 5 outlets in Bengaluru, about 60 staff, GST registered.", { employee_count: 60, num_sites: 5, has_gstin: true }],
    ["माझे मेडिकल स्टोअर पुण्यात आहे, 2 लोक काम करतात, एकच दुकान, GST आहे.", { employee_count: 2, num_sites: 1, has_gstin: true }],
    ["bhai mera kirana h meerut me 3 log h gst nai h sasta plan bata", { employee_count: 3, has_gstin: false }],
    ["नमस्ते, मेरी किराना दुकान लखनऊ में है। 2 लोग काम करते हैं, एक ही दुकान है। GST नंबर नहीं है", { employee_count: 2, num_sites: 1, has_gstin: false }],
    ["We are a bakery, 4-5 people, 2-3 shops in Nashik, GST yes.", { employee_count: 5, num_sites: 3, has_gstin: true }],
    ["mera budget 2000 tak hai, 1 dukaan, GST hai", { num_sites: 1, has_gstin: true, budget_per_month: 2000 }],
  ];
  for (const [text, want] of cases) it(text.slice(0, 50), () => expect(extractFacts(text)).toEqual(want));

  it("ignores numbers that are not people or locations", () => {
    expect(extractFacts("I want 2 SIMs and 3 cameras")).toEqual({});
    expect(extractFacts("Jio gives 100 Mbps for 699. Why should I pay more?")).toEqual({});
    expect(extractFacts("minus five staff")).toEqual({});
  });
});

describe("cities outside the dataset", () => {
  it("metro-area satellites are tier 1, other known cities tier 2", () => {
    expect(lookupCity("Gurgaon")).toEqual({ city: "Gurugram", tier: 1 });
    expect(lookupCity("noida sector 62")).toEqual({ city: "Noida", tier: 1 });
    expect(lookupCity("Agra, UP")).toEqual({ city: "Agra", tier: 2 });
    expect(lookupCity("आगरा")).toEqual({ city: "Agra", tier: 2 });
  });
});

describe("plan shape fixes", () => {
  const mk = (o: Partial<AdvisorProfile>): AdvisorProfile => ({ wishes: [], language: "en", segment_from_type: "prof", employee_count: 6, num_sites: 1, city: "Pune", city_tier: 1, has_gstin: true, ...o });
  const internet = ["P01", "P02", "P03", "P04", "P05", "P06"];
  it("asking for 'internet' never adds a second connection", () => {
    const r = buildRecommendation(mk({ wishes: ["email", "internet"] }), { wishes: ["email", "internet"] }, 1);
    expect(r.items.filter((i) => internet.includes(i.product_id))).toHaveLength(1);
  });
  it("'email for everyone' covers every person", () => {
    const r = buildRecommendation(mk({ wishes: ["email"] }), { wishes: ["email"] }, 1);
    expect(r.items.find((i) => i.product_id === "P16")?.quantity).toBe(6);
  });
  it("1 Gbps replaces the plan's connection instead of adding one", () => {
    const r = buildRecommendation(mk({ wishes: ["gigabit"], employee_count: 15 }), { wishes: ["gigabit"] }, 1);
    expect(r.items.filter((i) => internet.includes(i.product_id)).map((i) => i.product_id)).toEqual(["P03"]);
  });
  it("cameras for several outlets come in equal numbers per outlet", () => {
    const r = buildRecommendation(mk({ segment_from_type: "micro", employee_count: 60, num_sites: 5, wishes: ["cctv"] }), { wishes: ["cctv"] }, 1);
    expect((r.items.find((i) => i.product_id === "P23")?.quantity ?? 0) % 5).toBe(0);
  });
});

describe("business type read from the message", () => {
  const cases: [string, string, string][] = [
    ["Kirana shop in Agra, 2 staff", "kirana shop", "micro"],
    ["எனக்கு கோயம்புத்தூரில் ஒரு சலூன் உள்ளது", "சலூன்", "micro"],
    ["IT consultancy office in Gurugram", "it consultancy office", "prof"],
    ["माझे मेडिकल स्टोअर पुण्यात आहे", "मेडिकल स्टोअर", "micro"],
    ["We are a restaurant chain with 5 outlets", "restaurant chain", "multi"],
    ["Textile unit in Surat", "textile unit", "mfg"],
  ];
  for (const [text, type, seg] of cases) it(text, () => {
    expect(extractBusinessType(text)).toBe(type);
    expect(mapBusinessType(type)).toBe(seg);
  });
  it("finds nothing in messages without a business", () => {
    expect(extractBusinessType("Who will win the IPL?")).toBeNull();
    expect(extractBusinessType("I want to talk to a real person")).toBeNull();
  });
});
