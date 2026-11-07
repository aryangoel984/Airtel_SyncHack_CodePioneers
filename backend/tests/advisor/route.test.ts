import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/server";
import { ADVISOR_CONFIG } from "../../src/lib/advisor/config";

describe("advisor API", () => {
  it("start -> chat (guided, no key) -> session view -> callback with masked mobile", async () => {
    const start = await request(app).post("/api/advisor/start").send({ language: "hi" });
    expect(start.status).toBe(200);
    expect(start.body.reply).toContain("नमस्ते");
    const sid = start.body.sessionId;

    const chat = await request(app).post("/api/advisor/chat").send({ sessionId: sid, message: "I want to talk to a person" });
    expect(chat.status).toBe(200);
    expect(chat.body.handoff.needsMobile).toBe(true);

    const view = await request(app).get(`/api/advisor/session/${sid}`);
    expect(view.status).toBe(200);

    const bad = await request(app).post("/api/advisor/callback").send({ sessionId: sid, mobile: "123" });
    expect(bad.status).toBe(400);
    const ok = await request(app).post("/api/advisor/callback").send({ sessionId: sid, mobile: "9876543221" });
    expect(ok.status).toBe(201);
    expect(ok.body.mobile_masked).toBe("98******21");
    expect(JSON.stringify(ok.body)).not.toContain("9876543221");
  });

  it("validates the chat body", async () => {
    expect((await request(app).post("/api/advisor/chat").send({})).status).toBe(400);
    expect((await request(app).post("/api/advisor/chat").send({ message: "x".repeat(ADVISOR_CONFIG.maxMessageChars + 1) })).status).toBe(400);
    expect((await request(app).get("/api/advisor/session/nope")).status).toBe(404);
  });

  it("rate-limits one IP", async () => {
    let last = 200;
    for (let i = 0; i < ADVISOR_CONFIG.rateLimit.maxRequests + 2; i++) last = (await request(app).post("/api/advisor/start").send({})).status;
    expect(last).toBe(429);
  });
});
