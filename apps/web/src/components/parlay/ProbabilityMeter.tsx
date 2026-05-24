"use client";

import type { ParlayResult } from "@sharp-edge/shared";

interface ProbabilityMeterProps {
  result: ParlayResult;
}

export function ProbabilityMeter({ result }: ProbabilityMeterProps) {
  const ourPct = (result.adjustedProbability * 100).toFixed(1);
  const bookPct = (result.bookImpliedProbability * 100).toFixed(1);
  const payoutOdds = result.payoutOdds;

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-muted">Our probability</span>
        <span className="text-sharp-green font-bold">{ourPct}%</span>
      </div>

      {/* Gauge bar */}
      <div className="relative h-3 rounded-full bg-white/[0.06]">
        {/* Book implied */}
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-white/20"
          style={{ width: `${bookPct}%` }}
        />
        {/* Our adjusted */}
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${ourPct}%`,
            background: result.edgeScore > 0 ? "#10b981" : "#ef4444",
          }}
        />
      </div>

      <div className="flex justify-between text-xs font-mono">
        <span className="text-muted">Book implied</span>
        <span className="text-muted">{bookPct}%</span>
      </div>

      <div className="border-t border-border pt-3 flex justify-between text-xs font-mono">
        <span className="text-muted">Payout odds</span>
        <span className="text-text font-bold">
          {payoutOdds > 0 ? `+${payoutOdds}` : payoutOdds}
        </span>
      </div>

      <div className="flex justify-between text-xs font-mono">
        <span className="text-muted">EV per $100</span>
        <span style={{ color: result.expectedValue > 0 ? "#10b981" : "#ef4444" }}>
          {result.expectedValue > 0 ? "+" : ""}${result.expectedValue.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
