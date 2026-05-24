import type { Metadata } from "next";
import { LiveGamesGrid } from "@/components/live/LiveGamesGrid";
import { LiveParlaySidebar } from "@/components/live/LiveParlaySidebar";

export const metadata: Metadata = { title: "Live Games" };

export default function LivePage() {
  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-text">Live Games</h1>
          <p className="text-sm text-muted mt-0.5">Real-time scores, odds, and parlay tracking</p>
        </div>
        <LiveGamesGrid />
      </div>
      <LiveParlaySidebar />
    </div>
  );
}
