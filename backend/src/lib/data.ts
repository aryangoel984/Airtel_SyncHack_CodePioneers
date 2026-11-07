// Typed data layer: loads the CSVs once (at first use) and keeps them in memory.
import fs from "fs";
import path from "path";
import Papa from "papaparse";

// ---------- Types ----------
export interface Product {
  product_id: string;
  category: string;
  product_name: string;
  description: string;
  unit: string;
  price_min_inr_per_month: number;
  price_max_inr_per_month: number;
  one_time_setup_inr: number;
  min_contract_months: number;
  available_city_tiers: number[]; // "1;2" -> [1, 2]
  min_employees: number;
  min_sites: number;
  requires_gstin: boolean; // "Y" -> true
  requires_one_of: string[]; // "P01|P02" -> ["P01","P02"]
  typical_install_days: number;
  target_segments: string[]; // "micro;prof" -> ["micro","prof"]
}

export interface GstinRecord {
  gstin: string;
  legal_name: string;
  trade_name: string;
  constitution: string;
  principal_place_of_business: string;
  state: string;
  registration_date: string;
  status: string; // Active | Cancelled | Suspended
}

export interface UdyamRecord {
  udyam_number: string;
  enterprise_name: string;
  enterprise_type: string;
  major_activity: string;
  nic_description: string;
  state: string;
  city: string;
  date_of_registration: string;
}

export interface Lead {
  lead_id: string;
  created_date: string;
  business_name: string;
  segment: string;
  city_tier: number;
  state: string;
  preferred_language: string;
  employee_count: number;
  num_sites: number;
  has_gstin: boolean;
  gstin: string;
  has_udyam: boolean;
  udyam_number: string;
  stage_reached: string;
  outcome: string; // Activated | Dropped
  bundle_products: string; // raw "P01x1;P07x2"
  monthly_bundle_value_inr: number | null;
  churned_within_6_months: boolean; // only meaningful for activated leads
}

// ---------- Helpers ----------
const DATA_DIR = path.join(process.cwd(), "data");

function readCsv(file: string): Record<string, string>[] {
  const text = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
  return Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  }).data;
}

const splitList = (s: string, sep: string) =>
  (s ?? "").split(sep).map((x) => x.trim()).filter(Boolean);

const num = (s: string) => (s === "" || s == null ? 0 : Number(s));

// ---------- Loaders (cached in memory after the first call) ----------
let _products: Product[] | null = null;
let _gstin: Map<string, GstinRecord> | null = null;
let _udyam: Map<string, UdyamRecord> | null = null;
let _leads: Lead[] | null = null;

export function loadProducts(): Product[] {
  if (_products) return _products;
  _products = readCsv("product_catalogue.csv").map((r) => ({
    product_id: r.product_id,
    category: r.category,
    product_name: r.product_name,
    description: r.description,
    unit: r.unit,
    price_min_inr_per_month: num(r.price_min_inr_per_month),
    price_max_inr_per_month: num(r.price_max_inr_per_month),
    one_time_setup_inr: num(r.one_time_setup_inr),
    min_contract_months: num(r.min_contract_months),
    available_city_tiers: splitList(r.available_city_tiers, ";").map(Number),
    min_employees: num(r.min_employees),
    min_sites: num(r.min_sites),
    requires_gstin: r.requires_gstin === "Y",
    requires_one_of: splitList(r.requires_one_of, "|"),
    typical_install_days: num(r.typical_install_days),
    target_segments: splitList(r.target_segments, ";"),
  }));
  return _products;
}

export function getProduct(id: string): Product | undefined {
  return loadProducts().find((p) => p.product_id === id);
}

export function loadGstinRegistry(): Map<string, GstinRecord> {
  if (_gstin) return _gstin;
  _gstin = new Map();
  for (const r of readCsv("mock_gstin_registry.csv")) {
    _gstin.set(r.gstin, r as unknown as GstinRecord);
  }
  return _gstin;
}

export function loadUdyamRegistry(): Map<string, UdyamRecord> {
  if (_udyam) return _udyam;
  _udyam = new Map();
  for (const r of readCsv("mock_udyam_registry.csv")) {
    _udyam.set(r.udyam_number, r as unknown as UdyamRecord);
  }
  return _udyam;
}

export function loadLeads(): Lead[] {
  if (_leads) return _leads;
  _leads = readCsv("smb_leads.csv").map((r) => ({
    lead_id: r.lead_id,
    created_date: r.created_date,
    business_name: r.business_name,
    segment: r.segment,
    city_tier: num(r.city_tier),
    state: r.state,
    preferred_language: r.preferred_language,
    employee_count: num(r.employee_count),
    num_sites: num(r.num_sites),
    has_gstin: r.has_gstin === "Y",
    gstin: r.gstin,
    has_udyam: r.has_udyam === "Y",
    udyam_number: r.udyam_number,
    stage_reached: r.stage_reached,
    outcome: r.outcome,
    bundle_products: r.bundle_products,
    monthly_bundle_value_inr: r.monthly_bundle_value_inr
      ? num(r.monthly_bundle_value_inr)
      : null,
    churned_within_6_months: r.churned_within_6_months === "Y",
  }));
  return _leads;
}

/** Parse "P01x1;P07x2" into [{product_id:"P01",quantity:1}, ...] */
export function parseBundle(s: string): { product_id: string; quantity: number }[] {
  return splitList(s, ";").map((part) => {
    const [product_id, qty] = part.split("x");
    return { product_id, quantity: Number(qty) || 1 };
  });
}
