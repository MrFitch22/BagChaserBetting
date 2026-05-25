"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EdgeCard as EdgeCardType } from "@sharp-edge/shared";
import { api } from "@/lib/api";
import { useParlayStore } from "@/store/parlayStore";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { SignalBreakdown } from "./SignalBreakdown";

const SPORTS = ["All", "NBA", "NHL", "MLB", "NFL"] as const;
type SportFilter = (typeof SPORTS)[number];

// Extended EdgeCard type with v3 fields
type EdgeCardV3 = EdgeCardType & {
  sport: string;
  confidence: EdgeCardType["confidence"] & {
    narrative?:    string | null;
    dataQuality?:  number;
    signals: {
      sharpMoney:   number;
      lineMovement: number;
      matchup:      number;
      publicMoney:  number;
      sentiment:    number;
      playerTrend:  number;
      pickTracker:  number;
      scheduleEdge: number;
    };
  };
};

interface PublicBetting {
  market:   string;
  label:    string;
  betsPct:  string | null;
  moneyPct: string | null;
}

function SportNav({ active, onChange, available }: {
  active: SportFilter;
  onChange: (s: SportFilter) => void;
  available: Set<string>;
}) {
  return (
    <div className="flex gap-1 border-b border-border pb-3 mb-4">
      {SPORTS.filter((s) => s === "All" || available.has(s)).map((sport) => (
        <button
          key={sport}
          onClick={() => onChange(sport)}
          className={[
            "px-3 py-1.5 rounded text-xs font-mono font-semibold tracking-wide transition-colors",
            active === sport
              ? "bg-sharp-green/15 text-sharp-green border border-sharp-green/30"
              : "text-muted hover:text-text hover:bg-white/[0.04] border border-transparent",
          ].join(" ")}
        >
          {sport}
        </button>
      ))}
    </div>
  );
}

function PublicBettingBar({ gameId, market, label }: { gameId: string; market: string; label: string }) {
  const { data } = useQuery({
    queryKey: ["public-betting", gameId],
    queryFn: () => api.get<PublicBetting[]>(`/api/public-betting/${gameId}`),
    staleTime: 5 * 60 * 1000,
  });

  const row = data?.find(
    (d) => d.market === market &&
      d.label.toLowerCase().includes(label.toLowerCase().split(" ")[0] ?? "")
  );
  if (!row?.betsPct) return null;

  const bets  = parseFloat(row.betsPct);
  const money = row.moneyPct ? parseFloat(row.moneyPct) : null;

  return (
    <div className="border-t border-border pt-2 space-y-1">
      <div className="flex items-center justify-between text-[10px] font-mono text-muted">
        <span>Public bets on this side</span>
        <span className="font-semibold" style={{ color: bets > 60 ? "#f59e0b" : "#8a9ab5" }}>
          {bets.toFixed(0)}%
        </span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${bets}%`, backgroundColor: bets > 60 ? "#f59e0b" : "#10b981" }} />
      </div>
      {money !== null && (
        <p className="text-[10px] text-muted">
          {money.toFixed(0)}% of money wagered on this side
          {money > 65 && <span className="text-yellow-400 ml-1">— public side</span>}
          {money < 40 && <span className="text-sharp-green ml-1">— sharp side</span>}
        </p>
      )}
    </div>
  );
}

function EdgeCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 animate-pulse space-y-3">
      <div className="h-4 w-2/3 rounded bg-white/5" />
      <div className="h-3 w-1/3 rounded bg-white/5" />
      <div className="h-2 w-full rounded bg-white/5" />
    </div>
  );
}

function EdgeCard({ edge }: { edge: EdgeCardV3 }) {
  const { legs, addLeg } = useParlayStore();
  const score       = edge.confidence.score;
  const dataQuality = edge.confidence.dataQuality ?? 0;

  const inParlay = legs.some(
    (l) => l.gameId === edge.gameId && l.market === edge.market && l.label === edge.label
  );

  const gameTime = new Date(edge.gameTime).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });

  return (
    <div
      className="rounded-lg border bg-surface p-4 space-y-3 transition-colors hover:bg-surface2"
      style={{ borderColor: edge.isSharpMove ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.07)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text truncate">{edge.label}</div>
          <div className="text-xs text-muted mt-0.5">
            {edge.homeTeam} vs {edge.awayTeam} · {gameTime}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className="font-mono text-sm font-bold"
            style={{ color: edge.odds > 0 ? "#10b981" : "#dce4f0" }}
          >
            {edge.odds > 0 ? `+${edge.odds}` : edge.odds}
          </span>
          {edge.isSharpMove && (
            <span className="text-[10px] font-bold text-sharp-green bg-sharp-green/10 border border-sharp-green/30 rounded px-1.5 py-0.5 font-mono tracking-wide">
              SHARP
            </span>
          )}
        </div>
      </div>

      {/* Confidence badge */}
      <ConfidenceBadge score={score} dataQuality={dataQuality} />

      {/* Narrative (plain English for beginners) */}
      {edge.confidence.narrative && (
        <p className="text-[11px] text-muted italic leading-relaxed bg-white/[0.02] border border-border rounded px-2 py-1.5">
          "{edge.confidence.narrative}"
        </p>
      )}

      {/* Signal breakdown with beginner tooltips */}
      <SignalBreakdown
        signals={edge.confidence.signals}
        dataQuality={dataQuality}
      />

      {/* Public betting bar */}
      <PublicBettingBar gameId={edge.gameId} market={edge.market} label={edge.label} />

      {/* Add to parlay */}
      <button
        onClick={() =>
          addLeg({
            gameId: edge.gameId,
            market: edge.market as "spread" | "moneyline" | "total" | "prop",
            label:  edge.label,
            odds:   edge.odds,
            point:  null,
          })
        }
        className={[
          "w-full mt-1 rounded py-1.5 text-xs font-mono font-semibold tracking-wide transition-all border",
          inParlay
            ? "bg-sharp-green/15 text-sharp-green border-sharp-green/40 cursor-default"
            : "text-muted border-border hover:text-text hover:border-white/20 hover:bg-white/[0.04]",
        ].join(" ")}
        disabled={inParlay}
      >
        {inParlay ? "✓ In Parlay" : "+ Add to Parlay"}
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="flex gap-1 border-b border-border pb-3 mb-4">
        {["All", "NBA", "NHL"].map((s) => (
          <div key={s} className="h-7 w-12 rounded bg-white/5 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <EdgeCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

export function EdgeFeed() {
  const [mounted, setMounted]         = useState(false);
  const [activeSport, setActiveSport] = useState<SportFilter>("All");

  useEffect(() => { setMounted(true); }, []);

  const { data: edges, isLoading, error } = useQuery({
    queryKey: ["top-edges"],
    queryFn:  () => api.get<EdgeCardV3[]>("/api/scores/top-edges"),
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });

  if (!mounted || isLoading) return <LoadingSkeleton />;

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
        <p className="text-muted text-xs mt-1">Run the pipeline to generate scores.</p>
      </div>
    );
  }

  const available = new Set(edges.map((e) => e.sport?.toUpperCase()));
  const filtered  = activeSport === "All"
    ? edges
    : edges.filter((e) => e.sport?.toUpperCase() === activeSport);

  return (
    <div>
      <SportNav active={activeSport} onChange={setActiveSport} available={available} />
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-muted text-sm">No edges for {activeSport} right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((edge) => (
            <EdgeCard key={`${edge.gameId}-${edge.market}-${edge.label}`} edge={edge} />
          ))}
        </div>
      )}
    </div>
  );
}
