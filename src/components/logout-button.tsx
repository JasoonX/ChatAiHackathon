"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { disconnectSocket } from "@/lib/socket-client";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleSignOut = async () => {
    setIsPending(true);

    // Disconnect sockets server-side first (while session is still valid),
    // so presence goes to "offline" immediately instead of lingering as AFK.
    await fetch("/api/logout", { method: "POST" }).catch(() => {});

    const { error } = await authClient.signOut();

    setIsPending(false);

    if (error) {
      toast.error(error.message ?? "Unable to sign out");
      return;
    }

    disconnectSocket();
    router.replace("/login");
  };

  return (
    <Button variant="outline" onClick={handleSignOut} disabled={isPending}>
      {isPending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
