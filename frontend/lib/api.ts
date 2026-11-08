// One small typed client for every backend call. Base URL comes from NEXT_PUBLIC_API_URL.
import type {
  BoSummary, ModelReport, QueueItem, Reengage, SystemStatus,
  BundleItem, BusinessProfile, ChatLang, ChatResponse, DocType, EligibleProduct, GstinLookup, KycSample, KycState, Lang, Order, Quote, StarterResponse,
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
    const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData; // file uploads set their own header
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: isForm ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
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
  advanceOrder: (id: string) => request<Order>(`/api/orders/${encodeURIComponent(id)}/advance`, { method: "POST" }),
  trackOrder: (orderId: string, mobile: string) => request<{ id: string }>("/api/orders/track", post({ orderId, mobile })),

  // ---- System status (is the AI live, is the OCR engine loaded?) ----
  status: () => request<SystemStatus>("/api/status"),

  // ---- Back office (staff PIN sent in a header) ----
  bo: (pin: string) => {
    const h = { headers: { "x-backoffice-pin": pin } };
    return {
      summary: () => request<BoSummary>("/api/backoffice/summary", h),
      queue: () => request<QueueItem[]>("/api/backoffice/queue", h),
      update: (id: string, change: Partial<Pick<QueueItem, "owner" | "status" | "note">>) =>
        request<QueueItem>(`/api/backoffice/queue/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(change), headers: { "x-backoffice-pin": pin } }),
      reveal: (id: string) => request<{ mobile: string }>(`/api/backoffice/queue/${encodeURIComponent(id)}/reveal`, { method: "POST", headers: { "x-backoffice-pin": pin } }),
      reengage: () => request<Reengage>("/api/backoffice/reengage", h),
      model: () => request<ModelReport>("/api/backoffice/model", h),
      demoReset: () => request<{ ok: boolean }>("/api/backoffice/demo-reset", { method: "POST", headers: { "x-backoffice-pin": pin } }),
    };
  },

  // ---- Smart KYC ----
  kycConsent: (id: string, language: Lang) => request<KycState>(`/api/kyc/${encodeURIComponent(id)}/consent`, post({ accepted: true, language })),
  kycDigilocker: (id: string) => request<KycState>(`/api/kyc/${encodeURIComponent(id)}/digilocker`, { method: "POST" }),
  kycVerify: (id: string, files: Partial<Record<DocType, File>>, opts: { noGst: boolean; noUdyam: boolean; gstin?: string }) => {
    const fd = new FormData();
    for (const [k, f] of Object.entries(files)) if (f) fd.append(k, f);
    fd.append("noGst", String(opts.noGst));
    fd.append("noUdyam", String(opts.noUdyam));
    if (opts.gstin) fd.append("gstin", opts.gstin);
    return request<KycState>(`/api/kyc/${encodeURIComponent(id)}/verify`, { method: "POST", body: fd });
  },
  kycEsignStart: (id: string) => request<{ sentTo: string; demoOtp: string }>(`/api/kyc/${encodeURIComponent(id)}/esign/start`, { method: "POST" }),
  kycEsignConfirm: (id: string, name: string, otp: string) => request<KycState>(`/api/kyc/${encodeURIComponent(id)}/esign/confirm`, post({ name, otp })),
  kycSamples: () => request<KycSample[]>("/api/kyc/samples"),
  kycSampleFile: async (sampleId: string, doc: DocType): Promise<File> => {
    const res = await fetch(`${API_URL}/api/kyc/samples/${sampleId}/${doc}`);
    if (!res.ok) throw new ApiError("Sample not found", res.status);
    return new File([await res.blob()], `${sampleId}_${doc}.png`, { type: "image/png" });
  },

  // ---- AI Advisor ----
  advisorStart: (language: ChatLang) => request<ChatResponse>("/api/advisor/start", post({ language })),
  advisorChat: (sessionId: string | undefined, message: string, language: ChatLang) =>
    request<ChatResponse>("/api/advisor/chat", post({ sessionId, message, language })),
  advisorEvent: (sessionId: string, event: "quote_opened" | "ordered") =>
    request<{ ok: boolean }>(`/api/advisor/session/${encodeURIComponent(sessionId)}/event`, post({ event })),
  advisorHandoff: (sessionId: string) =>
    request<{ callbackId: string; needsMobile: boolean }>("/api/advisor/handoff", post({ sessionId })),
  advisorCallback: (sessionId: string, mobile: string) =>
    request<{ callbackId: string; mobile_masked: string; message: string }>("/api/advisor/callback", post({ sessionId, mobile })),
};
