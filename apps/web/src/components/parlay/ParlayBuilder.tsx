"use client";

import { useParlay } from "@/hooks/useParlay";
import { ParlayLegList } from "./ParlayLegList";
import { ProbabilityMeter } from "./ProbabilityMeter";

export function ParlayBuilder() {
  const { legs, removeLeg, clearLegs, probability, probabilityLoading, save, saving } = useParlay();

  const hasEdge = (probability?.edgeScore ?? 0) > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Legs panel */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-text">Parlay Legs</h2>
            {legs.length > 0 && (
              <button
                onClick={clearLegs}
                className="text-xs text-muted hover:text-sharp-red transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {legs.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted text-sm">Add legs from the Edge Feed to build your parlay.</p>
            </div>
          ) : (
            <ParlayLegList legs={legs} onRemove={removeLeg} {...(probability ? { probability } : {})} />
          )}
        </div>
      </div>

      {/* Probability panel */}
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
          <h2 className="text-sm font-medium text-text">Probability</h2>

          {legs.length < 2 ? (
            <p className="text-muted text-xs">Add at least 2 legs to calculate probability.</p>
          ) : probabilityLoading ? (
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-white/5 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-white/5 animate-pulse" />
            </div>
          ) : probability ? (
            <ProbabilityMeter result={probability} />
          ) : null}

          {probability && legs.length >= 2 && (
            <div className="pt-3 border-t border-border space-y-2">
              <div
                className="flex items-center gap-2 rounded px-3 py-1.5 text-xs font-mono font-bold border"
                style={{
                  background: hasEdge ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                  color: hasEdge ? "#10b981" : "#ef4444",
                  borderColor: hasEdge ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
                }}
              >
                {hasEdge ? "▲ POSITIVE EV" : "▼ NEGATIVE EV"}
                <span className="ml-auto">
                  {probability.edgeScore > 0 ? "+" : ""}
                  {probability.edgeScore.toFixed(1)}%
                </span>
              </div>

              <button
                onClick={() => save({})}
                disabled={saving}
                className="w-full rounded-md bg-sharp-green/90 hover:bg-sharp-green text-bg text-sm font-bold py-2 transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Parlay"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
