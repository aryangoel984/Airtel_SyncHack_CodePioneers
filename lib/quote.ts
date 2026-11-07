// Quote calculator: runs the rules engine, then prices what is allowed.
import { getProduct } from "./data";
import { BusinessProfile, BundleItem, BlockedItem, Fix, checkBundle } from "./rules";
import { TODAY } from "./validators";

/**
 * ASSUMPTION: which end of the catalogue price range we quote.
 * "min" = price_min_inr_per_month (default), "max" = price_max_inr_per_month.
 * Change this one constant to switch.
 */
export const PRICE_BASIS: "min" | "max" = "min";

export interface QuoteLine {
  product_id: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price_inr: number;
  monthly_inr: number;
  setup_inr: number;
}

export interface Quote {
  lines: QuoteLine[];
  monthly_total_inr: number;
  one_time_setup_total_inr: number;
  contract_months: number;
  expected_activation_date: string; // YYYY-MM-DD
  install_days: number;
  blocked: BlockedItem[];
  fixes: Fix[];
}

export function buildQuote(profile: BusinessProfile, items: BundleItem[]): Quote {
  const rules = checkBundle(profile, items);
  const lines: QuoteLine[] = [];

  for (const item of rules.allowed) {
    const p = getProduct(item.product_id)!;
    const unit_price = PRICE_BASIS === "min" ? p.price_min_inr_per_month : p.price_max_inr_per_month;
    lines.push({
      product_id: p.product_id,
      product_name: p.product_name,
      unit: p.unit,
      quantity: item.quantity,
      unit_price_inr: unit_price,
      monthly_inr: unit_price * item.quantity,
      setup_inr: p.one_time_setup_inr * item.quantity, // setup fee is charged per unit
    });
  }

  const products = lines.map((l) => getProduct(l.product_id)!);
  const contract_months = Math.max(0, ...products.map((p) => p.min_contract_months));
  const install_days = Math.max(0, ...products.map((p) => p.typical_install_days));
  const activation = new Date(TODAY.getTime() + install_days * 86_400_000);

  return {
    lines,
    monthly_total_inr: lines.reduce((s, l) => s + l.monthly_inr, 0),
    one_time_setup_total_inr: lines.reduce((s, l) => s + l.setup_inr, 0),
    contract_months,
    expected_activation_date: activation.toISOString().slice(0, 10),
    install_days,
    blocked: rules.blocked,
    fixes: rules.fixes,
  };
}
