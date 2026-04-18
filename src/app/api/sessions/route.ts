import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { sessions } from "@/db/schema/users";
import { getCurrentSession } from "@/server/auth";

function parseUserAgent(ua: string | null): { browser: string; os: string } {
  if (!ua) return { browser: "Unknown", os: "Unknown" };

  let browser = "Unknown";
  let os = "Unknown";

  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  return { browser, os };
}

export async function GET() {
  const currentSession = await getCurrentSession();
  if (!currentSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, currentSession.user.id));

  const result = rows.map((s) => {
    const { browser, os } = parseUserAgent(s.userAgent ?? null);
    return {
      id: s.id,
      ipAddress: s.ipAddress ?? null,
      browser,
      os,
      createdAt: s.createdAt.toISOString(),
      lastActiveAt: s.updatedAt.toISOString(),
      isCurrent: s.id === currentSession.session.id,
    };
  });

  result.sort((a, b) => {
    if (a.isCurrent) return -1;
    if (b.isCurrent) return 1;
    return (
      new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
  });

  return NextResponse.json({ sessions: result });
}
