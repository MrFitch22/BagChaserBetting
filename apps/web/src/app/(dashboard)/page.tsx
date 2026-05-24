import type { Metadata } from "next";
import { EdgeFeed } from "@/components/dashboard/EdgeFeed";
import { SharpMoveAlerts } from "@/components/dashboard/SharpMoveAlerts";
import { TodayPerformance } from "@/components/dashboard/TodayPerformance";

export const metadata: Metadata = { title: "Dashboard" };

// Revalidate every 5 minutes — ISR for the edge feed
export const revalidate = 300;

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Edge Feed</h1>
          <p className="text-sm text-muted mt-0.5">Today&apos;s top confidence scores</p>
        </div>
        <TodayPerformance />
      </div>

      <SharpMoveAlerts />
      <EdgeFeed />
    </div>
  );
}
