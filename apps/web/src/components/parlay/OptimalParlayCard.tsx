"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProbabilityMeter } from "./ProbabilityMeter";
import { ParlayLegList } from "./ParlayLegList";
import type { ParlayResult } from "@sharp-edge/shared";

interface OptimalParlayCardProps {
  edges: any[];
}

export function OptimalParlayCard({ edges }: OptimalParlayCardProps) {
  const [saving, setSaving] = useState(false);

  // Map edges to parlay legs
  const legs = edges.map((e) => ({
    gameId: e.gameId,
    market: e.market,
    label: e.label || e.team || "Unknown",
    odds: e.odds ?? -110,
    point: null,
  }));

  // Fetch the probability computation from the backend
  const { data: probability, isLoading: probabilityLoading } = useQuery({
    queryKey: ["parlay-probability", legs],
    queryFn: () =>
      api.post<ParlayResult>("/api/parlays/probability", { legs }),
    enabled: legs.length >= 2,
  });

  const saveParlay = async () => {
    try {
      setSaving(true);
      await api.post("/api/parlays", {
        legs,
        combinedProb: probability?.adjustedProbability,
        bookImplied: probability?.bookImpliedProbability,
        edgeScore: probability?.edgeScore,
        payoutOdds: probability?.payoutOdds,
        sportsbook: "optimal",
      });
      alert("Optimal Parlay Saved!");
    } catch (err) {
      console.error(err);
      alert("Failed to save parlay.");
    } finally {
      setSaving(false);
    }
  };

  const hasEdge = (probability?.edgeScore ?? 0) > 0;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-2xl shadow-sharp-green/5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-sharp-green/20 to-transparent p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-bold text-text flex items-center gap-2">
            <span className="text-xl">🔥</span> Top +EV Combination
          </h3>
          <p className="text-xs text-muted mt-1">
            Combining the {legs.length} sharpest edges currently available.
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-sharp-green uppercase tracking-wider">
            Optimal Build
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Legs Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted uppercase tracking-wider">Included Legs</h4>
          <ParlayLegList legs={legs} onRemove={() => {}} {...(probability ? { probability } : {})} />
        </div>

        {/* Analytics Section */}
        <div className="space-y-6">
          <h4 className="text-sm font-medium text-muted uppercase tracking-wider">Mathematical Edge</h4>
          
          {probabilityLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-white/5 rounded w-3/4"></div>
              <div className="h-4 bg-white/5 rounded w-1/2"></div>
            </div>
          ) : probability ? (
            <>
              <ProbabilityMeter result={probability} />
              
              <div className="pt-4 space-y-3">
                <div
                  className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-mono font-bold border shadow-inner"
                  style={{
                    background: hasEdge ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                    color: hasEdge ? "#10b981" : "#ef4444",
                    borderColor: hasEdge ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
                  }}
                >
                  {hasEdge ? "▲ POSITIVE EV DETECTED" : "▼ NEGATIVE EV DETECTED"}
                  <span className="ml-auto text-lg">
                    {probability.edgeScore > 0 ? "+" : ""}
                    {probability.edgeScore.toFixed(2)}%
                  </span>
                </div>

                <button
                  onClick={saveParlay}
                  disabled={saving || !hasEdge}
                  className="w-full rounded-lg bg-sharp-green hover:bg-emerald-400 text-bg text-sm font-bold py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)]"
                >
                  {saving ? "Locking in..." : "Save Optimal Parlay"}
                </button>
              </div>
            </>
          ) : (
            <p className="text-muted text-sm">Unable to calculate probability.</p>
          )}
        </div>
      </div>
    </div>
  );
}
