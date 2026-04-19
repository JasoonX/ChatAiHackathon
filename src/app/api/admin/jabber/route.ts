import { NextResponse } from "next/server";

import { getXmppStats } from "@/server/xmpp-bridge";

export async function GET() {
  return NextResponse.json(getXmppStats());
}
