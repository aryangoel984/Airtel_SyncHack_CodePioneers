// Step 3.5: when a customer asks for something they can't have (e.g. WhatsApp Business without GST),
// the reply must ALWAYS say so, even if the AI forgets. (This failed in the first live eval, scenario 2.)
import { describe, it, expect, beforeEach } from "vitest";
import { handleChat, ensureBlockedExplained } from "../../src/lib/advisor/engine";
import { setLlmClient, LlmUnavailableError } from "../../src/lib/advisor/llm";
import { _clearSessions } from "../../src/lib/advisor/session";
import { FakeLlm, say, toolCall, useTools } from "./fakeLlm";

beforeEach(() => { _clearSessions(); setLlmClient(null); });

const profileThenPlan = () => useTools(
  toolCall("update_profile", { business_type: "kirana store", employee_count: 2, num_sites: 1, city: "Lucknow", has_gstin: false }),
  toolCall("get_recommendation", {}),
);

describe("blocked wishes are always explained", () => {
  it("AI ignores the WhatsApp wish → code rebuilds the plan and adds the GST reason", async () => {
    // turn 1: model saves the profile and recommends. turn 2: model gives a vague answer and calls no tool.
    const llm = new FakeLlm((_m, _msgs, n) => (n === 1 ? profileThenPlan() : n === 2 ? say("Here is your plan.") : say("Your plan has fast internet, great for sharing photos.")));
    setLlmClient(llm);
    const r1 = await handleChat({ message: "kirana in Lucknow, 2 people, one shop, no GST" });
    expect(r1.recommendation).not.toBeNull();

    const r2 = await handleChat({ sessionId: r1.sessionId, message: "I want to show my catalogue to customers on WhatsApp" });
    expect(r2.recommendation?.blocked_wishes.map((b) => b.product_id)).toContain("P15");
    expect(r2.recommendation?.items.map((i) => i.product_id)).not.toContain("P15");
    expect(r2.reply).toMatch(/GST/);
    expect(r2.reply).toMatch(/isn't available/);
    // the AI was told about it too
    const lastPrompt = JSON.stringify(llm.calls[llm.calls.length - 1].messages);
    expect(lastPrompt).toContain("CANNOT have");
  });

  it("does not add a second explanation when the AI already explained it", async () => {
    const llm = new FakeLlm((_m, _msgs, n) => (n === 1 ? profileThenPlan() : n === 2 ? say("Plan ready.")
      : say("WhatsApp Business needs an active GST number, so I can't add it. Your plan stays the same.")));
    setLlmClient(llm);
    const r1 = await handleChat({ message: "kirana in Lucknow, 2 people, one shop, no GST" });
    const r2 = await handleChat({ sessionId: r1.sessionId, message: "add whatsapp please" });
    expect(r2.reply).not.toMatch(/isn't available/);
  });

  it("works in guided (no AI) mode too, in Hindi", async () => {
    setLlmClient(new FakeLlm(() => new LlmUnavailableError("down")));
    let r = await handleChat({ message: "kirana", language: "hi" });
    for (const m of ["2", "1", "लखनऊ", "नहीं", "कुछ खास नहीं"]) r = await handleChat({ sessionId: r.sessionId, message: m, language: "hi" });
    expect(r.recommendation).not.toBeNull();
    r = await handleChat({ sessionId: r.sessionId, message: "मुझे WhatsApp चाहिए", language: "hi" });
    expect(r.recommendation?.blocked_wishes.map((b) => b.product_id)).toContain("P15");
    expect(r.reply).toMatch(/GST|उपलब्ध नहीं/);
  });

  it("ensureBlockedExplained leaves replies alone when nothing is blocked", () => {
    expect(ensureBlockedExplained("Hello", [], "en")).toBe("Hello");
  });
});
