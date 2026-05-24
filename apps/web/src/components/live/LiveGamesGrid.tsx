"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { io } from "socket.io-client";
import type { Game, LiveGameUpdate } from "@sharp-edge/shared";
import { api } from "@/lib/api";

function LiveGameCard({ game, live }: { game: Game; live?: LiveGameUpdate }) {
  const score = live ?? { homeScore: game.homeScore ?? 0, awayScore: game.awayScore ?? 0, status: game.status };
  const isLive = game.status === "live";

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted">{game.sport} · {game.league}</span>
        {isLive && (
          <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-sharp-red">
            <span className="w-1.5 h-1.5 rounded-full bg-sharp-red animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 items-center gap-2">
        <div className="text-sm font-medium text-text">{game.awayTeam}</div>
        <div className="text-center font-mono font-bold text-lg text-text">
          {score.awayScore ?? 0} - {score.homeScore ?? 0}
        </div>
        <div className="text-sm font-medium text-text text-right">{game.homeTeam}</div>
      </div>

      {live?.timeRemaining && (
        <div className="text-xs text-center font-mono text-muted">
          {live.period ? `Q${live.period}` : ""} {live.timeRemaining}
        </div>
      )}

      {!isLive && (
        <div className="text-xs text-center font-mono text-muted">
          {new Date(game.gameTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}

export function LiveGamesGrid() {
  const [liveUpdates, setLiveUpdates] = useState<Record<string, LiveGameUpdate>>({});

  const { data: games } = useQuery({
    queryKey: ["games"],
    queryFn: () => api.get<Game[]>("/api/games"),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const socket = io(`${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001"}/live`);

    games?.filter((g) => g.status === "live").forEach((g) => {
      socket.emit("subscribe:game", g.id);
    });

    socket.on("game:score", (update: LiveGameUpdate) => {
      setLiveUpdates((prev) => ({ ...prev, [update.gameId]: update }));
    });

    return () => { socket.disconnect(); };
  }, [games]);

  if (!games?.length) {
    return (
      <div className="text-center py-16 text-muted text-sm">No games scheduled today.</div>
    );
  }

  const liveGames = games.filter((g) => g.status === "live");
  const upcomingGames = games.filter((g) => g.status === "scheduled");

  return (
    <div className="space-y-6">
      {liveGames.length > 0 && (
        <div>
          <h2 className="text-xs font-mono font-bold text-sharp-red mb-3 tracking-wide">LIVE NOW</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {liveGames.map((g) => (
              <LiveGameCard key={g.id} game={g} live={liveUpdates[g.id]} />
            ))}
          </div>
        </div>
      )}

      {upcomingGames.length > 0 && (
        <div>
          <h2 className="text-xs font-mono font-bold text-muted mb-3 tracking-wide">UPCOMING</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {upcomingGames.map((g) => (
              <LiveGameCard key={g.id} game={g} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
