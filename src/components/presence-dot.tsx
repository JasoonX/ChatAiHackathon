import type { PresenceStatus } from "@/lib/socket";

const dotStyles: Record<PresenceStatus, string> = {
  online: "bg-emerald-500",
  afk: "bg-amber-400",
  offline: "bg-muted-foreground/40",
};

const labels: Record<PresenceStatus, string> = {
  online: "Online",
  afk: "Away",
  offline: "Offline",
};

export function PresenceDot({
  status,
  className = "",
}: {
  status: PresenceStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotStyles[status]} ${className}`}
      title={labels[status]}
      aria-label={labels[status]}
    />
  );
}
