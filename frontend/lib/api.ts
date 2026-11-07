// One small typed client for every backend call. Base URL comes from NEXT_PUBLIC_API_URL.
import type { BusinessProfile, EligibleProduct, GstinLookup } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Thrown when the backend can't be reached (down / network). */
export class BackendDownError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new BackendDownError("Cannot reach the server");
  }
  // GSTIN/Udyam lookups return useful JSON even on 400, so only fail on non-JSON.
  return (await res.json()) as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const api = {
  lookupGstin: (g: string) => request<GstinLookup>(`/api/gstin/${encodeURIComponent(g)}`),
  eligible: (p: BusinessProfile) => request<{ products: EligibleProduct[] }>("/api/eligible", post(p)),
};
