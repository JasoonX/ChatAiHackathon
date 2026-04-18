"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { disconnectSocket } from "@/lib/socket-client";

export function LogoutButton({ iconOnly = false }: { iconOnly?: boolean }) {
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

  if (iconOnly) {
    return (
      <button
        type="button"
        title={isPending ? "Signing out…" : "Sign out"}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
        onClick={handleSignOut}
        disabled={isPending}
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
      onClick={handleSignOut}
      disabled={isPending}
    >
      <LogOut className="h-3.5 w-3.5 shrink-0" />
      <span>{isPending ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
