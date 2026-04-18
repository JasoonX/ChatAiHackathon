import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

export function middleware(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*"],
};
