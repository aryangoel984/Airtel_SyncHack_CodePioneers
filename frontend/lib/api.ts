// One small typed client for every backend call. Base URL comes from NEXT_PUBLIC_API_URL.
import type {
  BundleItem, BusinessProfile, EligibleProduct, GstinLookup, Lang, Order, Quote, StarterResponse,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Thrown when the backend can't be reached (it is down, or there is no network). */
export class BackendDownError extends Error {}
/** Thrown when the backend answered with an error (e.g. 400 / 404). `status` is the HTTP code. */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit, allowErrorBody = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new BackendDownError("Cannot reach the server");
  }
  let data: unknown = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  // GSTIN lookups return useful JSON even on 400, so those callers allow it.
  if (!res.ok && !allowErrorBody) {
    const msg = (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const api = {
  lookupGstin: (g: string) => request<GstinLookup>(`/api/gstin/${encodeURIComponent(g)}`, undefined, true),
  eligible: (p: BusinessProfile) => request<{ products: EligibleProduct[] }>("/api/eligible", post(p)),
  starter: (p: BusinessProfile) => request<StarterResponse>("/api/bundles/starter", post(p)),
  quote: (profile: BusinessProfile, items: BundleItem[]) => request<Quote>("/api/quote", post({ profile, items })),
  createOrder: (b: { profile: BusinessProfile; items: BundleItem[]; language: Lang; mobile: string }) =>
    request<Order>("/api/orders", post(b)),
  getOrder: (id: string) => request<Order>(`/api/orders/${encodeURIComponent(id)}`),
};
