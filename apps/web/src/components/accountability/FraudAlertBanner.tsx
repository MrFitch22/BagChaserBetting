"use client";

import { useQuery } from "@tanstack/react-query";
import type { SocialAccount } from "@sharp-edge/shared";
import { api } from "@/lib/api";

export function FraudAlertBanner() {
  const { data: alerts } = useQuery({
    queryKey: ["fraud-alerts"],
    queryFn: () => api.get<SocialAccount[]>("/api/sellers/fraud-alerts"),
    refetchInterval: 15 * 60 * 1000,
  });

  if (!alerts?.length) return null;

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-bold text-sharp-red tracking-wide">FRAUD ALERTS</span>
        <span className="text-xs text-muted">Recently exposed accounts</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {alerts.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-1.5 rounded border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs"
          >
            <span className="font-medium text-text">@{a.handle}</span>
            <span className="text-muted">{a.platform}</span>
            {a.claimedRoi != null && a.verifiedRoi != null && (
              <span className="font-mono text-sharp-red">
                claimed {parseFloat(String(a.claimedRoi)).toFixed(0)}% / actual{" "}
                {parseFloat(String(a.verifiedRoi)).toFixed(0)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
