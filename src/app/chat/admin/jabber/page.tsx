"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface XmppStats {
  connected: boolean;
  domain: string;
  componentDomain: string;
  messagesForwardedToXmpp: number;
  messagesReceivedFromXmpp: number;
  lastForwardedAt: string | null;
  lastReceivedAt: string | null;
  errors: number;
}

export default function JabberAdminPage() {
  const [stats, setStats] = useState<XmppStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/jabber");
        if (!res.ok) throw new Error("Failed to fetch");
        setStats(await res.json());
        setError(null);
      } catch {
        setError("Failed to fetch XMPP stats");
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Jabber / XMPP Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Connection status and bridge statistics
          </p>
        </div>

        {error && (
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {stats && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prosody Server</CardTitle>
                <CardDescription>XMPP component connection</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={stats.connected ? "success" : "destructive"}>
                    {stats.connected ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">
                    XMPP Domain
                  </span>
                  <span className="text-right text-sm font-mono break-all">
                    {stats.domain}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">
                    Component JID
                  </span>
                  <span className="text-right text-sm font-mono break-all">
                    {stats.componentDomain}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bridge Traffic</CardTitle>
                <CardDescription>
                  Message forwarding between web app and XMPP
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <StatBox
                    label="Web &rarr; XMPP"
                    value={stats.messagesForwardedToXmpp}
                    sub={
                      stats.lastForwardedAt
                        ? `Last: ${formatTime(stats.lastForwardedAt)}`
                        : "No messages yet"
                    }
                  />
                  <StatBox
                    label="XMPP &rarr; Web"
                    value={stats.messagesReceivedFromXmpp}
                    sub={
                      stats.lastReceivedAt
                        ? `Last: ${formatTime(stats.lastReceivedAt)}`
                        : "No messages yet"
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">
                    Total errors
                  </span>
                  <Badge variant={stats.errors > 0 ? "warning" : "secondary"}>
                    {stats.errors}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Federation</CardTitle>
                <CardDescription>
                  Server-to-server (S2S) connections
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">
                    Server A domain
                  </span>
                  <span className="text-right text-sm font-mono break-all">
                    a.chat.local
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">
                    Server B domain
                  </span>
                  <span className="text-right text-sm font-mono break-all">
                    b.chat.local
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  S2S federation is enabled between both Prosody instances.
                  Federation traffic flows directly between Prosody servers via
                  port 5269. Use the load test script to verify cross-server
                  messaging.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary p-4">
      <p
        className="text-xs text-muted-foreground uppercase tracking-wider"
        dangerouslySetInnerHTML={{ __html: label }}
      />
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}
