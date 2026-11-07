import { describe, it, expect } from "vitest";
import { lookupGstin, lookupUdyam } from "@/lib/lookups";
import { validateGstin, validateUdyam, isAddressProofFresh } from "@/lib/validators";
import { maskId } from "@/lib/mask";

describe("GSTIN", () => {
  it("37IHKXV5167L1ZS is found but Cancelled -> not eligible", () => {
    const r = lookupGstin("37IHKXV5167L1ZS");
    expect(r.found).toBe(true);
    expect(r.eligible).toBe(false);
    expect(r.found && r.record.status).toBe("Cancelled");
  });
  it("08YKZXS8189L1Z0 fails the checksum (not a format error)", () => {
    const v = validateGstin("08YKZXS8189L1Z0");
    expect(v.valid).toBe(false);
    expect(!v.valid && v.reason).toBe("checksum_failed");
  });
  it("03PJNXS4821G1ZB is valid and Active", () => {
    const r = lookupGstin("03PJNXS4821G1ZB");
    expect(r.valid).toBe(true);
    expect(r.eligible).toBe(true);
    expect(r.found && r.record.status).toBe("Active");
  });
  it("reports bad format separately", () => {
    const v = validateGstin("ABC");
    expect(!v.valid && v.reason).toBe("bad_format");
  });
});

describe("Udyam / dates / masking", () => {
  it("accepts fake district code 00", () => {
    expect(validateUdyam("UDYAM-KL-00-3078801").valid).toBe(true);
    expect(lookupUdyam("UDYAM-KL-00-3078801").found).toBe(true);
  });
  it("rejects bad Udyam format", () => {
    expect(validateUdyam("UDYAM-K-00-123").valid).toBe(false);
  });
  it("address proof freshness uses 90 days before 2026-07-15", () => {
    expect(isAddressProofFresh("2026-06-01")).toBe(true);
    expect(isAddressProofFresh("2026-04-16")).toBe(true); // exactly 90 days
    expect(isAddressProofFresh("2026-04-15")).toBe(false); // 91 days
  });
  it("masks identifiers", () => {
    expect(maskId("03PJNXS4821G1ZB")).toBe("03PJ********1ZB");
  });
});
