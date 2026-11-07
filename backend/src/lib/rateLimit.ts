// Tiny per-IP rate limiter (sliding window, in memory). Protects the Groq key on a public demo.
import { NextFunction, Request, Response } from "express";

export function rateLimit(opts: { windowMs: number; maxRequests: number }) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = req.ip ?? "unknown";
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < opts.windowMs);
    if (recent.length >= opts.maxRequests) {
      const retry = Math.ceil((opts.windowMs - (now - recent[0])) / 1000);
      res.setHeader("Retry-After", String(retry));
      return res.status(429).json({ error: "Too many messages. Please wait a moment and try again.", retryAfterSeconds: retry });
    }
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < opts.windowMs)) hits.delete(k); // keep memory small
    next();
  };
}
