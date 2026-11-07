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
export interface Order {
  id: string;
  createdAt: string;
  language: Lang;
  mobile_masked: string;
  profile: BusinessProfile;
  items: BundleItem[];
  quote: Quote;
  status: string;
  statusHistory: { status: string; at: string; note?: string }[];
}
