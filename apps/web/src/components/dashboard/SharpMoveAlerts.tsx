"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { SharpMoveAlert } from "@sharp-edge/shared";

export function SharpMoveAlerts() {
  const [alerts, setAlerts] = useState<SharpMoveAlert[]>([]);

  useEffect(() => {
    const socket = io(`${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001"}/live`);
    socket.on("sharp:alert", (alert: SharpMoveAlert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 5));
    });
    return () => { socket.disconnect(); };
  }, []);

  if (!alerts.length) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-md border bg-surface px-4 py-2.5 text-sm animate-slide-in"
          style={{ borderColor: "rgba(16,185,129,0.3)" }}
        >
          <span className="w-2 h-2 rounded-full bg-sharp-green animate-pulse-green flex-shrink-0" />
          <span className="font-mono text-sharp-green font-bold text-xs tracking-wide">SHARP MOVE</span>
          <span className="text-muted">·</span>
          <span className="text-text">
            {alert.homeTeam} vs {alert.awayTeam}
          </span>
          <span className="text-muted">—</span>
          <span className="text-text font-medium">{alert.label}</span>
          <span className="ml-auto text-muted text-xs font-mono">
            {alert.books.slice(0, 3).join(", ")}
          </span>
        </div>
      ))}
    </div>
  );
}
