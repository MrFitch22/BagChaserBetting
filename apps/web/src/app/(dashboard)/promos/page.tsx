"use client";

import { useState } from "react";
import { BookPromosGrid } from "@/components/promos/BookPromosGrid";
import { CasinoPromosGrid } from "@/components/promos/CasinoPromosGrid";

const TABS = ["Sportsbooks", "Casinos"] as const;
type Tab = (typeof TABS)[number];

export default function PromosPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Sportsbooks");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-display font-bold text-text">Promotions</h1>
        <p className="text-sm text-muted mt-1">Live offers from top sportsbooks and casinos — updated every 6 hours.</p>
      </div>

      <div className="flex gap-1 border-b border-border pb-3">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "px-4 py-1.5 rounded text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-sharp-green/15 text-sharp-green border border-sharp-green/30"
                : "text-muted hover:text-text hover:bg-white/[0.04] border border-transparent",
            ].join(" ")}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Sportsbooks" ? <BookPromosGrid /> : <CasinoPromosGrid />}
    </div>
  );
}
