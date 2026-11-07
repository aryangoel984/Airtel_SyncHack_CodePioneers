import { NextResponse } from "next/server";
import { buildQuote } from "@/lib/quote";

// POST { profile: {...}, items: [{product_id, quantity}] } -> priced quote
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.profile || !Array.isArray(body?.items)) {
    return NextResponse.json({ error: "Expected { profile, items[] }" }, { status: 400 });
  }
  return NextResponse.json(buildQuote(body.profile, body.items));
}
