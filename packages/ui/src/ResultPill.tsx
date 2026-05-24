import type { PickResult } from "@sharp-edge/shared";

const RESULT_STYLES: Record<PickResult, { label: string; bg: string; color: string }> = {
  win:     { label: "WIN",     bg: "rgba(16,185,129,0.15)", color: "#10b981" },
  loss:    { label: "LOSS",    bg: "rgba(239,68,68,0.15)",  color: "#ef4444" },
  push:    { label: "PUSH",    bg: "rgba(100,116,139,0.15)", color: "#94a3b8" },
  pending: { label: "LIVE",    bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
};

interface ResultPillProps {
  result: PickResult;
  units?: number | null;
}

export function ResultPill({ result, units }: ResultPillProps) {
  const s = RESULT_STYLES[result];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: s.bg,
        color: s.color,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 3,
        paddingBottom: 3,
        fontFamily: "'DM Mono', monospace",
      }}
    >
      {s.label}
      {units != null && result !== "pending" && (
        <span style={{ opacity: 0.8 }}>
          {units > 0 ? `+${units.toFixed(2)}u` : `${units.toFixed(2)}u`}
        </span>
      )}
    </span>
  );
}
