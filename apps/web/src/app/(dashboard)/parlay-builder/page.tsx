"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { OptimalParlayCard } from "@/components/parlay/OptimalParlayCard";

export default function ParlayBuilderPage() {
  const { data: edges, isLoading } = useQuery({
    queryKey: ["top-edges"],
    queryFn: () => api.get<any[]>("/api/scores/top-edges"),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight text-text">Optimal Parlay Builder</h1>
        <p className="text-sm text-muted mt-1">
          Auto-generated +EV parlays mathematically designed to beat the bookmaker.
        </p>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-64 bg-surface/50 rounded-xl border border-border" />
        </div>
      ) : edges && edges.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          <OptimalParlayCard edges={edges.slice(0, 3)} />
          {/* We could render alternative combinations here in the future */}
        </div>
      ) : (
        <div className="py-12 text-center rounded-xl border border-border border-dashed">
          <p className="text-muted">No sharp edges found to build an optimal parlay right now.</p>
        </div>
      )}
    </div>
  );
}
