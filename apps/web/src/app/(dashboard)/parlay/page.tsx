import type { Metadata } from "next";
import { ParlayBuilder } from "@/components/parlay/ParlayBuilder";

export const metadata: Metadata = { title: "Parlay Builder" };

export default function ParlayPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-text">Parlay Builder</h1>
        <p className="text-sm text-muted mt-0.5">Build smarter parlays with confidence-adjusted probability</p>
      </div>
      <ParlayBuilder />
    </div>
  );
}
