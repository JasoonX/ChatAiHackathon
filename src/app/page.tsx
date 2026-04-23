import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import LandingPage from "./_landing";

export default async function HomePage() {
  const cookieStore = await cookies();

  if (cookieStore.has(SESSION_COOKIE_NAME)) {
    redirect("/chat");
  }

  return <LandingPage />;
}
