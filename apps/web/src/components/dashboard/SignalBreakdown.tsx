"use client";

import { useState } from "react";

interface Signals {
  sharpMoney:   number;
  lineMovement: number;
  matchup:      number;
  publicMoney:  number;
  sentiment:    number;
  playerTrend:  number;
  pickTracker:  number;
  scheduleEdge: number;
}

// Plain-English display config for each signal
const SIGNAL_META: Record<keyof Signals, {
  label:      string;
  icon:       string;
  tip:        string;               // beginner tooltip
  highLabel:  string;               // what a high value means
  lowLabel:   string;               // what a low value means
}> = {
  sharpMoney: {
    label:     "Sharp Money",
    icon:      "⚡",
    tip:       "Professional bettors (sharps) are placing large wagers on this side. Sharps win long-term, so following them is smart.",
    highLabel: "Sharps betting this side",
    lowLabel:  "Sharps fading this side",
  },
  lineMovement: {
    label:     "Line Movement",
    icon:      "📈",
    tip:       "The odds have shifted since opening. When a line moves toward a side without heavy public betting, it usually means sharp money moved it.",
    highLabel: "Line moving in this direction",
    lowLabel:  "Line moving against this side",
  },
  matchup: {
    label:     "Book Consensus",
    icon:      "📊",
    tip:       "How closely sportsbooks agree on this price. Tight agreement means the market is certain. Wide spread means uncertainty.",
    highLabel: "Books tightly aligned",
    lowLabel:  "Books disagree on price",
  },
  publicMoney: {
    label:     "Public vs Sharp",
    icon:      "🔀",
    tip:       "Compares where the general public is betting versus where sharp money is going. The best edges happen when they diverge.",
    highLabel: "Sharps vs public divergence (edge)",
    lowLabel:  "Public piling in (risky)",
  },
  sentiment: {
    label:     "Team Buzz",
    icon:      "📰",
    tip:       "News, injuries, and social media sentiment around this team right now. Positive news = favorable, negative news or injuries = unfavorable.",
    highLabel: "Positive news & momentum",
    lowLabel:  "Negative news or injuries",
  },
  playerTrend: {
    label:     "Health",
    icon:      "🏥",
    tip:       "How healthy is this team? Significant injury concerns drag this score down. Full health = 100.",
    highLabel: "Team healthy",
    lowLabel:  "Injury concerns",
  },
  pickTracker: {
    label:     "Cappers",
    icon:      "🎯",
    tip:       "Verified sports betting experts (cappers) with proven track records. Their trust-weighted consensus on this side.",
    highLabel: "Verified cappers lean this way",
    lowLabel:  "Cappers lean against",
  },
  scheduleEdge: {
    label:     "Rest Edge",
    icon:      "😴",
    tip:       "Which team has had more rest since their last game? A well-rested team has a slight physical edge over a fatigued opponent.",
    highLabel: "Rest advantage",
    lowLabel:  "Playing on shorter rest",
  },
};

function signalColor(value: number): string {
  if (value >= 65) return "#10b981"; // green
  if (value <= 40) return "#f59e0b"; // amber
  return "#8a9ab5";                  // muted
}

function SignalRow({ name, value }: { name: keyof Signals; value: number }) {
  const [showTip, setShowTip] = useState(false);
  const meta  = SIGNAL_META[name];
  const color = signalColor(value);
  const isNeutral = value >= 45 && value <= 55;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowTip(!showTip)}
          className="flex items-center gap-1.5 text-[11px] text-muted hover:text-text transition-colors"
        >
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
          <span className="text-[9px] opacity-40">ⓘ</span>
        </button>
        <span className="text-[11px] font-mono font-semibold" style={{ color: isNeutral ? "#8a9ab5" : color }}>
          {isNeutral ? "—" : value >= 65 ? meta.highLabel.split(" ").slice(0, 2).join(" ") : meta.lowLabel.split(" ").slice(0, 2).join(" ")}
        </span>
      </div>

      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: isNeutral ? "#8a9ab5" : color }}
        />
      </div>

      {showTip && (
        <p className="text-[10px] text-muted bg-white/[0.03] border border-border rounded px-2 py-1.5 leading-relaxed">
          {meta.tip}
        </p>
      )}
    </div>
  );
}

interface Props {
  signals:     Signals;
  dataQuality: number;
  expanded?:   boolean;
}

export function SignalBreakdown({ signals, dataQuality, expanded = false }: Props) {
  const [open, setOpen] = useState(expanded);

  // Sort: strongest signals first (furthest from 50 = most informative)
  const sorted = (Object.entries(signals) as [keyof Signals, number][])
    .sort(([, a], [, b]) => Math.abs(b - 50) - Math.abs(a - 50));

  // Always show top 3, rest behind toggle
  const alwaysVisible = sorted.slice(0, 3);
  const hidden        = sorted.slice(3);
  const activeCount   = Math.round(dataQuality * 8);

  return (
    <div className="space-y-2 border-t border-border pt-2">
      <div className="space-y-2">
        {alwaysVisible.map(([name, value]) => (
          <SignalRow key={name} name={name} value={value} />
        ))}
      </div>

      {open && (
        <div className="space-y-2 mt-1">
          {hidden.map(([name, value]) => (
            <SignalRow key={name} name={name} value={value} />
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="w-full text-[10px] font-mono text-muted hover:text-text transition-colors pt-1 flex items-center justify-center gap-1"
      >
        {open ? "▲ Less detail" : `▼ ${hidden.length} more signals`}
        {activeCount < 8 && (
          <span className="opacity-50 ml-1">({activeCount}/8 active)</span>
        )}
      </button>
    </div>
  );
}
