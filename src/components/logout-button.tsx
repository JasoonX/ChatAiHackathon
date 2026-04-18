"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleSignOut = async () => {
    setIsPending(true);

    const { error } = await authClient.signOut();

    setIsPending(false);

    if (error) {
      toast.error(error.message ?? "Unable to sign out");
      return;
    }

    router.replace("/login");
    router.refresh();
  };

  return (
    <Button variant="outline" onClick={handleSignOut} disabled={isPending}>
      {isPending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
