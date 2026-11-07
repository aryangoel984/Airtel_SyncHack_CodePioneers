import { describe, it, expect } from "vitest";
import { redactMessage } from "../../src/lib/advisor/redact";

describe("redaction before the LLM", () => {
  it("replaces an Active GSTIN with a token and fills in details", () => {
    const r = redactMessage("my gstin is 03PJNXS4821G1ZB ok");
    expect(r.safeText).not.toContain("03PJNXS4821G1ZB");
    expect(r.safeText).toContain("[GSTIN_PROVIDED: Active, Saffron Bakers, Ludhiana, Punjab]");
    expect(r.gstin).toMatchObject({ status: "Active", business_name: "Saffron Bakers", city: "Ludhiana", state: "Punjab", masked: "03PJ********1ZB" });
  });
  it("marks a Cancelled GSTIN", () => {
    const r = redactMessage("37IHKXV5167L1ZS");
    expect(r.gstin?.status).toBe("Cancelled");
    expect(r.safeText).toMatch(/GSTIN_PROVIDED: Cancelled/);
  });
  it("flags a checksum failure instead of looking it up", () => {
    const r = redactMessage("GST 08YKZXS8189L1Z0");
    expect(r.gstin?.status).toBe("checksum_failed");
    expect(r.safeText).not.toContain("08YKZXS8189L1Z0");
  });
  it("removes Aadhaar, PAN, mobile and email", () => {
    const r = redactMessage("aadhaar 1234 5678 9012, pan ABCDE1234F, call 9876543210, mail me at ram@example.com");
    expect(r.safeText).not.toMatch(/1234 5678 9012|ABCDE1234F|9876543210|ram@example\.com/);
    expect(r.safeText.match(/\[REDACTED\]/g)).toHaveLength(4);
    expect(r.redacted.sort()).toEqual(["aadhaar", "email", "mobile", "pan"]);
  });
  it("leaves normal numbers alone", () => {
    const r = redactMessage("12 staff, 3 shops, budget 5000");
    expect(r.safeText).toBe("12 staff, 3 shops, budget 5000");
    expect(r.redacted).toEqual([]);
  });
  it("never logs a full GSTIN", () => {
    const logged: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => logged.push(a.join(" "));
    redactMessage("03PJNXS4821G1ZB");
    console.log = orig;
    expect(logged.join("\n")).not.toContain("03PJNXS4821G1ZB");
  });
});
