// Code saves clear details by itself, so a weak, lazy or rate-limited model can't lose them.
import { describe, it, expect, beforeEach } from "vitest";
import { handleChat } from "../../src/lib/advisor/engine";
import { setLlmClient, LlmUnavailableError } from "../../src/lib/advisor/llm";
import { _clearSessions } from "../../src/lib/advisor/session";
import { FakeLlm, say, toolCall, useTools } from "./fakeLlm";

beforeEach(() => { _clearSessions(); setLlmClient(null); });

describe("safety net", () => {
  it("a model that never calls update_profile still gets every detail saved", async () => {
    setLlmClient(new FakeLlm(() => say("Thanks!")));
    const r = await handleChat({ message: "Kirana shop in Agra, 2 staff, one shop, no GST. Need internet for UPI payments." });
    expect(r.profile).toMatchObject({ business_type: "kirana shop", segment: "micro", employee_count: 2, num_sites: 1, city: "Agra", city_tier: 2, has_gst: false });
    expect(r.missingSlots).toEqual([]);
  });

  it("guided mode (AI down) picks up a correction: 12 people and 2 centres", async () => {
    setLlmClient(new FakeLlm(() => new LlmUnavailableError("down")));
    const first = await handleChat({ message: "Coaching centre in Hyderabad, 6 teachers, 1 centre, GST yes." });
    expect(first.profile).toMatchObject({ employee_count: 6, num_sites: 1, has_gst: true });
    const r = await handleChat({ sessionId: first.sessionId, message: "Sorry, actually we are 12 people and we have 2 centres." });
    expect(r.profile).toMatchObject({ employee_count: 12, num_sites: 2 });
  });

  it("a model's guessed 'only these' is ignored unless the customer said only/just/sirf", async () => {
    const llm = new FakeLlm((_m, msgs) => msgs[msgs.length - 1].role === "tool" ? say("Here you go.") : useTools(toolCall("get_recommendation", { only_these: true })));
    setLlmClient(llm);
    const r = await handleChat({ message: "Restaurant chain with 5 outlets in Bengaluru, about 60 staff, GST registered. We want one bill and CCTV in every outlet." });
    expect(r.recommendation?.minimal).toBe(false);
    expect(r.profile.segment).toBe("multi");
  });

  it("a business that is too large asks for an expert even if the model forgets", async () => {
    setLlmClient(new FakeLlm(() => say("Okay.")));
    const r = await handleChat({ message: "We have 40 branches across India and 800 employees." });
    expect(r.handoff).toBeTruthy();
  });
});
