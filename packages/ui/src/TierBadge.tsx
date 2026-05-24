import type { SellerTier } from "@sharp-edge/shared";

const TIER_STYLES: Record<SellerTier, { label: string; bg: string; color: string; border: string }> = {
  elite:      { label: "ELITE",       bg: "#1e0f3d", color: "#c4b5fd", border: "#7c3aed" },
  certified:  { label: "CERTIFIED",   bg: "#0c1f3f", color: "#93c5fd", border: "#2563eb" },
  verified:   { label: "VERIFIED",    bg: "#082018", color: "#6ee7b7", border: "#059669" },
  emerging:   { label: "EMERGING",    bg: "#2a1700", color: "#fcd34d", border: "#d97706" },
  unverified: { label: "UNVERIFIED",  bg: "#1f0a0a", color: "#fca5a5", border: "#dc2626" },
};

interface TierBadgeProps {
  tier: SellerTier;
  size?: "sm" | "md" | "lg";
}

export function TierBadge({ tier, size = "md" }: TierBadgeProps) {
  const s = TIER_STYLES[tier];
  const fontSize = size === "sm" ? 9 : size === "lg" ? 13 : 10;
  const px = size === "sm" ? 6 : size === "lg" ? 10 : 8;
  const py = size === "sm" ? 2 : size === "lg" ? 4 : 3;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        borderRadius: 4,
        fontSize,
        fontWeight: 700,
        letterSpacing: "0.08em",
        paddingLeft: px,
        paddingRight: px,
        paddingTop: py,
        paddingBottom: py,
        fontFamily: "'DM Mono', monospace",
      }}
    >
      {s.label}
    </span>
  );
}
