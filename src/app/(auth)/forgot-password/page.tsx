"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [isPending, setIsPending] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Reset password
          </CardTitle>
          <CardDescription>
            Enter your email to receive a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetUrl ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-secondary p-4 text-sm">
                <p className="mb-2 text-muted-foreground">
                  In production, this link would be sent to your email.
                </p>
                <a
                  href={resetUrl}
                  className="text-info hover:underline underline-offset-4 break-all"
                >
                  Click here to reset your password
                </a>
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setResetUrl(null);
                }}
              >
                Try another email
              </Button>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsPending(true);

                const formData = new FormData(e.currentTarget);
                const email = String(formData.get("email") ?? "");

                // Call better-auth's request-password-reset endpoint directly
                const resetRes = await fetch("/api/auth/request-password-reset", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email, redirectTo: "/reset-password" }),
                });

                if (!resetRes.ok) {
                  setIsPending(false);
                  toast.error("Something went wrong");
                  return;
                }

                // Fetch the mock reset URL from our in-memory store
                const res = await fetch(
                  `/api/auth/mock-reset-url?email=${encodeURIComponent(email)}`
                );

                if (res.ok) {
                  const data = await res.json();
                  setResetUrl(data.url);
                } else {
                  toast.error(
                    "If this email exists, a reset link would have been sent."
                  );
                }

                setIsPending(false);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link
              href="/login"
              className="text-info hover:underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
