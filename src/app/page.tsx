import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

export default async function HomePage() {
  const cookieStore = await cookies();

  if (cookieStore.has(SESSION_COOKIE_NAME)) {
    redirect("/chat");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-[56px] font-bold tracking-[-0.02em] leading-tight">
        Chatty
      </h1>
      <p className="mt-3 max-w-md text-lg text-muted-foreground">
        Real-time chat for teams that move fast.
      </p>
      <div className="mt-10 flex gap-3">
        <Button asChild size="lg">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/register">Register</Link>
        </Button>
      </div>
    </main>
  );
}
