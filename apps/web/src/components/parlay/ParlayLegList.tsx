"use client";

import type { ParlayLeg, ParlayResult } from "@sharp-edge/shared";

interface ParlayLegListProps {
  legs: ParlayLeg[];
  onRemove: (index: number) => void;
  probability?: ParlayResult;
}

export function ParlayLegList({ legs, onRemove, probability }: ParlayLegListProps) {
  return (
    <div className="space-y-2">
      {legs.map((leg, i) => {
        const enriched = probability?.legs[i];
        const adjProb = enriched?.adjustedProbability;

        return (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md bg-surface2 px-3 py-2.5 group"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text truncate">{leg.label}</div>
              <div className="text-xs text-muted font-mono mt-0.5">
                {leg.market.toUpperCase()} ·{" "}
                <span style={{ color: leg.odds > 0 ? "#10b981" : "#94a3b8" }}>
                  {leg.odds > 0 ? `+${leg.odds}` : leg.odds}
                </span>
                {adjProb != null && (
                  <span className="ml-2 text-sharp-blue">{(adjProb * 100).toFixed(1)}%</span>
                )}
              </div>
            </div>
            <button
              onClick={() => onRemove(i)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-sharp-red text-lg leading-none"
              aria-label="Remove leg"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
