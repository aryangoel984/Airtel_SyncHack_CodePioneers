// Response types copied from the backend (backend/src/lib/*.ts).
// KEEP IN SYNC by hand when the backend changes. The frontend has no business logic.

export type Lang = "en" | "hi";

export interface BusinessProfile {
  segment: string; // micro | prof | multi | mfg
  city_tier: number; // 1 = big city, 2 = smaller city
  employee_count: number;
  num_sites: number;
  has_valid_active_gstin: boolean;
}

export interface BundleItem {
  product_id: string; // internal id: NEVER show to customers
  quantity: number;
}

export interface ProductCopy {
  name_en: string;
  name_hi: string;
  why_en: string;
  why_hi: string;
}

// ---- GSTIN lookup (dev page) ----
export interface GstinLookup {
  gstin: string;
  valid: boolean;
  found: boolean;
  eligible: boolean;
  error?: string;
  message: string;
  record?: Record<string, string>;
}

export interface EligibleProduct {
  product_id: string;
  product_name: string;
  unit: string;
  price_min_inr_per_month: number;
  suggested_quantity: number;
}

// ---- Starter bundle: POST /api/bundles/starter ----
export interface StarterItem {
  product_id: string;
  copy: ProductCopy;
  unit: string; // e.g. "per site"
  unit_price_inr: number;
  quantity: number; // suggested quantity
  monthly_inr: number;
  share?: number;
}

export interface BlockedProduct {
  product_id: string;
  copy: ProductCopy;
  reason: string;
  reason_en: string;
  reason_hi: string;
}

export interface StarterResponse {
  segment: string;
  based_on: { count: number; line_en: string; line_hi: string };
  base: StarterItem[];
  addons: StarterItem[];
  more: StarterItem[];
  blocked: BlockedProduct[];
  fixes: { for_product_id: string; added_product_id: string; message: string }[];
}

// ---- Quote: POST /api/quote ----
export interface QuoteLine {
  product_id: string;
  product_name: string; // internal catalogue name: do not show; use copy
  unit: string;
  quantity: number;
  unit_price_inr: number;
  monthly_inr: number;
  setup_inr: number;
  copy: ProductCopy;
}

export interface QuoteFix {
  for_product_id: string;
  added_product_id: string;
  message: string;
  for_copy: ProductCopy;
  added_copy: ProductCopy;
}

export interface QuoteBlocked {
  product_id: string;
  copy: ProductCopy;
  reason_en?: string;
  reason_hi?: string;
}

export interface Quote {
  lines: QuoteLine[];
  monthly_total_inr: number;
  one_time_setup_total_inr: number;
  contract_months: number;
  expected_activation_date: string; // YYYY-MM-DD
  install_days: number;
  blocked: QuoteBlocked[];
  fixes: QuoteFix[];
}

// ---- Orders: POST /api/orders, GET /api/orders/:id ----
export type OrderStatus =
  | "QUOTE_ACCEPTED" | "KYC_ACTION_NEEDED" | "KYC_REJECTED" | "KYC_VERIFIED"
  | "SITE_CHECK" | "TECH_SCHEDULED" | "INSTALLED" | "ACTIVE";

export interface OrderNotification { at: string; channel: "SMS" | "WhatsApp"; status: OrderStatus; text_en: string; text_hi: string }

export interface StageView {
  key: "QUOTE_ACCEPTED" | "KYC_VERIFIED" | "SITE_CHECK" | "TECH_SCHEDULED" | "INSTALLED" | "ACTIVE";
  state: "done" | "current" | "attention" | "blocked" | "upcoming";
  at: string | null;
  expected: string | null; // YYYY-MM-DD
}
export interface TrackerView { stages: StageView[]; progress: number; expected_live: string; canAdvance: boolean }

export interface Order {
  id: string;
  createdAt: string;
  language: Lang;
  mobile_masked: string;
  profile: BusinessProfile;
  items: BundleItem[];
  quote: Quote;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string; note?: string }[];
  kyc: KycPublic;
  tracker: TrackerView;
  notifications?: OrderNotification[];
}

// ---- Smart KYC: /api/kyc/* (mirrors backend/src/lib/kyc/types.ts) ----
export type DocType = "gst_certificate" | "udyam_certificate" | "signatory_id" | "address_proof";
export interface KycCheck { code: string; doc: DocType | "overall"; result: "pass" | "fail" | "warn"; severity?: "reject" | "fix"; en: string; hi: string }
export interface DocSummary { doc: DocType; provided: boolean; readable: boolean; confidence: number | null; rotated: boolean; fields: Record<string, string> }
export type KycVerdict = "VERIFIED" | "ACTION_NEEDED" | "REJECTED";
export interface KycResult {
  verdict: KycVerdict;
  checkedAt: string;
  business: { name: string | null; source: "gst" | "udyam" | null; gstin_masked: string | null; udyam_masked: string | null; gst_status: string | null };
  docs: DocSummary[];
  checks: KycCheck[];
  ocrMs: number;
}
export interface KycPublic {
  attempts: number;
  consent?: { accepted: true; at: string; version: string; language: Lang };
  result?: KycResult;
  digilocker?: { at: string };
  esign?: { at: string; name: string; otpSentTo: string };
  otpPending?: boolean;
}
export interface KycState { orderId: string; status: OrderStatus; kyc: KycPublic }
export interface KycSample { id: string; business: string; docs: DocType[] }

// ---- AI Advisor: /api/advisor/* (mirrors backend/src/lib/advisor/*) ----
export type ChatLang = "en" | "hi" | "hinglish" | "mr" | "ta" | "te" | "kn" | "gu" | "bn" | "pa" | "ml";

export interface QuickReply { label: string; value: string }

export interface RecItem {
  product_id: string; // internal: never shown
  copy: ProductCopy;
  unit: string;
  unit_price_inr: number;
  quantity: number;
  monthly_inr: number;
  setup_inr: number;
  role: "base" | "wish" | "dependency";
}

export interface BlockedWish {
  wish: string | null;
  product_id: string;
  copy: ProductCopy;
  reason_en: string;
  reason_hi: string;
  alternative: { product_id: string; copy: ProductCopy; unit: string; unit_price_inr: number; in_plan: boolean } | null;
}

export interface Recommendation {
  id: number;
  profile: BusinessProfile;
  items: RecItem[];
  quote: Quote;
  blocked_wishes: BlockedWish[];
  dropped_for_budget: { product_id: string; copy: ProductCopy }[];
  budget: { requested: number | null; within: boolean | null; cheapest_possible_inr: number | null };
  minimal: boolean;
  indicative: boolean;
  suggested_addons: { product_id: string; copy: ProductCopy; unit: string; unit_price_inr: number; quantity: number; monthly_inr: number }[];
  based_on: { count: number; line_en: string; line_hi: string } | null;
}

export interface AdvisorProfileView {
  business_type: string | null;
  segment: string | null;
  employee_count: number | null;
  num_sites: number | null;
  city: string | null;
  city_tier: number | null;
  has_gst: boolean | null;
  gstin_status: string | null;
  business_name: string | null;
  wishes: string[];
  budget_per_month: number | null;
  language: ChatLang;
}

export interface ChatResponse {
  sessionId: string;
  reply: string;
  quickReplies: QuickReply[];
  profile: AdvisorProfileView;
  missingSlots: string[];
  recommendation: Recommendation | null;
  handoff: { reason: string; callbackId: string; needsMobile: boolean } | null;
  mode: "ai" | "guided";
  modelUsed: string | null;
  guardrail: { hits: number };
  tokensUsed: number;
}
