import { describe, it, expect } from "vitest";
import { extractWishes, lookupCity, mapBusinessType, parseCount, parseTierWords, resolveSegment, validateSlots } from "../../src/lib/advisor/mapping";

describe("slot validation", () => {
  it("accepts good values", () => {
    const { fields, errors } = validateSlots({ employee_count: 5, num_sites: 2, has_gstin: true, city_tier: 2, wishes: ["cctv"], current_internet: "mobile_hotspot" });
    expect(errors).toEqual([]);
    expect(fields.employee_count).toBe(5);
    expect(fields.wishes).toEqual(["cctv"]);
  });
  it("rejects bad types and ranges", () => {
    const { fields, errors } = validateSlots({ employee_count: "five", num_sites: 0, has_gstin: "yes", city_tier: 3, wishes: ["free-1gbps"], budget_per_month: 5 });
    expect(errors.length).toBe(6);
    expect(fields).toEqual({});
  });
  it("rejects a decimal or huge number of staff", () => {
    expect(validateSlots({ employee_count: 4.5 }).errors).toHaveLength(1);
    expect(validateSlots({ employee_count: 1e9 }).errors).toHaveLength(1);
  });
});

describe("city -> tier", () => {
  it("uses the table built from the leads data", () => {
    expect(lookupCity("Lucknow")).toEqual({ city: "Lucknow", tier: 2 });
    expect(lookupCity("Kolkata")).toEqual({ city: "Kolkata", tier: 1 });
    expect(lookupCity("Nagpur")?.tier).toBe(2);
    expect(lookupCity("Surat")?.tier).toBe(2);
  });
  it("understands aliases, Hindi names and sentences", () => {
    expect(lookupCity("Bangalore")?.city).toBe("Bengaluru");
    expect(lookupCity("लखनऊ")?.city).toBe("Lucknow");
    expect(lookupCity("main Patna mein hoon")?.city).toBe("Patna");
  });
  it("returns null for an unknown city", () => {
    expect(lookupCity("Gorakhpur")).toBeNull();
  });
  it("reads 'big' or 'small' answers", () => {
    expect(parseTierWords("big metro city")).toBe(1);
    expect(parseTierWords("chhota shehar")).toBe(2);
    expect(parseTierWords("छोटा शहर")).toBe(2);
    expect(parseTierWords("banana")).toBeNull();
  });
});

describe("business type -> segment", () => {
  it("maps types from the leads data", () => {
    expect(mapBusinessType("Kirana store")).toBe("micro");
    expect(mapBusinessType("dental clinic")).toBe("prof");
    expect(mapBusinessType("textile unit")).toBe("mfg");
    expect(mapBusinessType("restaurant chain")).toBe("multi");
  });
  it("understands everyday words, Hindi included", () => {
    expect(mapBusinessType("meri kirana dukaan hai")).toBe("micro");
    expect(mapBusinessType("beauty parlour")).toBe("micro");
    expect(mapBusinessType("मेरी फैक्ट्री है")).toBe("mfg");
    expect(mapBusinessType("coaching")).toBe("prof");
  });
  it("returns null when it cannot tell", () => {
    expect(mapBusinessType("xyzzy")).toBeNull();
  });
  it("3 or more sites is always multi-site, whatever the type", () => {
    expect(resolveSegment("micro", 3)).toBe("multi");
    expect(resolveSegment("prof", 5)).toBe("multi");
    expect(resolveSegment("micro", 2)).toBe("micro");
    expect(resolveSegment("mfg", 1)).toBe("mfg");
  });
});

describe("wish synonyms (English, Hindi, Hinglish)", () => {
  it("maps cameras", () => {
    for (const t of ["I need a camera", "CCTV chahiye", "मुझे कैमरा चाहिए", "सीसीटीवी लगवाना है"]) expect(extractWishes(t)).toContain("cctv");
  });
  it("maps WhatsApp and billing", () => {
    expect(extractWishes("WhatsApp catalogue")).toContain("whatsapp");
    expect(extractWishes("व्हाट्सएप पर माल दिखाना है")).toContain("whatsapp");
    for (const t of ["billing machine", "POS", "UPI machine chahiye"]) expect(extractWishes(t)).toContain("billing");
  });
  it("understands 'only a mobile plan'", () => {
    expect(extractWishes("sirf mobile plan chahiye")).toEqual(["sim_only"]);
    expect(extractWishes("I just want a SIM")).toEqual(["sim_only"]);
    expect(extractWishes("सिर्फ़ मोबाइल प्लान")).toEqual(["sim_only"]);
  });
  it("maps 1 Gbps", () => {
    expect(extractWishes("I want 1 Gbps internet")).toEqual(["gigabit"]);
  });
  it("finds nothing in unrelated text", () => {
    expect(extractWishes("what is the cricket score")).toEqual([]);
  });
});

describe("vague counts", () => {
  it("takes the upper end of a range", () => {
    expect(parseCount("4-5 log")).toBe(5);
    expect(parseCount("15 people")).toBe(15);
    expect(parseCount("kuch log")).toBeNull();
  });
});
