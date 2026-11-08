// Demo-day safety: a second Groq key takes over when the first one is rate-limited or out of daily quota.
import { describe, it, expect, beforeEach } from "vitest";
import { handleChat } from "../../src/lib/advisor/engine";
import { setLlmClient, llmStatus } from "../../src/lib/advisor/llm";
import { _clearSessions } from "../../src/lib/advisor/session";
import { FakeLlm, say } from "./fakeLlm";

const quota = () => Object.assign(new Error("Rate limit reached on tokens per day. Please try again in 7m30.5s."), { status: 429 });

beforeEach(() => { _clearSessions(); setLlmClient(null); });

describe("backup Groq key", () => {
  it("switches to the backup key when the main key is out of quota, then keeps using it", async () => {
    const main = new FakeLlm(() => quota());
    const spare = new FakeLlm(() => say("Hello from the backup key"));
    setLlmClient(main, spare);
    const r = await handleChat({ message: "hi" });
    expect(r.mode).toBe("ai");
    expect(r.reply).toBe("Hello from the backup key");
    expect(llmStatus.lastKey).toBe("backup");
    const mainCalls = main.calls.length; // primary + fallback on the main key
    await handleChat({ sessionId: r.sessionId, message: "kirana in Lucknow" });
    expect(main.calls.length).toBe(mainCalls); // main key is resting: not tried again
  });

  it("without a backup key it still falls back to guided mode", async () => {
    setLlmClient(new FakeLlm(() => Object.assign(new Error("server error"), { status: 500 })));
    const r = await handleChat({ message: "hi" });
    expect(r.mode).toBe("guided");
  });
});
