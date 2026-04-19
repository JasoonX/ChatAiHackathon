import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — Chatly",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      {/* Animated gradient blobs */}
      <div className="fixed inset-0">
        <div className="absolute -top-1/4 -right-1/4 h-[60vh] w-[60vh] rounded-full bg-orange-600/20 blur-[120px] animate-[drift_12s_ease-in-out_infinite]" />
        <div className="absolute -bottom-1/4 -left-1/4 h-[50vh] w-[50vh] rounded-full bg-blue-600/15 blur-[100px] animate-[drift_15s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-1/2 left-1/2 h-[40vh] w-[40vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/10 blur-[80px] animate-[pulse_8s_ease-in-out_infinite]" />
      </div>

      {/* Page content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
