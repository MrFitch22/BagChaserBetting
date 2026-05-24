import type { Metadata } from "next";
import { SellerLeaderboard } from "@/components/accountability/SellerLeaderboard";
import { FraudAlertBanner } from "@/components/accountability/FraudAlertBanner";
import { SellerSearch } from "@/components/accountability/SellerSearch";

export const metadata: Metadata = { title: "Accountability Hub" };

export default function AccountabilityPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Accountability Hub</h1>
          <p className="text-sm text-muted mt-0.5">Verified records for every pick seller</p>
        </div>
        <SellerSearch />
      </div>

      <FraudAlertBanner />
      <SellerLeaderboard />
    </div>
  );
}
