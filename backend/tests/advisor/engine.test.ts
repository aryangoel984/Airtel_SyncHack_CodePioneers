import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleChat, startSession } from "../../src/lib/advisor/engine";
import { setLlmClient, LlmUnavailableError } from "../../src/lib/advisor/llm";
import { _clearSessions, getSession } from "../../src/lib/advisor/session";
import { FakeLlm, say, toolCall, useTools } from "./fakeLlm";

const PRIMARY = "openai/gpt-oss-120b";
const FALLBACK = "openai/gpt-oss-20b";

beforeEach(() => { _clearSessions(); setLlmClient(null); });

// A scripted "model" that, on the first call, saves all the details and asks for a recommendation,
// and on the next call writes a friendly answer.
const fullProfileCalls = () => useTools(
  toolCall("update_profile", { business_type: "kirana store", employee_count: 2, num_sites: 1, city: "Lucknow", has_gstin: false, language: "hi" }),
  toolCall("get_recommendation", {}),
);

describe("advisor engine with a mocked Groq", () => {
  it("runs the tool loop: saves the profile and returns a structured recommendation", async () => {
    const llm = new FakeLlm((_m, msgs, n) => (n === 1 ? fullProfileCalls() : say("Here is your plan.")));
    setLlmClient(llm);
    const r = await handleChat({ message: "kirana, 2 log, Lucknow, no GST" });
    expect(r.mode).toBe("ai");
    expect(r.modelUsed).toBe(PRIMARY);
    expect(r.reply).toBe("Here is your plan.");
    expect(r.profile).toMatchObject({ segment: "micro", employee_count: 2, num_sites: 1, city: "Lucknow", city_tier: 2, has_gst: false });
    expect(r.missingSlots).toEqual([]);
    expect(r.recommendation?.items.length).toBeGreaterThan(0);
    // the tool result (not the model) carried the numbers
    const toolMsg = llm.calls[1].messages.find((m) => m.role === "tool" && m.content?.includes("monthly_total_inr"));
    expect(toolMsg).toBeTruthy();
  });

  it("the LLM never sees a GSTIN, Aadhaar, mobile number or email", async () => {
    const llm = new FakeLlm(() => say("Thanks!"));
    setLlmClient(llm);
    await handleChat({ message: "gstin 03PJNXS4821G1ZB, aadhaar 1234 5678 9012, mobile 9876543210, ram@example.com" });
    const sent = JSON.stringify(llm.calls.map((c) => c.messages));
    expect(sent).not.toMatch(/03PJNXS4821G1ZB|1234 5678 9012|9876543210|ram@example\.com/);
    expect(sent).toContain("GSTIN_PROVIDED: Active, Saffron Bakers, Ludhiana, Punjab");
    expect(sent).toContain("[REDACTED]");
  });

  it("an Active GSTIN auto-fills business name, city and tier", async () => {
    setLlmClient(new FakeLlm(() => say("Welcome!")));
    const r = await handleChat({ message: "my GST is 03PJNXS4821G1ZB" });
    expect(r.profile).toMatchObject({ business_name: "Saffron Bakers", city: "Ludhiana", city_tier: 2, has_gst: true, gstin_status: "Active" });
    expect(r.missingSlots).not.toContain("city");
    expect(r.missingSlots).not.toContain("gst");
  });

  it("a Cancelled GSTIN counts as no valid GST", async () => {
    setLlmClient(new FakeLlm(() => say("Sorry, that GST is not active.")));
    const r = await handleChat({ message: "37IHKXV5167L1ZS" });
    expect(r.profile.gstin_status).toBe("Cancelled");
    expect(r.profile.has_gst).toBe(false);
  });

  it("a GSTIN with a bad checksum leaves GST unknown so we ask again", async () => {
    setLlmClient(new FakeLlm(() => say("Please re-check the number.")));
    const r = await handleChat({ message: "08YKZXS8189L1Z0" });
    expect(r.profile.gstin_status).toBe("checksum_failed");
    expect(r.missingSlots).toContain("gst");
  });

  it("falls back to gpt-oss-20b when the primary model throws", async () => {
    const llm = new FakeLlm((model) => (model === PRIMARY ? Object.assign(new Error("rate limited"), { status: 429 }) : say("Hello from the backup model")));
    setLlmClient(llm);
    const r = await handleChat({ message: "hi" });
    expect(r.mode).toBe("ai");
    expect(r.modelUsed).toBe(FALLBACK);
    expect(r.reply).toBe("Hello from the backup model");
    expect(llm.calls.map((c) => c.model)).toEqual([PRIMARY, FALLBACK]);
  });

  it("switches to guided mode when both models fail, then still reaches the same recommendation", async () => {
    setLlmClient(new FakeLlm(() => new Error("Groq is down")));
    let r = await handleChat({ message: "kirana store", language: "en" });
    expect(r.mode).toBe("guided");
    expect(r.modelUsed).toBeNull();
    expect(r.reply).toMatch(/simple mode/i);
    expect(r.quickReplies.length).toBeGreaterThan(0);
    const sid = r.sessionId;
    for (const answer of ["2 people", "1 location", "Lucknow", "No GST"]) {
      r = await handleChat({ sessionId: sid, message: answer });
      expect(r.reply, `after "${answer}"`).not.toMatch(/didn't catch/i); // every answer here is understood
    }
    expect(r.reply).toMatch(/nothing specific|anything specific/i); // asks about wishes last
    r = await handleChat({ sessionId: sid, message: "Nothing specific, show me a plan" });
    expect(r.recommendation).not.toBeNull();
    expect(r.recommendation!.items.map((i) => i.product_id)).not.toContain("P15"); // no WhatsApp API without GST
    expect(r.reply).toMatch(/Monthly total/);
  });

  it("guided mode works with no API key at all", async () => {
    // (the vitest config sets GROQ_API_KEY to empty, and no client is plugged in)
    const r = await handleChat({ message: "clinic", language: "hi" });
    expect(r.mode).toBe("guided");
    expect(r.reply).toContain("सरल मोड");
  });

  it("guided mode handles 'only a mobile plan' and a bigger shop", async () => {
    setLlmClient(new FakeLlm(() => new Error("down")));
    let r = await handleChat({ message: "pharmacy" });
    const sid = r.sessionId;
    for (const a of ["1 (just me)", "1 location", "big metro city", "No GST"]) r = await handleChat({ sessionId: sid, message: a });
    r = await handleChat({ sessionId: sid, message: "sirf mobile plan chahiye" });
    expect(r.recommendation?.items.map((i) => i.product_id)).toEqual(["P07"]);
  });

  describe("guardrail", () => {
    it("regenerates once when the first reply invents a price", async () => {
      const llm = new FakeLlm((_m, _msgs, n) => (n === 1 ? say("It is only ₹199 per month!") : say("Let me find the right plan for you.")));
      setLlmClient(llm);
      const r = await handleChat({ message: "how much?" });
      expect(r.reply).toBe("Let me find the right plan for you.");
      expect(r.guardrail.hits).toBe(1);
      expect(llm.calls).toHaveLength(2);
      expect(JSON.stringify(llm.calls[1].messages)).toContain("SERVER CORRECTION");
    });

    it("uses a safe template built from the structured plan when the LLM fails twice", async () => {
      const llm = new FakeLlm((_m, _msgs, n) => {
        if (n === 1) return fullProfileCalls();
        return say("Great, only ₹111 per month. Use P01 now."); // invented price + product code, every time
      });
      setLlmClient(llm);
      const r = await handleChat({ message: "kirana, 2 log, Lucknow, no GST" });
      expect(r.guardrail.hits).toBe(2);
      expect(r.reply).not.toMatch(/111|P01/);
      // (this scripted model switched the language to Hindi, so the template is in Hindi)
      expect(r.reply).toContain("₹" + r.recommendation!.quote.monthly_total_inr.toLocaleString("en-IN"));
      expect(r.reply).toContain("आपके बिज़नेस के लिए यह प्लान है");
    });

    it("catches leaked reasoning text", async () => {
      const llm = new FakeLlm((_m, _msgs, n) => (n <= 2 ? say("The user is asking about price, so we need to call get_recommendation.") : say("x")));
      setLlmClient(llm);
      const r = await handleChat({ message: "price?" });
      expect(r.reply).not.toMatch(/get_recommendation|The user/);
      expect(r.guardrail.hits).toBe(2);
    });
  });

  it("asking for a person creates a callback lead by code, even if the model forgets", async () => {
    setLlmClient(new FakeLlm(() => say("An expert will call you within 1 working day.")));
    const r = await handleChat({ message: "I want to talk to a person" });
    expect(r.handoff?.reason).toBe("user_asked");
    expect(r.handoff?.callbackId).toMatch(/^CB-/);
    expect(r.handoff?.needsMobile).toBe(true);
  });

  it("a very large business triggers a handoff but still gets an indicative plan", async () => {
    const llm = new FakeLlm((_m, _msgs, n) => (n === 1
      ? useTools(toolCall("update_profile", { business_type: "retail chain", employee_count: 400, num_sites: 30, city: "Delhi", has_gstin: true }), toolCall("get_recommendation", {}))
      : say("An expert will call you.")));
    setLlmClient(llm);
    const r = await handleChat({ message: "30 shops, 400 staff, Delhi, GST yes" });
    expect(r.handoff?.reason).toBe("too_large");
    expect(r.recommendation?.indicative).toBe(true);
    expect(r.recommendation!.items.length).toBeGreaterThan(0);
  });

  it("changing staff from 3 to 12 updates the recommendation", async () => {
    let step = 0;
    const llm = new FakeLlm((_m, msgs) => {
      const last = msgs[msgs.length - 1];
      if (last.role === "tool") return say("ok");
      step++;
      return step === 1
        ? useTools(toolCall("update_profile", { business_type: "coaching centre", employee_count: 3, num_sites: 1, city: "Delhi", has_gstin: true }), toolCall("get_recommendation", {}))
        : useTools(toolCall("update_profile", { employee_count: 12 }), toolCall("get_recommendation", {}));
    });
    setLlmClient(llm);
    const a = await handleChat({ message: "coaching, 3 staff, Delhi, GST" });
    const b = await handleChat({ sessionId: a.sessionId, message: "actually 12 staff" });
    expect(b.profile.employee_count).toBe(12);
    expect(b.recommendation!.id).toBeGreaterThan(a.recommendation!.id);
    expect(b.recommendation!.quote.monthly_total_inr).not.toBe(a.recommendation!.quote.monthly_total_inr);
  });

  it("invalid tool arguments are rejected, not saved", async () => {
    const llm = new FakeLlm((_m, msgs) => (msgs[msgs.length - 1].role === "tool" ? say("Sorry, how many people?") : useTools(toolCall("update_profile", { employee_count: -5, has_gstin: "maybe" }))));
    setLlmClient(llm);
    const r = await handleChat({ message: "minus five staff" });
    expect(r.profile.employee_count).toBeNull();
    expect(r.profile.has_gst).toBeNull();
  });

  it("session summary keeps no chat text and no identifiers", async () => {
    const fs = await import("fs");
    setLlmClient(new FakeLlm(() => say("Hello")));
    await handleChat({ message: "my gst is 03PJNXS4821G1ZB and secret-words-12345" });
    const saved = fs.readFileSync(process.env.ADVISOR_SESSIONS_FILE!, "utf8");
    expect(saved).not.toMatch(/03PJNXS4821G1ZB|secret-words/);
    expect(saved).toContain('"gstin_status": "Active"');
  });

  it("an unknown or expired session id starts a fresh session", async () => {
    setLlmClient(new FakeLlm(() => say("Hello")));
    const r = await handleChat({ sessionId: "does-not-exist", message: "hi" });
    expect(r.sessionId).not.toBe("does-not-exist");
  });

  it("start gives a greeting in the chosen language with no LLM call", () => {
    const llm = new FakeLlm(() => say("should not be called"));
    setLlmClient(llm);
    const r = startSession("ta");
    expect(r.reply).toContain("வணக்கம்");
    expect(llm.calls).toHaveLength(0);
    expect(getSession(r.sessionId)).toBeTruthy();
  });
});

describe("misc", () => {
  it("LlmUnavailableError is a real error class", () => {
    expect(new LlmUnavailableError("x")).toBeInstanceOf(Error);
    vi.restoreAllMocks();
  });
});
