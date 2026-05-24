import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// Load fonts
(() => {
  if (typeof document === "undefined") return;
  const s = document.createElement("style");
  s.textContent = `@import url('https://cdn.jsdelivr.net/npm/@fontsource/syne@5/index.css');@import url('https://cdn.jsdelivr.net/npm/@fontsource/dm-mono@5/index.css');`;
  document.head.appendChild(s);
})();

const C = {
  bg: "#070a0f", surface: "#0d1119", surface2: "#111824",
  border: "rgba(255,255,255,0.07)", border2: "rgba(255,255,255,0.12)",
  text: "#dce4f0", muted: "#475569", faint: "#1e2535",
  green: "#10b981", red: "#ef4444", amber: "#f59e0b",
  blue: "#60a5fa", purple: "#a78bfa", teal: "#2dd4bf",
};

const TIERS = {
  elite:      { label: "ELITE",       bg: "#1e0f3d", color: "#c4b5fd", border: "#7c3aed" },
  certified:  { label: "CERTIFIED",   bg: "#0c1f3f", color: "#93c5fd", border: "#2563eb" },
  verified:   { label: "VERIFIED",    bg: "#082018", color: "#6ee7b7", border: "#059669" },
  emerging:   { label: "EMERGING",    bg: "#2a1700", color: "#fcd34d", border: "#d97706" },
  unverified: { label: "UNVERIFIED",  bg: "#1f0a0a", color: "#fca5a5", border: "#dc2626" },
};

function genROICurve(finalROI, seed = 1) {
  const pts = [];
  let v = 0;
  for (let i = 0; i <= 18; i++) {
    const noise = Math.sin(i * seed * 1.7 + seed) * (Math.abs(finalROI) * 0.12 + 2);
    v = finalROI * (i / 18) + noise;
    pts.push({ d: i * 5, roi: parseFloat(v.toFixed(1)) });
  }
  pts[pts.length - 1].roi = finalROI;
  return pts;
}

const SELLERS = [
  {
    id: 1, handle: "SharpEdge_Jay", platform: "twitter", tier: "elite",
    followers: 48200, sports: ["NFL", "NBA"], vW: 312, vL: 189,
    winPct: 62.3, vROI: 23.4, cROI: null, since: "Jan 2023", lastActive: "1h ago",
    picks: [
      { date: "May 23", game: "PHX @ MIN", bet: "MIN -3.5", odds: -115, result: "WIN", units: 1.0 },
      { date: "May 22", game: "BOS @ NYK", bet: "BOS ML", odds: -140, result: "WIN", units: 0.71 },
      { date: "May 21", game: "DEN @ OKC", bet: "Over 216.5", odds: -110, result: "LOSS", units: -1.0 },
      { date: "May 20", game: "IND @ MIL", bet: "IND +5.5", odds: -110, result: "WIN", units: 0.91 },
      { date: "May 19", game: "LAL @ GSW", bet: "LAL ML", odds: +145, result: "WIN", units: 1.45 },
      { date: "May 18", game: "PHX @ MIN", bet: "MIN -2", odds: -118, result: "LOSS", units: -1.0 },
      { date: "May 17", game: "NYK @ BOS", bet: "Under 210", odds: -105, result: "WIN", units: 0.95 },
      { date: "May 16", game: "OKC @ NOP", bet: "OKC -8.5", odds: -112, result: "WIN", units: 0.89 },
    ],
  },
  {
    id: 2, handle: "VIPParlay_King", platform: "instagram", tier: "unverified",
    followers: 127000, sports: ["NFL", "NBA", "MLB"], vW: 14, vL: 31,
    winPct: 31.1, vROI: -42.3, cROI: 89.4, since: "Mar 2024", lastActive: "25m ago",
    picks: [
      { date: "May 23", game: "MIA @ ATL", bet: "MIA -1.5", odds: -110, result: "LOSS", units: -1.0 },
      { date: "May 22", game: "NYY @ BOS", bet: "NYY ML", odds: -130, result: "LOSS", units: -1.0 },
      { date: "May 21", game: "DAL @ SAC", bet: "DAL +3", odds: -108, result: "LOSS", units: -1.0 },
      { date: "May 20", game: "PHI @ ATL", bet: "PHI ML", odds: +125, result: "WIN", units: 1.25 },
      { date: "May 19", game: "MIL @ CLE", bet: "MIL -4", odds: -115, result: "LOSS", units: -1.0 },
      { date: "May 18", game: "LAD @ SF", bet: "LAD ML", odds: -145, result: "LOSS", units: -1.0 },
      { date: "May 17", game: "KC @ LAC", bet: "Over 229", odds: -110, result: "LOSS", units: -1.0 },
      { date: "May 16", game: "CLE @ MIL", bet: "CLE +5", odds: -112, result: "WIN", units: 0.89 },
    ],
  },
  {
    id: 3, handle: "KofSports_Official", platform: "twitter", tier: "certified",
    followers: 31400, sports: ["NBA", "MLB"], vW: 198, vL: 142,
    winPct: 58.2, vROI: 14.7, cROI: null, since: "Aug 2022", lastActive: "3h ago",
    picks: [
      { date: "May 23", game: "ATL @ PHI", bet: "PHI -2", odds: -110, result: "WIN", units: 0.91 },
      { date: "May 22", game: "SF @ COL", bet: "SF -1.5", odds: -125, result: "WIN", units: 0.80 },
      { date: "May 21", game: "MIL @ CLE", bet: "Under 218", odds: -108, result: "LOSS", units: -1.0 },
      { date: "May 20", game: "HOU @ DET", bet: "HOU ML", odds: -135, result: "WIN", units: 0.74 },
      { date: "May 19", game: "NYM @ WSH", bet: "NYM -1.5", odds: +105, result: "WIN", units: 1.05 },
      { date: "May 18", game: "BOS @ TB", bet: "BOS ML", odds: -120, result: "WIN", units: 0.83 },
      { date: "May 17", game: "LAC @ DEN", bet: "DEN -5.5", odds: -110, result: "LOSS", units: -1.0 },
      { date: "May 16", game: "OAK @ SEA", bet: "SEA -1.5", odds: -115, result: "WIN", units: 0.87 },
    ],
  },
  {
    id: 4, handle: "Lock_Of_The_Day99", platform: "tiktok", tier: "unverified",
    followers: 89400, sports: ["NFL"], vW: 22, vL: 41,
    winPct: 34.9, vROI: -31.7, cROI: 74.2, since: "Sep 2024", lastActive: "10m ago",
    picks: [
      { date: "May 23", game: "LAR @ ARI", bet: "LAR -7", odds: -110, result: "PENDING", units: null },
      { date: "May 21", game: "KC @ DEN", bet: "KC -6.5", odds: -112, result: "LOSS", units: -1.0 },
      { date: "May 20", game: "SF @ SEA", bet: "SF -3", odds: -110, result: "LOSS", units: -1.0 },
      { date: "May 19", game: "DAL @ NYG", bet: "DAL -9", odds: -115, result: "LOSS", units: -1.0 },
      { date: "May 18", game: "PHI @ DET", bet: "PHI -4.5", odds: -108, result: "WIN", units: 0.93 },
      { date: "May 17", game: "MIA @ BUF", bet: "BUF -10", odds: -110, result: "LOSS", units: -1.0 },
      { date: "May 16", game: "MIN @ GB", bet: "MIN +3", odds: -112, result: "LOSS", units: -1.0 },
      { date: "May 15", game: "CHI @ DET", bet: "DET -7.5", odds: -110, result: "WIN", units: 0.91 },
    ],
  },
  {
    id: 5, handle: "ValueBet_Maria", platform: "twitter", tier: "verified",
    followers: 12800, sports: ["EPL", "NBA"], vW: 87, vL: 64,
    winPct: 57.6, vROI: 11.2, cROI: null, since: "Apr 2023", lastActive: "5h ago",
    picks: [
      { date: "May 23", game: "Arsenal vs Chelsea", bet: "Arsenal -0.5", odds: +115, result: "WIN", units: 1.15 },
      { date: "May 22", game: "OKC @ MIN", bet: "OKC -3", odds: -110, result: "LOSS", units: -1.0 },
      { date: "May 21", game: "Man City vs Spurs", bet: "Man City -1.5", odds: -125, result: "WIN", units: 0.80 },
      { date: "May 20", game: "LAL @ PHX", bet: "Under 222", odds: -108, result: "WIN", units: 0.93 },
      { date: "May 19", game: "Liverpool vs Everton", bet: "Liverpool ML", odds: -180, result: "WIN", units: 0.56 },
      { date: "May 18", game: "DEN @ MIN", bet: "DEN +2", odds: -110, result: "WIN", units: 0.91 },
      { date: "May 17", game: "Chelsea vs Arsenal", bet: "Over 2.5", odds: -115, result: "LOSS", units: -1.0 },
      { date: "May 16", game: "GSW @ SAC", bet: "SAC ML", odds: +128, result: "WIN", units: 1.28 },
    ],
  },
  {
    id: 6, handle: "AlphaGrind_Sports", platform: "instagram", tier: "emerging",
    followers: 7200, sports: ["NBA", "NHL"], vW: 34, vL: 28,
    winPct: 54.8, vROI: 6.3, cROI: null, since: "Nov 2024", lastActive: "2h ago",
    picks: [
      { date: "May 23", game: "EDM @ FLA", bet: "EDM ML", odds: +130, result: "WIN", units: 1.30 },
      { date: "May 22", game: "BOS @ TOR", bet: "BOS -1.5", odds: +105, result: "LOSS", units: -1.0 },
      { date: "May 21", game: "NYR @ CAR", bet: "Under 5.5", odds: -118, result: "WIN", units: 0.85 },
      { date: "May 20", game: "IND @ MIL", bet: "IND +4", odds: -110, result: "WIN", units: 0.91 },
      { date: "May 19", game: "VGK @ DAL", bet: "DAL -1", odds: -125, result: "LOSS", units: -1.0 },
      { date: "May 18", game: "NYI @ WSH", bet: "NYI ML", odds: +142, result: "WIN", units: 1.42 },
      { date: "May 17", game: "PHX @ MIN", bet: "MIN -4", odds: -110, result: "WIN", units: 0.91 },
      { date: "May 16", game: "TBL @ BOS", bet: "BOS -1.5", odds: +112, result: "LOSS", units: -1.0 },
    ],
  },
  {
    id: 7, handle: "MegaMax_Locks", platform: "instagram", tier: "unverified",
    followers: 203000, sports: ["NFL", "NBA", "MLB", "NHL"], vW: 8, vL: 29,
    winPct: 21.6, vROI: -62.1, cROI: 112.0, since: "Jan 2025", lastActive: "5m ago",
    picks: [
      { date: "May 23", game: "MIL @ CLE", bet: "MIL ML", odds: -110, result: "LOSS", units: -1.0 },
      { date: "May 22", game: "ATL @ MIA", bet: "5-leg SGP", odds: +850, result: "LOSS", units: -1.0 },
      { date: "May 21", game: "NYY @ TB", bet: "NYY -1.5", odds: +115, result: "LOSS", units: -1.0 },
      { date: "May 20", game: "KC @ MIN", bet: "KC -5", odds: -110, result: "WIN", units: 0.91 },
      { date: "May 19", game: "BOS @ PHI", bet: "4-leg parlay", odds: +620, result: "LOSS", units: -1.0 },
      { date: "May 18", game: "LAL @ DEN", bet: "LAL +8.5", odds: -112, result: "LOSS", units: -1.0 },
      { date: "May 17", game: "SF @ LAD", bet: "LAD -1.5", odds: -130, result: "LOSS", units: -1.0 },
      { date: "May 16", game: "OKC @ PHX", bet: "OKC -6.5", odds: -110, result: "WIN", units: 0.91 },
    ],
  },
  {
    id: 8, handle: "SharpeRatio_Bets", platform: "twitter", tier: "certified",
    followers: 22100, sports: ["NFL", "MLB"], vW: 241, vL: 171,
    winPct: 58.5, vROI: 17.8, cROI: null, since: "Jun 2022", lastActive: "4h ago",
    picks: [
      { date: "May 23", game: "NYY @ BOS", bet: "BOS +1.5", odds: -130, result: "WIN", units: 0.77 },
      { date: "May 22", game: "LAD @ SF", bet: "LAD -0.5", odds: -118, result: "WIN", units: 0.85 },
      { date: "May 21", game: "HOU @ ARI", bet: "Under 8.5", odds: -110, result: "WIN", units: 0.91 },
      { date: "May 20", game: "MIA @ ATL", bet: "MIA +1.5", odds: -125, result: "LOSS", units: -1.0 },
      { date: "May 19", game: "COL @ CHC", bet: "CHC -1.5", odds: +105, result: "WIN", units: 1.05 },
      { date: "May 18", game: "SEA @ TEX", bet: "SEA +1", odds: -110, result: "WIN", units: 0.91 },
      { date: "May 17", game: "OAK @ MIN", bet: "MIN -1.5", odds: -115, result: "WIN", units: 0.87 },
      { date: "May 16", game: "TB @ NYY", bet: "TB +1.5", odds: -132, result: "LOSS", units: -1.0 },
    ],
  },
];

const mono = "'DM Mono', 'SF Mono', 'Fira Code', monospace";
const display = "'Syne', 'SF Pro Display', system-ui, sans-serif";
const body = "'DM Sans', system-ui, -apple-system, sans-serif";

function TierBadge({ tier, small }) {
  const t = TIERS[tier] || TIERS.unverified;
  return (
    <span style={{
      background: t.bg, color: t.color,
      border: `1px solid ${t.border}`,
      fontSize: small ? 9 : 10, fontWeight: 700,
      letterSpacing: "0.07em", padding: small ? "1px 5px" : "2px 7px",
      borderRadius: 3, fontFamily: mono, whiteSpace: "nowrap",
    }}>{t.label}</span>
  );
}

function PlatformIcon({ platform, size = 13 }) {
  const icons = {
    twitter:   { label: "𝕏", color: "#e2e8f0" },
    instagram: { label: "IG", color: "#e879f9" },
    tiktok:    { label: "TT", color: "#2dd4bf" },
  };
  const i = icons[platform] || icons.twitter;
  return (
    <span style={{ fontSize: size - 1, color: i.color, fontFamily: mono, fontWeight: 700, opacity: 0.9 }}>
      {i.label}
    </span>
  );
}

function ResultPill({ result }) {
  const cfg = {
    WIN:     { bg: "rgba(16,185,129,0.12)", color: C.green, border: "rgba(16,185,129,0.3)" },
    LOSS:    { bg: "rgba(239,68,68,0.12)",  color: C.red,   border: "rgba(239,68,68,0.3)" },
    PUSH:    { bg: "rgba(100,116,139,0.15)",color: C.muted, border: "rgba(100,116,139,0.3)" },
    PENDING: { bg: "rgba(245,158,11,0.1)",  color: C.amber, border: "rgba(245,158,11,0.3)" },
  };
  const c = cfg[result] || cfg.PENDING;
  return (
    <span style={{
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
      padding: "2px 7px", borderRadius: 3, fontFamily: mono,
    }}>{result}</span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: "12px 14px", flex: 1,
    }}>
      <div style={{ fontSize: 10, color: C.muted, fontFamily: mono, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: mono, color: accent || C.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontFamily: body }}>{sub}</div>}
    </div>
  );
}

function FraudBanner({ seller }) {
  const diff = (seller.cROI - seller.vROI).toFixed(1);
  return (
    <div style={{
      background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.35)",
      borderRadius: 8, padding: "14px 16px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>⚠</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.red, fontFamily: display, letterSpacing: "0.05em" }}>
          FRAUD DETECTED — RECORD INFLATION
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#fca5a5", fontFamily: body, lineHeight: 1.7 }}>
        This account publicly claims a <strong style={{ color: C.red, fontFamily: mono }}>+{seller.cROI}% ROI</strong> season-to-date.
        Our independently verified record shows{" "}
        <strong style={{ color: C.red, fontFamily: mono }}>{seller.vROI}% ROI ({seller.vW}W–{seller.vL}L)</strong>.
        <br />
        <span style={{ opacity: 0.8 }}>Discrepancy: <strong style={{ fontFamily: mono }}>{diff} percentage points.</strong> {seller.followers.toLocaleString()} people follow this account. Do not purchase picks.</span>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const roi = payload[0]?.value;
  return (
    <div style={{ background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 6, padding: "8px 12px" }}>
      <div style={{ fontSize: 11, color: C.muted, fontFamily: mono }}>Day {payload[0]?.payload?.d}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: roi >= 0 ? C.green : C.red, fontFamily: mono }}>
        {roi >= 0 ? "+" : ""}{roi}%
      </div>
    </div>
  );
}

function SellerDetail({ seller, onBack }) {
  const chartData = genROICurve(seller.vROI, seller.id);
  const isFraud = seller.cROI !== null && seller.vROI < 0;
  const roiColor = seller.vROI >= 0 ? C.green : C.red;

  return (
    <div style={{ background: C.bg, minHeight: 600, color: C.text, fontFamily: body, padding: "0 0 32px" }}>
      {/* Nav */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
          color: C.muted, fontSize: 12, padding: "5px 12px", cursor: "pointer",
          fontFamily: mono, display: "flex", alignItems: "center", gap: 6,
        }}>← Back</button>
        <span style={{ fontSize: 12, color: C.muted }}>Accountability Hub</span>
        <span style={{ color: C.muted }}>›</span>
        <span style={{ fontSize: 12, color: C.text }}>@{seller.handle}</span>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        {isFraud && <FraudBanner seller={seller} />}

        {/* Profile header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: `linear-gradient(135deg, ${TIERS[seller.tier].bg}, ${TIERS[seller.tier].border})`,
              border: `2px solid ${TIERS[seller.tier].border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontFamily: mono, color: TIERS[seller.tier].color, fontWeight: 700,
            }}>
              {seller.handle[0]}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 18, fontWeight: 700, fontFamily: display }}>@{seller.handle}</span>
                <TierBadge tier={seller.tier} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PlatformIcon platform={seller.platform} size={14} />
                <span style={{ fontSize: 11, color: C.muted, fontFamily: mono }}>{seller.followers.toLocaleString()} followers</span>
                <span style={{ fontSize: 11, color: C.muted }}>·</span>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: mono }}>Since {seller.since}</span>
                <span style={{ fontSize: 11, color: C.muted }}>·</span>
                {seller.sports.map(s => (
                  <span key={s} style={{ fontSize: 10, fontFamily: mono, color: C.blue, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", padding: "1px 6px", borderRadius: 3 }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: mono, textAlign: "right" }}>
            <div>Last active: {seller.lastActive}</div>
            <div style={{ marginTop: 2 }}>Tracking since account creation</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <StatCard label="Verified record" value={`${seller.vW}W–${seller.vL}L`} sub={`${(seller.vW + seller.vL)} tracked picks`} />
          <StatCard label="Win rate" value={`${seller.winPct}%`} sub="All tracked picks" accent={seller.winPct >= 55 ? C.green : seller.winPct >= 50 ? C.amber : C.red} />
          <StatCard label="Verified ROI" value={`${seller.vROI > 0 ? "+" : ""}${seller.vROI}%`} sub="Season-to-date" accent={roiColor} />
          {seller.cROI && <StatCard label="Claimed ROI" value={`+${seller.cROI}%`} sub="Unverified claim" accent={C.red} />}
        </div>

        {/* ROI Chart */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 16px 12px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.text, fontFamily: display }}>Cumulative ROI — 90 day window</div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: mono }}>Independently tracked · immutable record</div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <XAxis dataKey="d" tick={{ fontSize: 10, fill: C.muted, fontFamily: mono }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.muted, fontFamily: mono }} tickLine={false} axisLine={false} tickFormatter={v => `${v > 0 ? "+" : ""}${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke={C.border2} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="roi" stroke={roiColor} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Picks table */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 500, fontFamily: display }}>Verified pick history</div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: mono }}>Timestamped at post · auto-verified</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Date", "Game", "Bet", "Odds", "Result", "Units"].map(h => (
                  <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 10, color: C.muted, fontFamily: mono, letterSpacing: "0.07em", fontWeight: 500, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seller.picks.map((p, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.faint}`, background: i % 2 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  <td style={{ padding: "9px 14px", fontSize: 11, color: C.muted, fontFamily: mono }}>{p.date}</td>
                  <td style={{ padding: "9px 14px", fontSize: 11, color: C.text }}>{p.game}</td>
                  <td style={{ padding: "9px 14px", fontSize: 12, color: C.text, fontFamily: mono, fontWeight: 500 }}>{p.bet}</td>
                  <td style={{ padding: "9px 14px", fontSize: 11, fontFamily: mono, color: p.odds > 0 ? C.green : C.muted }}>{p.odds > 0 ? `+${p.odds}` : p.odds}</td>
                  <td style={{ padding: "9px 14px" }}><ResultPill result={p.result} /></td>
                  <td style={{ padding: "9px 14px", fontSize: 12, fontFamily: mono, fontWeight: 600, color: p.units === null ? C.muted : p.units > 0 ? C.green : C.red }}>
                    {p.units === null ? "—" : p.units > 0 ? `+${p.units}u` : `${p.units}u`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AccountabilityHub() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [sortKey, setSortKey] = useState("vROI");
  const [sortDir, setSortDir] = useState("desc");

  const filtered = useMemo(() => {
    return SELLERS
      .filter(s => {
        if (search && !s.handle.toLowerCase().includes(search.toLowerCase())) return false;
        if (tierFilter !== "all" && s.tier !== tierFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const m = sortDir === "desc" ? -1 : 1;
        const av = a[sortKey] ?? -999, bv = b[sortKey] ?? -999;
        return m * (av - bv);
      });
  }, [search, tierFilter, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortArrow({ k }) {
    if (sortKey !== k) return <span style={{ color: C.muted, marginLeft: 3, fontSize: 9 }}>↕</span>;
    return <span style={{ color: C.blue, marginLeft: 3, fontSize: 9 }}>{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  if (selected) return <SellerDetail seller={selected} onBack={() => setSelected(null)} />;

  const fraudCount = SELLERS.filter(s => s.cROI !== null && s.vROI < 0).length;

  return (
    <div style={{ background: C.bg, minHeight: 600, color: C.text, fontFamily: body }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: display, letterSpacing: "-0.02em" }}>Accountability Hub</div>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: mono, marginTop: 1 }}>Every public pick. Independently verified. Immutable record.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
          <span style={{ fontSize: 11, color: C.green, fontFamily: mono }}>LIVE — tracking {SELLERS.length} accounts</span>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 10, padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
        <StatCard label="Sellers tracked" value="2,847" sub="Across X, IG, TikTok" />
        <StatCard label="Picks verified today" value="142" sub="Auto-verified at close" />
        <StatCard label="Fraud alerts" value={fraudCount.toString()} sub="Record inflation detected" accent={C.red} />
        <StatCard label="Pick database" value="485K" sub="Immutable records" accent={C.purple} />
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderBottom: `1px solid ${C.border}`, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 13 }}>⌕</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search handle..."
            style={{
              width: "100%", boxSizing: "border-box", background: C.surface,
              border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 10px 7px 28px",
              color: C.text, fontSize: 12, fontFamily: body, outline: "none",
            }}
          />
        </div>
        {["all", "elite", "certified", "verified", "emerging", "unverified"].map(t => (
          <button key={t} onClick={() => setTierFilter(t)} style={{
            background: tierFilter === t ? C.surface2 : "transparent",
            border: `1px solid ${tierFilter === t ? C.border2 : C.border}`,
            borderRadius: 5, padding: "5px 11px", cursor: "pointer",
            fontSize: 10, fontFamily: mono, letterSpacing: "0.06em",
            color: tierFilter === t ? C.text : C.muted, textTransform: "uppercase",
          }}>
            {t === "all" ? "All tiers" : t}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ padding: "0 20px 24px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {[["#", null, "40px"], ["Seller", null, "auto"], ["Tier", null, "90px"], ["Record", "vW", "80px"], ["Win%", "winPct", "70px"], ["Verified ROI", "vROI", "95px"], ["Claimed", "cROI", "85px"]].map(([label, key, w]) => (
                <th key={label} onClick={key ? () => toggleSort(key) : undefined} style={{
                  padding: "10px 10px", textAlign: "left", fontSize: 10, color: C.muted,
                  fontFamily: mono, letterSpacing: "0.07em", fontWeight: 500,
                  textTransform: "uppercase", width: w,
                  cursor: key ? "pointer" : "default",
                  userSelect: "none",
                }}>
                  {label}{key && <SortArrow k={key} />}
                </th>
              ))}
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => {
              const isFraud = s.cROI !== null && s.vROI < 0;
              const roiColor = s.vROI >= 5 ? C.green : s.vROI >= 0 ? C.teal : C.red;
              return (
                <tr key={s.id} onClick={() => setSelected(s)} style={{
                  borderBottom: `1px solid ${C.faint}`,
                  background: isFraud ? "rgba(239,68,68,0.03)" : i % 2 ? "transparent" : "rgba(255,255,255,0.01)",
                  cursor: "pointer", transition: "background 0.1s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = isFraud ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.04)"}
                  onMouseLeave={e => e.currentTarget.style.background = isFraud ? "rgba(239,68,68,0.03)" : i % 2 ? "transparent" : "rgba(255,255,255,0.01)"}
                >
                  <td style={{ padding: "10px 10px", fontSize: 12, color: C.muted, fontFamily: mono }}>{i + 1}</td>
                  <td style={{ padding: "10px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: TIERS[s.tier].bg, border: `1px solid ${TIERS[s.tier].border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontFamily: mono, color: TIERS[s.tier].color, fontWeight: 700, flexShrink: 0,
                      }}>{s.handle[0]}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: display }}>@{s.handle}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <PlatformIcon platform={s.platform} size={12} />
                          <span style={{ fontSize: 10, color: C.muted, fontFamily: mono }}>{s.followers.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 10px" }}><TierBadge tier={s.tier} small /></td>
                  <td style={{ padding: "10px 10px", fontSize: 12, fontFamily: mono, color: C.text }}>
                    <span style={{ color: C.green }}>{s.vW}W</span>
                    <span style={{ color: C.muted }}> – </span>
                    <span style={{ color: C.red }}>{s.vL}L</span>
                  </td>
                  <td style={{ padding: "10px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ flex: 1, height: 3, background: C.faint, borderRadius: 2, overflow: "hidden", width: 36 }}>
                        <div style={{ height: "100%", width: `${s.winPct}%`, background: s.winPct >= 55 ? C.green : s.winPct >= 50 ? C.amber : C.red, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 12, fontFamily: mono, color: s.winPct >= 55 ? C.green : s.winPct >= 50 ? C.amber : C.red }}>{s.winPct}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 10px", fontSize: 13, fontFamily: mono, fontWeight: 700, color: roiColor }}>
                    {s.vROI > 0 ? "+" : ""}{s.vROI}%
                  </td>
                  <td style={{ padding: "10px 10px" }}>
                    {s.cROI ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 11, fontFamily: mono, color: C.red, fontWeight: 600 }}>+{s.cROI}%</span>
                        <span style={{ fontSize: 9, background: "rgba(239,68,68,0.15)", color: C.red, border: "1px solid rgba(239,68,68,0.3)", borderRadius: 3, padding: "1px 4px", fontFamily: mono, fontWeight: 700 }}>FRAUD</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: C.muted, fontFamily: mono }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 10px" }}>
                    <button style={{
                      background: "transparent", border: `1px solid ${C.border}`,
                      borderRadius: 5, padding: "4px 10px", cursor: "pointer",
                      fontSize: 11, color: C.muted, fontFamily: mono,
                    }}>View →</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.muted, fontSize: 13 }}>No sellers match your filters.</div>
        )}
      </div>
    </div>
  );
}
