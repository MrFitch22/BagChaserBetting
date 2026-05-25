"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { SocialAccount, TrackedPick } from "@sharp-edge/shared";
import { TierBadge, ResultPill } from "@sharp-edge/ui";
import { api } from "@/lib/api";

interface PicksResponse {
  picks: TrackedPick[];
  nextCursor: string | null;
  total: number;
}

const PLATFORM_ICONS: Record<string, string> = {
  twitter:   "𝕏",
  instagram: "📸",
  tiktok:    "🎵",
};

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-surface p-4 text-center" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
      <div className="text-xl font-mono font-bold text-text">{value}</div>
      {sub && <div className="text-xs font-mono text-muted mt-0.5">{sub}</div>}
      <div className="text-[10px] text-muted uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

function TrustBar({ score }: { score: number }) {
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono text-muted">
        <span>Trust Score</span>
        <span style={{ color }}>{score.toFixed(1)}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function PickRow({ pick }: { pick: TrackedPick }) {
  const date = new Date(pick.postedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const clv  = pick.clv ? parseFloat(String(pick.clv)) : null;

  return (
    <div className="grid grid-cols-[80px_1fr_80px_70px_60px] gap-3 items-center px-4 py-2.5 border-b border-border hover:bg-surface2 transition-colors last:border-0 text-xs">
      <span className="font-mono text-muted">{date}</span>
      <div>
        <div className="font-medium text-text truncate">{pick.betLabel ?? "—"}</div>
        {pick.sport && <div className="text-muted">{pick.sport} · {pick.betType}</div>}
      </div>
      <span className="font-mono text-right text-text">
        {pick.oddsAtPost ? (pick.oddsAtPost > 0 ? `+${pick.oddsAtPost}` : pick.oddsAtPost) : "—"}
      </span>
      <span
        className="font-mono text-right text-muted"
        title="Closing Line Value"
      >
        {clv != null ? (
          <span style={{ color: clv > 0 ? "#10b981" : "#ef4444" }}>
            {clv > 0 ? `+${clv.toFixed(2)}` : clv.toFixed(2)}
          </span>
        ) : "—"}
      </span>
      <div className="flex justify-end">
        <ResultPill
          result={pick.result}
          units={pick.unitsReturned ? parseFloat(String(pick.unitsReturned)) : null}
        />
      </div>
    </div>
  );
}

export default function CapperProfilePage() {
  const params       = useParams<{ handle: string }>();
  const searchParams = useSearchParams();
  const handle   = params.handle;
  const platform = searchParams.get("platform") ?? "twitter";

  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ["seller", handle, platform],
    queryFn:  () => api.get<SocialAccount>(`/api/sellers/${handle}?platform=${platform}`),
  });

  const { data: picksData, isLoading: picksLoading } = useQuery({
    queryKey: ["seller-picks", handle, platform],
    queryFn:  () => api.get<PicksResponse>(`/api/sellers/${handle}/picks?platform=${platform}&limit=25`),
    enabled:  !!account,
  });

  if (accountLoading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-white/5" />
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map((i) => <div key={i} className="h-20 rounded-lg bg-white/5" />)}
        </div>
        <div className="h-64 rounded-lg bg-white/5" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-muted text-sm">Capper not found.</p>
          <Link href="/accountability" className="text-xs text-sharp-green mt-2 block hover:underline">
            ← Back to leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const total   = account.verifiedW + account.verifiedL;
  const winPct  = total > 0 ? ((account.verifiedW / total) * 100).toFixed(1) : "—";
  const roi     = account.verifiedRoi != null ? parseFloat(String(account.verifiedRoi)) : null;
  const trustScore = parseFloat(String(account.trustScore));

  // Recent form from picks (last 5 resolved)
  const resolved = picksData?.picks.filter((p) => p.result !== "pending").slice(0, 5) ?? [];
  const formMap: Record<string, string> = { win: "W", loss: "L", push: "P" };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link href="/accountability" className="text-xs text-muted hover:text-text transition-colors flex items-center gap-1">
        ← Leaderboard
      </Link>

      {/* Profile header */}
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center text-2xl shrink-0">
          {PLATFORM_ICONS[account.platform] ?? "👤"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-display font-bold text-text">@{account.handle}</h1>
            <TierBadge tier={account.tier as Parameters<typeof TierBadge>[0]["tier"]} size="md" />
            {account.isFraud && (
              <span className="text-[10px] font-bold text-red-400 bg-red-400/10 border border-red-400/30 rounded px-2 py-1 font-mono tracking-wider">
                FRAUD DETECTED
              </span>
            )}
          </div>
          <p className="text-sm text-muted mt-0.5">{account.platform} · {account.followers.toLocaleString()} followers</p>
          <div className="mt-2 max-w-xs">
            <TrustBar score={trustScore} />
          </div>
        </div>

        {/* Recent form */}
        {resolved.length > 0 && (
          <div className="shrink-0 text-right">
            <div className="text-[10px] text-muted mb-1 font-mono">Last {resolved.length}</div>
            <div className="flex gap-1">
              {resolved.map((p) => (
                <span
                  key={p.id}
                  className="w-6 h-6 rounded text-[10px] font-bold font-mono flex items-center justify-center"
                  style={{
                    backgroundColor: p.result === "win" ? "rgba(16,185,129,0.15)" : p.result === "loss" ? "rgba(239,68,68,0.15)" : "rgba(100,116,139,0.15)",
                    color: p.result === "win" ? "#10b981" : p.result === "loss" ? "#ef4444" : "#94a3b8",
                  }}
                >
                  {formMap[p.result] ?? "?"}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Record" value={`${account.verifiedW}-${account.verifiedL}`} sub={total > 0 ? `${total} picks` : undefined} />
        <StatBox label="Win %" value={winPct !== "—" ? `${winPct}%` : "—"} />
        <StatBox
          label="Verified ROI"
          value={roi != null ? `${roi > 0 ? "+" : ""}${roi.toFixed(1)}%` : "—"}
          sub={account.claimedRoi != null ? `claimed: ${parseFloat(String(account.claimedRoi)).toFixed(1)}%` : undefined}
        />
        <StatBox label="Trust Score" value={`${trustScore.toFixed(0)}/100`} />
      </div>

      {/* Fraud warning */}
      {account.isFraud && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm font-semibold text-red-400">Fraud Alert</p>
          <p className="text-xs text-muted mt-1">
            This account's claimed record does not match verified results. Exercise extreme caution.
            Claimed ROI: {account.claimedRoi != null ? `${parseFloat(String(account.claimedRoi)).toFixed(1)}%` : "N/A"} ·
            Verified ROI: {roi != null ? `${roi.toFixed(1)}%` : "N/A"}
          </p>
        </div>
      )}

      {/* Pick history */}
      <div>
        <h2 className="text-sm font-semibold text-text mb-3">Pick History</h2>
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[80px_1fr_80px_70px_60px] gap-3 px-4 py-2 bg-surface2 border-b border-border text-[10px] font-mono text-muted uppercase tracking-wide">
            <span>Date</span>
            <span>Pick</span>
            <span className="text-right">Odds</span>
            <span className="text-right">CLV</span>
            <span className="text-right">Result</span>
          </div>

          {picksLoading ? (
            <div className="p-8 text-center text-muted text-sm animate-pulse">Loading picks...</div>
          ) : !picksData?.picks.length ? (
            <div className="p-8 text-center text-muted text-sm">No picks tracked yet.</div>
          ) : (
            picksData.picks.map((pick) => <PickRow key={pick.id} pick={pick} />)
          )}
        </div>
        {picksData?.nextCursor && (
          <p className="text-xs text-muted text-center mt-2">Showing first 25 picks</p>
        )}
      </div>
    </div>
  );
}
