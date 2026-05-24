interface ConfidenceBarProps {
  score: number; // 0–100
  showLabel?: boolean;
  height?: number;
}

function scoreToColor(score: number): string {
  if (score >= 75) return "#10b981"; // green
  if (score >= 60) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

function scoreToLabel(score: number): string {
  if (score >= 80) return "SHARP";
  if (score >= 70) return "STRONG";
  if (score >= 60) return "LEAN";
  if (score >= 50) return "NEUTRAL";
  return "FADE";
}

export function ConfidenceBar({ score, showLabel = true, height = 4 }: ConfidenceBarProps) {
  const color = scoreToColor(score);
  const label = scoreToLabel(score);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {showLabel && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 11,
            fontFamily: "'DM Mono', monospace",
          }}
        >
          <span style={{ color: "#475569" }}>{label}</span>
          <span style={{ color, fontWeight: 700 }}>{score.toFixed(0)}</span>
        </div>
      )}
      <div
        style={{
          width: "100%",
          height,
          background: "rgba(255,255,255,0.07)",
          borderRadius: height / 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: "100%",
            background: color,
            borderRadius: height / 2,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}
