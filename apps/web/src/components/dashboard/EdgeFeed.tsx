"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import type { EdgeCard as EdgeCardType } from "@sharp-edge/shared";
import { ConfidenceBar } from "@sharp-edge/ui";
import { api } from "@/lib/api";

function EdgeCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 animate-pulse space-y-3">
      <div className="h-4 w-2/3 rounded bg-white/5" />
      <div className="h-3 w-1/3 rounded bg-white/5" />
      <div className="h-2 w-full rounded bg-white/5" />
    </div>
  );
}

function EdgeCard({ edge }: { edge: EdgeCardType }) {
  const isSharp = edge.isSharpMove;
  const score = edge.confidence.score;

  return (
    <div
      className="rounded-lg border bg-surface p-4 space-y-3 transition-colors hover:bg-surface2 cursor-pointer"
      style={{ borderColor: isSharp ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-text">{edge.label}</div>
          <div className="text-xs text-muted mt-0.5">
            {edge.homeTeam} vs {edge.awayTeam} ·{" "}
            {new Date(edge.gameTime).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="font-mono text-sm font-bold"
            style={{ color: edge.odds > 0 ? "#10b981" : "#dce4f0" }}
          >
            {edge.odds > 0 ? `+${edge.odds}` : edge.odds}
          </span>
          {isSharp && (
            <span className="text-[10px] font-bold text-sharp-green bg-sharp-green/10 border border-sharp-green/30 rounded px-1.5 py-0.5 font-mono tracking-wide">
              SHARP
            </span>
          )}
        </div>
      </div>

      <ConfidenceBar score={score} />

      <div className="flex gap-1.5 flex-wrap">
        {Object.entries(edge.confidence.signals).map(([key, val]) => (
          <span
            key={key}
            className="text-[10px] font-mono text-muted bg-white/[0.04] border border-border rounded px-1.5 py-0.5"
          >
            {key.replace(/([A-Z])/g, " $1").trim()}: {typeof val === "number" ? val.toFixed(0) : val}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EdgeFeed() {
  const { getToken } = useAuth();

  const { data: edges, isLoading, error } = useQuery({
    queryKey: ["top-edges"],
    queryFn: async () => {
      const token = await getToken();
      return api.get<EdgeCardType[]>("/api/scores/top-edges", token ?? undefined);
    },
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <EdgeCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-muted text-sm">
          {(error as Error).message === "upgrade_required"
            ? "Upgrade to Pro to unlock confidence scores."
            : "Failed to load edges. Try again shortly."}
        </p>
      </div>
    );
  }

  if (!edges?.length) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-muted text-sm">No high-confidence edges found for today.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {edges.map((edge) => (
        <EdgeCard key={`${edge.gameId}-${edge.market}-${edge.label}`} edge={edge} />
      ))}
    </div>
  );
}
