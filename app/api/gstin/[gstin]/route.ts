import { NextResponse } from "next/server";
import { lookupGstin } from "@/lib/lookups";
import { maskId } from "@/lib/mask";

export async function GET(_req: Request, { params }: { params: Promise<{ gstin: string }> }) {
  const { gstin } = await params;
  const result = lookupGstin(gstin);
  console.log(`[gstin lookup] ${maskId(result.gstin)} valid=${result.valid} found=${result.found}`); // masked only
  return NextResponse.json(result, { status: result.valid ? 200 : 400 });
}
