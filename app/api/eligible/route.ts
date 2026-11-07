import { NextResponse } from "next/server";
import { getEligibleProducts, defaultQuantity } from "@/lib/rules";

// POST a business profile -> every product it can buy, with a suggested quantity.
export async function POST(req: Request) {
  const profile = await req.json().catch(() => null);
  if (!profile) return NextResponse.json({ error: "Expected a profile" }, { status: 400 });
  const products = getEligibleProducts(profile).map((p) => ({
    ...p,
    suggested_quantity: defaultQuantity(p, profile),
  }));
  return NextResponse.json({ products });
}
