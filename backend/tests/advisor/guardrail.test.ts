import { describe, it, expect } from "vitest";
import { checkReply, collectAmounts } from "../../src/lib/advisor/guardrail";

const ctx = (amounts: number[] = [], blocked: string[] = []) => ({ allowedAmounts: new Set(amounts), blockedNames: blocked, checkNames: true });

describe("output guardrail", () => {
  it("passes a clean reply with real prices", () => {
    expect(checkReply("Your plan is ₹1,896 per month, ready by 20 Jul 2026.", ctx([1896])).ok).toBe(true);
  });
  it("catches an invented price", () => {
    const r = checkReply("This will cost only ₹499 a month!", ctx([1896]));
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toBe("invented_amount:499");
  });
  it("catches prices written as Rs, rupees or per month", () => {
    expect(checkReply("Rs. 750 only", ctx([])).ok).toBe(false);
    expect(checkReply("750 rupees", ctx([])).ok).toBe(false);
    expect(checkReply("about 750 per month", ctx([])).ok).toBe(false);
  });
  it("catches a product code", () => {
    expect(checkReply("I suggest P01 for you", ctx()).problems).toContain("product_code");
  });
  it("catches leaked reasoning", () => {
    expect(checkReply("The user wants CCTV, so we need to call get_recommendation.", ctx()).problems).toContain("leaked_reasoning");
    expect(checkReply("<think>hmm</think> Hello", ctx()).problems).toContain("leaked_reasoning");
    expect(checkReply("analysis: they said 3 staff", ctx()).problems).toContain("leaked_reasoning");
  });
  it("catches offering something we don't sell, but allows a polite decline", () => {
    expect(checkReply("Sure, we can give you a DTH connection.", ctx()).problems).toContain("offers_unsold_item");
    expect(checkReply("Sorry, we do not offer DTH TV.", ctx()).ok).toBe(true);
  });
  it("catches recommending a product the customer can't have, but allows explaining why it's blocked", () => {
    const c = ctx([], ["Ultra-fast Internet 1 Gbps"]);
    expect(checkReply("I recommend Ultra-fast Internet 1 Gbps for you.", c).problems[0]).toMatch(/blocked_product/);
    expect(checkReply("Ultra-fast Internet 1 Gbps is only available in big cities.", c).ok).toBe(true);
  });
  it("rejects an empty reply", () => {
    expect(checkReply("   ", ctx()).ok).toBe(false);
  });
  it("collects numbers from nested tool results", () => {
    const set = collectAmounts({ a: 1999, b: [{ c: "₹2,500 total" }] });
    expect(set.has(1999)).toBe(true);
    expect(set.has(2500)).toBe(true);
  });
});
