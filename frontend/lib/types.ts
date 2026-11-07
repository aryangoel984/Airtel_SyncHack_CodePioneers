// Response types copied from the backend (backend/src/lib/*.ts).
// KEEP IN SYNC by hand when the backend changes. The frontend has no business logic.

export interface BusinessProfile {
  segment: string;
  city_tier: number;
  employee_count: number;
  num_sites: number;
  has_valid_active_gstin: boolean;
}

export interface GstinRecord {
  gstin: string;
  legal_name: string;
  trade_name: string;
  constitution: string;
  principal_place_of_business: string;
  state: string;
  registration_date: string;
  status: string;
}

export interface GstinLookup {
  gstin: string;
  valid: boolean;
  found: boolean;
  eligible: boolean;
  error?: string;
  message: string;
  record?: GstinRecord;
}

export interface EligibleProduct {
  product_id: string;
  product_name: string;
  unit: string;
  price_min_inr_per_month: number;
  suggested_quantity: number;
}
