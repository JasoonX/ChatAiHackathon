import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { getCurrentUser } from "@/server/auth";
import { deleteUserAccount } from "@/server/account-deletion";

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteUserAccount(user.id);

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
