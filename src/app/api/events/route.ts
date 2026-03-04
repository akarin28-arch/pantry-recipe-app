import { NextResponse } from "next/server";

/**
 * Fallback analytics endpoint — logs events to stdout.
 * In production, pipe to a file, DB, or analytics service.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("[Event]", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
