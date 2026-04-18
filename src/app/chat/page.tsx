import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export default async function ChatPage() {
  const cookieStore = await cookies();

  if (!cookieStore.has(SESSION_COOKIE_NAME)) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {"// TODO Saturday"}
        </CardContent>
      </Card>
    </main>
  );
}
