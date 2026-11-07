import { NextResponse } from "next/server";
import { lookupUdyam } from "@/lib/lookups";
import { maskId } from "@/lib/mask";

export async function GET(_req: Request, { params }: { params: Promise<{ udyam: string }> }) {
  const { udyam } = await params;
  const result = lookupUdyam(udyam);
  console.log(`[udyam lookup] ${maskId(result.udyam)} valid=${result.valid} found=${result.found}`); // masked only
  return NextResponse.json(result, { status: result.valid ? 200 : 400 });
}
