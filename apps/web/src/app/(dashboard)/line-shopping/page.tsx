import type { Metadata } from "next";
import { LineShoppingTable } from "@/components/line-shopping/LineShoppingTable";

export const metadata: Metadata = { title: "Line Shopping" };

export default function LineShoppingPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-display font-bold text-text">Line Shopping</h1>
        <p className="text-sm text-muted mt-1">
          Compare odds across every book in real time. Green = best available price.
          Even a small difference in odds adds up significantly over hundreds of bets.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted font-mono flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-sharp-green animate-pulse" />
        Prices refresh every 2 minutes · Pinnacle shown where available as sharp reference
      </div>

      <LineShoppingTable />
    </div>
  );
}
