"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { UnreadProvider } from "@/components/unread-provider";

function handleUnauthorized() {
  // Avoid redirect loops — only redirect if we're not already on login/register
  if (
    typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/login") &&
    !window.location.pathname.startsWith("/register")
  ) {
    window.location.href = "/login";
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const redirecting = useRef(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              // Don't retry 401s — session is dead
              if (error instanceof Error && "status" in error && (error as { status: number }).status === 401) {
                return false;
              }
              return failureCount < 3;
            },
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  // Listen for 401 responses globally via a fetch interceptor
  useState(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401 && !redirecting.current) {
        const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : "";
        // Only intercept our API calls, not external requests
        if (url.startsWith("/api/") || url.startsWith(window.location.origin + "/api/")) {
          redirecting.current = true;
          handleUnauthorized();
        }
      }
      return response;
    };
  });

  return (
    <QueryClientProvider client={queryClient}>
      <UnreadProvider>{children}</UnreadProvider>
    </QueryClientProvider>
  );
}
