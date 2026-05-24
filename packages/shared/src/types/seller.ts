export type SellerPlatform = "twitter" | "instagram" | "tiktok";

export type SellerTier = "elite" | "certified" | "verified" | "emerging" | "unverified";

export interface SocialAccount {
  id: string;
  handle: string;
  platform: SellerPlatform;
  profileUrl: string | null;
  followers: number;
  tier: SellerTier;
  trustScore: number; // 0–100
  verifiedW: number;
  verifiedL: number;
  verifiedRoi: number | null;
  claimedRoi: number | null;
  isFraud: boolean;
  trackingSince: string;
  lastActive: string | null;
}

export interface SellerStats {
  handle: string;
  platform: SellerPlatform;
  tier: SellerTier;
  winPct: number;
  roi: number;
  totalPicks: number;
  clv: number | null; // avg closing line value
  monthsTracked: number;
  isFraud: boolean;
  fraudReason: string | null;
}

export interface SellerLeaderboardEntry extends SellerStats {
  rank: number;
  rankChange: number; // +/- positions vs last week
  recentForm: Array<"W" | "L" | "P">; // last 5 picks
}
