import { NextResponse } from "next/server";
import { loadProducts } from "@/lib/data";

export async function GET() {
  return NextResponse.json({ products: loadProducts() });
}
