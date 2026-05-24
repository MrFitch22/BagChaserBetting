export type UserTier = "free" | "pro" | "sharp";

export interface User {
  id: string;
  clerkId: string;
  email: string;
  username: string | null;
  tier: UserTier;
  stripeId: string | null;
  createdAt: string;
}

export interface SubscriptionStatus {
  tier: UserTier;
  status: "active" | "past_due" | "canceled" | "trialing";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/** Feature gate checks by tier */
export const TIER_FEATURES = {
  edgeFeedLimit: { free: 3, pro: Infinity, sharp: Infinity },
  parlayLegsLimit: { free: 2, pro: Infinity, sharp: Infinity },
  confidenceScores: { free: false, pro: true, sharp: true },
  sharpAlerts: { free: false, pro: false, sharp: true },
  liveModel: { free: false, pro: false, sharp: true },
  apiAccess: { free: false, pro: false, sharp: true },
} as const;
