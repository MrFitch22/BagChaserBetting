"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface DayRecord { wins: number; losses: number; pushes: number }

export function TodayPerformance() {
  const { data } = useQuery({
    queryKey: ["today-record"],
    queryFn: () => api.get<DayRecord>("/api/scores/today-record"),
    refetchInterval: 60_000,
  });

  if (!data) return null;

  const { wins, losses, pushes } = data;
  const total = wins + losses + pushes;
  const winPct = total > 0 ? ((wins / (wins + losses)) * 100).toFixed(0) : "—";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2">
      <span className="text-xs text-muted font-mono">TODAY</span>
      <span className="font-mono text-sm font-bold text-sharp-green">{wins}W</span>
      <span className="font-mono text-sm font-bold text-sharp-red">{losses}L</span>
      {pushes > 0 && <span className="font-mono text-sm text-muted">{pushes}P</span>}
      {total > 0 && (
        <span className="text-xs text-muted font-mono">{winPct}%</span>
      )}
    </div>
  );
}
