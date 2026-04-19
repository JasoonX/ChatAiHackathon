import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];
const PROTECTED_PREFIX = "/chat";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  // Authenticated users visiting login/register → send to app
  if (hasSession && PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  // Unauthenticated users visiting protected routes → send to login
  if (!hasSession && pathname.startsWith(PROTECTED_PREFIX)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/chat/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ],
};
