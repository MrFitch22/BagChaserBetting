interface Props {
  score: number;
  dataQuality?: number; // 0..1, fraction of signals with real data
}

const TIERS = [
  { min: 80, label: "SHARP PLAY",   bg: "bg-sharp-green/20",   border: "border-sharp-green/50",   text: "text-sharp-green" },
  { min: 70, label: "STRONG LEAN",  bg: "bg-emerald-500/15",   border: "border-emerald-500/40",   text: "text-emerald-400" },
  { min: 60, label: "LEAN",         bg: "bg-yellow-500/10",    border: "border-yellow-500/30",    text: "text-yellow-400" },
  { min: 0,  label: "WATCH",        bg: "bg-white/[0.04]",     border: "border-border",           text: "text-muted" },
] as const;

export function ConfidenceBadge({ score, dataQuality }: Props) {
  const tier = TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1]!;

  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] font-mono font-bold tracking-widest px-2 py-0.5 rounded border ${tier.bg} ${tier.border} ${tier.text}`}>
        {tier.label}
      </span>
      <span className={`text-sm font-mono font-bold ${tier.text}`}>
        {Math.round(score)}
        <span className="text-[10px] font-normal text-muted">/100</span>
      </span>
      {dataQuality !== undefined && dataQuality < 0.5 && (
        <span className="text-[10px] text-muted font-mono" title="Limited data — fewer signals available">
          {Math.round(dataQuality * 100)}% data
        </span>
      )}
    </div>
  );
}
