import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export default async function HomePage() {
  const cookieStore = await cookies();

  if (cookieStore.has(SESSION_COOKIE_NAME)) {
    redirect("/chat");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-16">
      <Card className="w-full max-w-2xl rounded-3xl shadow-sm">
        <CardHeader className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Hackathon starter
          </p>
          <CardTitle className="text-4xl font-semibold tracking-tight">
            Real-time chat app scaffold
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-w-xl text-muted-foreground">
            Landing page is in place. Authentication screens and protected chat
            flow are stubbed for Saturday implementation.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/register">Register</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
