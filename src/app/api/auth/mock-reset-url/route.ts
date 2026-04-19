import { NextRequest, NextResponse } from "next/server";

import { consumeResetUrl } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }
  const url = consumeResetUrl(email);
  if (!url) {
    return NextResponse.json({ error: "No reset URL found" }, { status: 404 });
  }
  return NextResponse.json({ url });
}
