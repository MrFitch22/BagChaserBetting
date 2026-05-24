import { useState, useMemo } from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";

(() => {
  if (typeof document === "undefined") return;
  const s = document.createElement("style");
  s.textContent = `@import url('https://cdn.jsdelivr.net/npm/@fontsource/syne@5/index.css');@import url('https://cdn.jsdelivr.net/npm/@fontsource/dm-mono@5/index.css');
  @keyframes pulse-blue { 0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0)} 50%{box-shadow:0 0 0 4px rgba(59,130,246,0.2)} }
  @keyframes pulse-amber { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0)} 50%{box-shadow:0 0 0 4px rgba(245,158,11,0.2)} }
  @keyframes slide-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }`;
  document.head.appendChild(s);
})();

const C = {
  bg:"#070a0f", surface:"#0d1119", surface2:"#111824", surface3:"#161e2e",
  border:"rgba(255,255,255,0.07)", border2:"rgba(255,255,255,0.13)",
  text:"#dce4f0", muted:"#475569", faint:"#111827",
  A:"#3b82f6", Alight:"rgba(59,130,246,0.08)", Aborder:"rgba(59,130,246,0.22)",
  B:"#f59e0b", Blight:"rgba(245,158,11,0.08)", Bborder:"rgba(245,158,11,0.22)",
  green:"#10b981", red:"#ef4444", purple:"#a78bfa", teal:"#2dd4bf",
};
const mono = "'DM Mono','SF Mono',monospace";
const disp = "'Syne',system-ui,sans-serif";
const body = "system-ui,-apple-system,sans-serif";

// ─── GAME DATA ────────────────────────────────────────────────────────────────
const GAMES = [
  { id:"kc-bal", homeAbbr:"KC", homeName:"Kansas City Chiefs",
    awayAbbr:"BAL", awayName:"Baltimore Ravens",
    date:"Sep 5, 2025", time:"8:20 PM ET", venue:"M&T Bank Stadium",
    spread:{ fav:"KC", line:-3.5 }, total:47.5, confidence:72, sharpSide:"KC" },
  { id:"dal-phi", homeAbbr:"DAL", homeName:"Dallas Cowboys",
    awayAbbr:"PHI", awayName:"Philadelphia Eagles",
    date:"Sep 7, 2025", time:"4:25 PM ET", venue:"AT&T Stadium",
    spread:{ fav:"PHI", line:-2.5 }, total:44.5, confidence:61, sharpSide:"PHI" },
];

// ─── MATCHUP DATA ────────────────────────────────────────────────────────────
// KC Offense vs BAL Defense
const MATCHUPS = {
  "kc-bal": {
    home_off: [
      {
        id:"qb", group:"Quarterback", icon:"QB", category:"passing",
        offPlayers:[{
          name:"Patrick Mahomes", pos:"QB", grade:92.3, form:"hot",
          metrics:{"PFF Grade":92.3,"EPA/play":"+0.38","CPOE":"+6.2%","Comp%":"67.1%","vs Blitz":"71.4%","Deep Ball TDs":8},
          transactions:[],
        }],
        defPlayers:[{
          name:"BAL Pass Rush", pos:"D-LINE", grade:83.1, form:"neutral",
          metrics:{"PFF Pressure Grade":83.1,"Pressure Rate":"28.3%","Sacks/game":2.8,"Blitz Rate":"31.2%","Hurry Rate":"18.4%","Run Stop%":"82.1%"},
          transactions:[{type:"re-sign",player:"Justin Madubuike",note:"Interior anchor re-signed 4yr",scoreDelta:+2.8}],
        }],
        advantage:8, label:"KC EDGE", radarScore:{ off:94, def:83 },
        battle:"Mahomes converts 71% vs blitz — BAL's primary pressure package",
        confImpact:"+4.2 pts to KC spread score",
        txHighlight:null,
      },
      {
        id:"wr-sec", group:"WR / TE vs Secondary", icon:"WR", category:"passing",
        offPlayers:[
          { name:"Travis Kelce", pos:"TE", grade:89.2, form:"hot",
            metrics:{"PFF Grade":89.2,"Route Win%":"72%","Sep (yds)":3.1,"Yds/route":2.4,"Tgt Share":"22%","Red Zone Tgts":14},
            transactions:[] },
          { name:"Rashee Rice", pos:"WR1", grade:84.1, form:"neutral",
            metrics:{"PFF Grade":84.1,"Route Win%":"68%","Sep (yds)":2.9,"YAC/rec":4.8,"Tgt Share":"19%","Slot%":"38%"},
            transactions:[] },
        ],
        defPlayers:[
          { name:"Kyle Hamilton", pos:"S", grade:91.3, form:"hot",
            metrics:{"Cover Grade":91.3,"Yds/tgt allowed":6.1,"PBU Rate":"12.4%","Man Cover":88.4,"Tckl Eff%":"94%","Qb Rating vs":"71.2"},
            transactions:[{type:"extension",player:"Kyle Hamilton",note:"4yr $96M extension locked in",scoreDelta:+1.5}] },
          { name:"Marlon Humphrey", pos:"CB1", grade:85.2, form:"neutral",
            metrics:{"Cover Grade":85.2,"Yds/tgt allowed":7.2,"PBU Rate":"9.8%","Man Cover":84.1,"Shadow CB":true,"Qb Rating vs":"78.4"},
            transactions:[] },
        ],
        advantage:4, label:"SLIGHT KC EDGE", radarScore:{ off:88, def:86 },
        battle:"Kelce vs Hamilton — best Kelce coverage matchup in the NFL this season",
        confImpact:"+2.1 pts to KC passing props",
        txHighlight:"hamilton-ext",
      },
      {
        id:"rb-ld", group:"RB vs Run Defense", icon:"RB", category:"rushing",
        offPlayers:[{
          name:"Isiah Pacheco", pos:"RB", grade:78.3, form:"neutral",
          metrics:{"PFF Grade":78.3,"YPC":4.2,"Breakaway Rate":"18%","Yards After Contact":2.6,"Pass Block Grade":71.2,"Route Grade":68.1},
          transactions:[] }],
        defPlayers:[{
          name:"BAL Run Defense", pos:"D-LINE/LB", grade:89.4, form:"hot",
          metrics:{"Run Stop%":"89.4%","Yards Allowed/carry":3.4,"PFF Run Grade":88.1,"Stuffed%":"22.3%","LB Tackle Eff%":"91.2%","Gap Control":87.4},
          transactions:[{type:"signing",player:"Derrick Lloyd",note:"Signed blocking TE adds TE-run block dimension",scoreDelta:+1.2}] }],
        advantage:-11, label:"BAL EDGE", radarScore:{ off:73, def:89 },
        battle:"BAL's run defense ranks 2nd in NFL — Pacheco will need to win in the passing game",
        confImpact:"-3.8 pts to KC rushing props",
        txHighlight:null,
      },
      {
        id:"ol-dl", group:"OL vs Pass Rush", icon:"OL", category:"protection",
        offPlayers:[{
          name:"KC Offensive Line", pos:"OL", grade:81.2, form:"neutral",
          metrics:{"Pass Block Win Rate":"68.2%","PFF Pass Block":81.2,"Pressure Allowed/game":2.1,"Sacks Allowed":18,"Run Block Win%":"71.4%","Left Tackle Grade":83.1},
          transactions:[{type:"signing",player:"Joe Thuney",note:"Re-signed LG — interior continuity maintained",scoreDelta:+1.8}] }],
        defPlayers:[{
          name:"Odafe Ojabo / Kyle Van Noy", pos:"EDGE", grade:82.3, form:"neutral",
          metrics:{"PFF Pass Rush":82.3,"Pressure Rate":"22.1%","Sack Rate":"7.8%","Win Rate vs OT":"51.2%","Bull Rush Win%":"38.1%","Speed Rush Win%":"54.2%"},
          transactions:[] }],
        advantage:3, label:"SLIGHT KC EDGE", radarScore:{ off:82, def:79 },
        battle:"KC's interior OL handles interior pressure well — Ojabo speed off edge is the threat",
        confImpact:"+1.4 pts to Mahomes under-pressure props",
        txHighlight:null,
      },
    ],
    away_off: [
      {
        id:"lj-def", group:"Lamar Jackson vs KC Defense", icon:"QB", category:"passing",
        offPlayers:[{
          name:"Lamar Jackson", pos:"QB", grade:91.1, form:"hot",
          metrics:{"PFF Grade":91.1,"EPA/play":"+0.34","CPOE":"+4.8%","Rushing Yds":312,"Scramble Rate":"18.2%","TD/INT":"9:3"},
          transactions:[] }],
        defPlayers:[{
          name:"KC Secondary / LB", pos:"DEF", grade:84.2, form:"neutral",
          metrics:{"Cover Grade":84.2,"Yds/tgt allowed":7.8,"Contain%":"68.1%","Zone Cover Grade":82.1,"vs Mobile QB":"71.4","QB Contain Rate":"64.2%"},
          transactions:[{type:"signing",player:"Trent McDuffie",note:"Extension — locks in CB1 coverage",scoreDelta:+2.1}] }],
        advantage:6, label:"BAL EDGE", radarScore:{ off:91, def:80 },
        battle:"Lamar's dual-threat creates contain issues — KC ranks 18th vs scrambling QBs",
        confImpact:"+3.6 pts to BAL spread score",
        txHighlight:null,
      },
      {
        id:"henry-lbs", group:"Derrick Henry vs KC LBs", icon:"RB", category:"rushing",
        offPlayers:[{
          name:"Derrick Henry", pos:"RB", grade:88.4, form:"hot",
          metrics:{"PFF Grade":88.4,"YPC":4.9,"Breakaway Rate":"28.4%","Yards After Contact":3.4,"Carries 20+ yds":11,"Forced Miss Tckl":38},
          transactions:[{type:"signing",player:"Derrick Henry",note:"Signed from TEN — transforms BAL ground game",scoreDelta:+16.8,isImpact:true}] }],
        defPlayers:[{
          name:"Nick Bolton / Drue Tranquill", pos:"LB", grade:76.1, form:"cold",
          metrics:{"PFF Run Defense":76.1,"Tackle Eff%":"82.4%","Missed Tckl Rate":"11.2%","Yards After Contact Allowed":2.8,"LB vs Power Run":"71.3%","Blitz Win%":"44.1%"},
          transactions:[] }],
        advantage:14, label:"BAL STRONG EDGE", radarScore:{ off:88, def:71 },
        battle:"Henry vs KC LBs — biggest positional mismatch in this game. Henry gained 8.7 YPC on power runs in 2024",
        confImpact:"+7.1 pts to BAL rushing props, +2.4 pts to BAL spread confidence",
        txHighlight:"henry-signing",
      },
      {
        id:"bal-wr-kc-sec", group:"BAL WR vs KC Secondary", icon:"WR", category:"passing",
        offPlayers:[
          { name:"Zay Flowers", pos:"WR1", grade:82.1, form:"neutral",
            metrics:{"PFF Grade":82.1,"Route Win%":"64%","Sep (yds)":2.6,"YAC/rec":5.1,"Tgt Share":"21%","Slot%":"62%"},
            transactions:[] },
          { name:"Nelson Agholor", pos:"WR2", grade:73.4, form:"neutral",
            metrics:{"PFF Grade":73.4,"Route Win%":"59%","Sep (yds)":2.1,"YAC/rec":3.2,"Tgt Share":"14%","Deep Target%":"24%"},
            transactions:[] },
        ],
        defPlayers:[
          { name:"Trent McDuffie", pos:"CB1", grade:86.3, form:"hot",
            metrics:{"Cover Grade":86.3,"Yds/tgt allowed":6.4,"PBU Rate":"11.2%","Man Cover":85.1,"Shadow CB":true,"Qb Rating vs":"74.1"},
            transactions:[{type:"extension",player:"Trent McDuffie",note:"3yr extension keeps elite CB1",scoreDelta:+2.1}] },
          { name:"Jaylen Watson", pos:"CB2", grade:76.2, form:"neutral",
            metrics:{"Cover Grade":76.2,"Yds/tgt allowed":8.1,"PBU Rate":"7.4%","Man Cover":74.3,"Zone Grade":79.1,"Qb Rating vs":"82.4"},
            transactions:[] },
        ],
        advantage:-3, label:"EVEN / SLIGHT KC EDGE", radarScore:{ off:78, def:81 },
        battle:"McDuffie likely shadows Flowers — matchup becomes Agholor vs Watson in intermediate routes",
        confImpact:"Neutral — effectively a wash on pass coverage",
        txHighlight:"mcduffie-ext",
      },
      {
        id:"bal-ol-kc-dl", group:"BAL OL vs Chris Jones", icon:"OL", category:"protection",
        offPlayers:[{
          name:"BAL Offensive Line", pos:"OL", grade:85.4, form:"hot",
          metrics:{"Pass Block Win Rate":"71.4%","PFF Pass Block":85.4,"Pressure Allowed/game":1.8,"Sacks Allowed":12,"Run Block Win%":"78.2%","Left Tackle Grade":88.1},
          transactions:[] }],
        defPlayers:[{
          name:"Chris Jones", pos:"DT/EDGE", grade:93.2, form:"hot",
          metrics:{"PFF Pass Rush":93.2,"Pressure Rate":"34.1%","Sack Rate":"11.2%","Win Rate vs OG":"64.2%","Double Team Win%":"41%","Interior Pressure":88.4},
          transactions:[{type:"extension",player:"Chris Jones",note:"Franchise cornerstone — elite interior disruption",scoreDelta:+0}] }],
        advantage:-9, label:"KC EDGE (Chris Jones)", radarScore:{ off:82, def:91 },
        battle:"Chris Jones is the best interior rusher in football — BAL OL will face significant pressure on critical downs",
        confImpact:"-2.8 pts to BAL passing props on standard downs",
        txHighlight:null,
      },
    ],
  },
};

// ─── TRANSACTIONS ────────────────────────────────────────────────
const TRANSACTIONS = [
  {
    id:"henry-signing", type:"signing", date:"Mar 14, 2025",
    player:"Derrick Henry", fromTeam:"TEN (FA)", toTeam:"BAL",
    position:"RB", contract:"2yr / $16M",
    impactScore:+16.8, impactTeam:"BAL",
    affectedGroups:["henry-lbs"],
    before:{ groupScore:72, label:"BAL Rush Grade" },
    after:{ groupScore:89, label:"BAL Rush Grade" },
    analysis:"Transforms BAL from average rushing team (19th) to elite (2nd projected). Henry's power running style perfectly complements Lamar's zone read — creates a true dual-threat ground game. KC LBs ranked 22nd in run defense efficiency; this is a significant mismatch.",
    betImpact:[
      { market:"BAL -3.5 Rush Props (150+ yds)", before:41, after:68 },
      { market:"BAL Rushing TD anytime", before:38, after:57 },
      { market:"BAL spread confidence", before:61, after:69 },
    ],
  },
  {
    id:"hamilton-ext", type:"extension", date:"Feb 28, 2025",
    player:"Kyle Hamilton", fromTeam:"BAL", toTeam:"BAL",
    position:"S", contract:"4yr / $96M",
    impactScore:+1.5, impactTeam:"BAL",
    affectedGroups:["wr-sec"],
    before:{ groupScore:88, label:"BAL Secondary Grade" },
    after:{ groupScore:90, label:"BAL Secondary Grade" },
    analysis:"Hamilton is the best safety in the NFL. This extension removes any uncertainty about BAL secondary continuity and signals Hamilton will continue his elite Kelce-coverage role. Grades as the single most effective Kelce stopper in 2024 — held Kelce to 58 yards across 2 matchups.",
    betImpact:[
      { market:"Travis Kelce Over 65.5 receiving yds", before:58, after:44 },
      { market:"BAL team defense confidence", before:84, after:86 },
    ],
  },
  {
    id:"mcduffie-ext", type:"extension", date:"Mar 3, 2025",
    player:"Trent McDuffie", fromTeam:"KC", toTeam:"KC",
    position:"CB", contract:"3yr / $72M",
    impactScore:+2.1, impactTeam:"KC",
    affectedGroups:["bal-wr-kc-sec"],
    before:{ groupScore:79, label:"KC Secondary Grade" },
    after:{ groupScore:82, label:"KC Secondary Grade" },
    analysis:"McDuffie's extension locks in KC's CB1 through 2027. Elite shadow corner with the speed to match Zay Flowers underneath. His containment of BAL's slot receiver attack neutralizes one of Lamar's favorite short-game weapons — significantly reduces BAL's quick passing efficiency.",
    betImpact:[
      { market:"Zay Flowers Over 55.5 receiving yds", before:54, after:42 },
      { market:"KC spread confidence", before:69, after:71 },
    ],
  },
  {
    id:"aiyuk-trade", type:"trade", date:"Mar 18, 2025",
    player:"Brandon Aiyuk", fromTeam:"SF", toTeam:"PHI",
    position:"WR1", contract:"Existing (3yr remaining)",
    impactScore:+11.4, impactTeam:"PHI",
    affectedGroups:[],
    analysis:"Aiyuk to PHI adds elite WR1 alongside DeVonta Smith. PHI receiving corps now potentially the best in the NFC. Route win rate of 71% will stress any secondary. Direct impact on PHI pass game projection — significant upgrade from current WR depth.",
    betImpact:[
      { market:"PHI WR1 receiving yds props", before:null, after:null },
      { market:"PHI spread vs DAL", before:58, after:66 },
    ],
  },
  {
    id:"davante-nyj", type:"trade", date:"Mar 22, 2025",
    player:"Davante Adams", fromTeam:"LV", toTeam:"NYJ",
    position:"WR1", contract:"2yr / $35M",
    impactScore:+9.2, impactTeam:"NYJ",
    affectedGroups:[],
    analysis:"Adams reunites with Rodgers after their GB chemistry produced 3 consecutive 1,000+ yard seasons. Route running precision (76% win rate) gives Rodgers a reliable target in critical situations. NYJ receiving grade jumps from 24th to 9th projected.",
    betImpact:[
      { market:"NYJ passing props (game)", before:49, after:61 },
      { market:"Aaron Rodgers TD passes (season)", before:22, after:29 },
    ],
  },
  {
    id:"parsons-ext", type:"extension", date:"Mar 8, 2025",
    player:"Micah Parsons", fromTeam:"DAL", toTeam:"DAL",
    position:"EDGE/LB", contract:"5yr / $198M",
    impactScore:+3.2, impactTeam:"DAL",
    affectedGroups:[],
    analysis:"Parsons locked in as the most versatile pass rusher in the NFL. Operates from 7 different alignments — creates pre-snap complexity impossible to solve. DAL pass rush grade was already 1st in NFC; this extension ensures continuity. Direct impact: opposing QBs average 0.26 lower EPA/play when Parsons is lined up.",
    betImpact:[
      { market:"DAL sacks (game)", before:44, after:51 },
      { market:"DAL pass rush confidence vs PHI", before:71, after:74 },
    ],
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────
function txColor(type) {
  return { signing:"#10b981", trade:"#3b82f6", extension:"#a78bfa", release:"#ef4444", draft:"#f59e0b" }[type] || C.muted;
}
function advColor(adv) {
  if (adv > 8) return C.A;
  if (adv < -8) return C.B;
  if (adv > 3) return "#60a5fa";
  if (adv < -3) return "#fbbf24";
  return C.muted;
}
function advLabel(adv) {
  if (adv > 12) return "DOMINANT EDGE";
  if (adv > 7) return "STRONG EDGE";
  if (adv > 3) return "SLIGHT EDGE";
  if (adv < -12) return "DOMINANT EDGE";
  if (adv < -7) return "STRONG EDGE";
  if (adv < -3) return "SLIGHT EDGE";
  return "EVEN";
}

// ─── SUBCOMPONENTS ───────────────────────────────────────────────

function AdvantageMeter({ advantage, max = 18, teamAColor, teamBColor }) {
  const pct = Math.min(Math.abs(advantage) / max * 50, 50);
  const isA = advantage >= 0;
  return (
    <div style={{ position:"relative", height:6, background:C.faint, borderRadius:3, overflow:"hidden" }}>
      <div style={{ position:"absolute", left:"50%", top:0, width:1, height:"100%", background:C.muted, zIndex:2 }} />
      <div style={{
        position:"absolute", top:0, height:"100%",
        width:`${pct}%`,
        left: isA ? `${50 - pct}%` : "50%",
        background: isA ? (teamAColor || C.A) : (teamBColor || C.B),
        transition:"all 0.4s ease",
      }} />
    </div>
  );
}

function MetricRow({ label, value, highlight }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"3px 0", borderBottom:`1px solid ${C.faint}` }}>
      <span style={{ fontSize:11, color:C.muted, fontFamily:body }}>{label}</span>
      <span style={{ fontSize:12, fontFamily:mono, color: highlight ? C.green : C.text, fontWeight: highlight ? 600 : 400 }}>{value}</span>
    </div>
  );
}

function PlayerCard({ player, side, expanded, txHighlight }) {
  const hasActiveTx = player.transactions?.length > 0;
  const borderColor = side === "off" ? C.Aborder : C.Bborder;
  const bgColor = side === "off" ? C.Alight : C.Blight;

  return (
    <div style={{
      background: bgColor, border:`1px solid ${borderColor}`,
      borderRadius:8, padding:"10px 12px",
      animation: hasActiveTx && txHighlight ? "slide-in 0.3s ease" : "none",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
        <div>
          <span style={{ fontSize:13, fontWeight:600, fontFamily:disp, color:C.text }}>{player.name}</span>
          <span style={{ fontSize:10, fontFamily:mono, color: side === "off" ? C.A : C.B, marginLeft:6,
            background: side === "off" ? "rgba(59,130,246,0.15)" : "rgba(245,158,11,0.15)",
            padding:"1px 5px", borderRadius:3 }}>{player.pos}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          {player.form === "hot" && <span style={{ fontSize:9, fontFamily:mono, background:"rgba(16,185,129,0.15)", color:C.green, padding:"1px 5px", borderRadius:3 }}>HOT</span>}
          {player.form === "cold" && <span style={{ fontSize:9, fontFamily:mono, background:"rgba(239,68,68,0.15)", color:C.red, padding:"1px 5px", borderRadius:3 }}>COLD</span>}
          <span style={{ fontSize:12, fontFamily:mono, fontWeight:700, color: side === "off" ? C.A : C.B }}>{player.grade}</span>
        </div>
      </div>

      {/* Key metrics — always show first 3 */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:"4px 8px" }}>
        {Object.entries(player.metrics).slice(0, expanded ? 99 : 4).map(([k, v]) => (
          <div key={k} style={{ fontSize:11, color:C.muted }}>
            <span>{k}: </span>
            <span style={{ color:C.text, fontFamily:mono }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Transaction badges */}
      {player.transactions?.map((tx, i) => (
        <div key={i} style={{
          marginTop:7, padding:"5px 8px", borderRadius:5,
          background:`rgba(${tx.type === "signing" ? "16,185,129" : tx.type === "extension" ? "167,139,250" : "59,130,246"},0.1)`,
          border:`1px solid rgba(${tx.type === "signing" ? "16,185,129" : tx.type === "extension" ? "167,139,250" : "59,130,246"},0.25)`,
        }}>
          <span style={{ fontSize:9, fontFamily:mono, textTransform:"uppercase", letterSpacing:"0.07em",
            color: txColor(tx.type), marginRight:6 }}>{tx.type}</span>
          <span style={{ fontSize:11, color:C.text }}>{tx.player}</span>
          {tx.scoreDelta > 0 && <span style={{ fontSize:10, fontFamily:mono, color:C.green, marginLeft:6 }}>+{tx.scoreDelta} grade</span>}
          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{tx.note}</div>
        </div>
      ))}
    </div>
  );
}

function PositionRow({ matchup, teamA, teamB, highlightTx, perspective }) {
  const [expanded, setExpanded] = useState(false);
  const isHighlighted = matchup.txHighlight && matchup.txHighlight === highlightTx;
  const adv = perspective === "home" ? matchup.advantage : -matchup.advantage;
  const advTeam = adv >= 0 ? teamA : teamB;

  return (
    <div style={{
      border:`1px solid ${isHighlighted ? C.border2 : C.border}`,
      borderRadius:10, marginBottom:10, overflow:"hidden",
      background: isHighlighted ? C.surface2 : C.surface,
      transition:"border-color 0.2s",
    }}>
      {/* Header row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 14px", borderBottom:`1px solid ${C.border}`, cursor:"pointer" }}
        onClick={() => setExpanded(e => !e)}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:10, fontFamily:mono, fontWeight:700, color:C.muted, background:C.surface2,
            padding:"2px 7px", borderRadius:3, letterSpacing:"0.07em" }}>{matchup.icon}</span>
          <span style={{ fontSize:13, fontWeight:600, fontFamily:disp }}>{matchup.group}</span>
          {isHighlighted && <span style={{ fontSize:9, fontFamily:mono, background:"rgba(167,139,250,0.15)", color:C.purple,
            border:"1px solid rgba(167,139,250,0.3)", padding:"1px 6px", borderRadius:3 }}>TRANSACTION IMPACT</span>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:11, fontFamily:mono, fontWeight:700, color:advColor(adv) }}>
            {advTeam} {advLabel(adv)}
          </span>
          <span style={{ fontSize:12, color:C.muted }}>{expanded ? "↑" : "↓"}</span>
        </div>
      </div>

      <div style={{ padding:"12px 14px" }}>
        {/* Three-column matchup layout */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 1fr", gap:12, alignItems:"center" }}>
          {/* Team A (offense or home) */}
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {matchup.offPlayers.map(p => (
              <PlayerCard key={p.name} player={p} side="off" expanded={expanded} txHighlight={isHighlighted} />
            ))}
          </div>

          {/* Center: advantage */}
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:11, fontFamily:mono, color:C.muted, marginBottom:6 }}>ADV</div>
            <AdvantageMeter advantage={adv} />
            <div style={{ fontSize:18, fontWeight:700, fontFamily:mono, color:advColor(adv), margin:"8px 0",
              lineHeight:1 }}>{adv > 0 ? "+" : ""}{adv}</div>
            <div style={{ fontSize:9, fontFamily:mono, color:advColor(adv), letterSpacing:"0.06em",
              textTransform:"uppercase" }}>{advLabel(adv)}</div>
          </div>

          {/* Team B (defense or away) */}
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {matchup.defPlayers.map(p => (
              <PlayerCard key={p.name} player={p} side="def" expanded={expanded} txHighlight={isHighlighted} />
            ))}
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div style={{ marginTop:12, padding:"10px 12px", background:C.surface2, borderRadius:8,
            border:`1px solid ${C.border}`, animation:"slide-in 0.2s ease" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
              <div>
                <div style={{ fontSize:10, color:C.muted, fontFamily:mono, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Key battle</div>
                <div style={{ fontSize:12, color:C.text, lineHeight:1.6 }}>{matchup.battle}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:C.muted, fontFamily:mono, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Confidence impact</div>
                <div style={{ fontSize:13, fontFamily:mono, color:C.green, fontWeight:600 }}>{matchup.confImpact}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:C.muted, fontFamily:mono, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Position grades</div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:11, color:C.A, fontFamily:mono }}>{teamA} OFF: {matchup.radarScore.off}</span>
                  <span style={{ fontSize:11, color:C.B, fontFamily:mono }}>{teamB} DEF: {matchup.radarScore.def}</span>
                </div>
                <AdvantageMeter advantage={matchup.radarScore.off - matchup.radarScore.def} max={20} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionCard({ tx, isSelected, onClick }) {
  return (
    <div onClick={onClick} style={{
      border:`1px solid ${isSelected ? "rgba(167,139,250,0.4)" : C.border}`,
      borderLeft:`3px solid ${txColor(tx.type)}`,
      borderRadius:8, padding:"12px 14px", cursor:"pointer",
      background: isSelected ? "rgba(167,139,250,0.05)" : C.surface,
      transition:"all 0.15s", marginBottom:8,
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
        <div>
          <span style={{ fontSize:10, fontFamily:mono, textTransform:"uppercase", letterSpacing:"0.07em",
            color:txColor(tx.type), marginRight:8 }}>{tx.type}</span>
          <span style={{ fontSize:14, fontWeight:600, fontFamily:disp }}>{tx.player}</span>
        </div>
        <span style={{ fontSize:13, fontFamily:mono, fontWeight:700,
          color: tx.impactScore >= 0 ? C.green : C.red }}>
          {tx.impactScore >= 0 ? "+" : ""}{tx.impactScore}
        </span>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:11, color:C.muted }}>{tx.fromTeam} → {tx.toTeam}</span>
        <span style={{ fontSize:10, fontFamily:mono, background:C.surface2, padding:"1px 6px",
          borderRadius:3, color:C.muted, border:`1px solid ${C.border}` }}>{tx.position}</span>
        <span style={{ fontSize:10, fontFamily:mono, color:C.muted }}>{tx.date}</span>
        {tx.contract && <span style={{ fontSize:10, color:C.muted }}>{tx.contract}</span>}
      </div>

      <div style={{ fontSize:12, color:C.muted, lineHeight:1.55, marginBottom: isSelected ? 10 : 0 }}>{tx.analysis}</div>

      {isSelected && tx.betImpact?.length > 0 && (
        <div style={{ marginTop:10, padding:"10px 12px", background:C.surface2, borderRadius:6,
          border:`1px solid ${C.border}`, animation:"slide-in 0.2s ease" }}>
          <div style={{ fontSize:10, fontFamily:mono, color:C.muted, textTransform:"uppercase",
            letterSpacing:"0.07em", marginBottom:8 }}>Confidence score impact</div>
          {tx.betImpact.filter(b => b.before).map((b, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <span style={{ fontSize:11, color:C.text, flex:1 }}>{b.market}</span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:12, fontFamily:mono, color:C.muted }}>{b.before}</span>
                <span style={{ fontSize:10, color:C.muted }}>→</span>
                <span style={{ fontSize:13, fontFamily:mono, fontWeight:700,
                  color: b.after > b.before ? C.green : C.red }}>{b.after}</span>
                <span style={{ fontSize:10, fontFamily:mono,
                  color: b.after > b.before ? C.green : C.red }}>
                  ({b.after > b.before ? "+" : ""}{b.after - b.before})
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RADAR CHART ────────────────────────────────────────────────
function RadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:6, padding:"8px 12px" }}>
      <div style={{ fontSize:11, color:C.A, fontFamily:mono }}>{payload[0]?.name}: {payload[0]?.value}</div>
      <div style={{ fontSize:11, color:C.B, fontFamily:mono }}>{payload[1]?.name}: {payload[1]?.value}</div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────
export default function MatchupAnalyzer() {
  const [selectedGame, setSelectedGame] = useState(GAMES[0]);
  const [tab, setTab] = useState("matchups");
  const [perspective, setPerspective] = useState("home");
  const [highlightTx, setHighlightTx] = useState(null);
  const [selectedTx, setSelectedTx] = useState(null);

  const gameMatchup = MATCHUPS[selectedGame.id];
  const matchups = perspective === "home" ? gameMatchup?.home_off : gameMatchup?.away_off;

  const radarData = useMemo(() => {
    if (!matchups) return [];
    return matchups.map(m => ({
      group: m.group.split(" ")[0],
      [selectedGame.homeAbbr]: m.radarScore.off,
      [selectedGame.awayAbbr]: m.radarScore.def,
    }));
  }, [matchups, selectedGame]);

  const overallAdv = useMemo(() => {
    if (!matchups) return 0;
    return Math.round(matchups.reduce((s, m) => s + m.advantage, 0) / matchups.length);
  }, [matchups]);

  const offTeam = perspective === "home" ? selectedGame.homeAbbr : selectedGame.awayAbbr;
  const defTeam = perspective === "home" ? selectedGame.awayAbbr : selectedGame.homeAbbr;

  function handleTxClick(tx) {
    if (selectedTx?.id === tx.id) {
      setSelectedTx(null); setHighlightTx(null);
    } else {
      setSelectedTx(tx);
      setHighlightTx(tx.id);
      setTab("matchups");
    }
  }

  return (
    <div style={{ background:C.bg, minHeight:600, color:C.text, fontFamily:body }}>
      {/* Header */}
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:"13px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:17, fontWeight:700, fontFamily:disp, letterSpacing:"-0.02em" }}>Position Matchup Analyzer</div>
          <div style={{ fontSize:11, color:C.muted, fontFamily:mono, marginTop:1 }}>Granular head-to-head grades · offseason transaction impact</div>
        </div>
        <select onChange={e => setSelectedGame(GAMES.find(g => g.id === e.target.value))}
          style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6,
            color:C.text, fontSize:12, fontFamily:mono, padding:"6px 10px", cursor:"pointer" }}>
          {GAMES.map(g => <option key={g.id} value={g.id}>{g.homeAbbr} vs {g.awayAbbr} — {g.date}</option>)}
        </select>
      </div>

      {/* Game banner */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"14px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:20 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:800, fontFamily:disp, color:C.A }}>{selectedGame.homeAbbr}</div>
              <div style={{ fontSize:10, color:C.muted, fontFamily:mono }}>{selectedGame.homeName}</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:11, color:C.muted, fontFamily:mono }}>{selectedGame.date}</div>
              <div style={{ fontSize:13, fontWeight:500, color:C.text, margin:"2px 0" }}>vs</div>
              <div style={{ fontSize:10, color:C.muted }}>{selectedGame.venue}</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:800, fontFamily:disp, color:C.B }}>{selectedGame.awayAbbr}</div>
              <div style={{ fontSize:10, color:C.muted, fontFamily:mono }}>{selectedGame.awayName}</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
            {[
              ["Spread", `${selectedGame.spread.fav} ${selectedGame.spread.line}`],
              ["Total", selectedGame.total.toString()],
              ["Confidence", `${selectedGame.confidence}/100`],
              ["Sharp side", selectedGame.sharpSide],
            ].map(([l, v]) => (
              <div key={l} style={{ textAlign:"center" }}>
                <div style={{ fontSize:10, color:C.muted, fontFamily:mono, textTransform:"uppercase", letterSpacing:"0.06em" }}>{l}</div>
                <div style={{ fontSize:14, fontWeight:700, fontFamily:mono, color:C.text }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, borderBottom:`1px solid ${C.border}`, padding:"0 20px" }}>
        {[["matchups","Position Matchups"],["transactions","Transaction Impact"],["radar","Radar View"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background:"transparent", border:"none", borderBottom:`2px solid ${tab === id ? C.A : "transparent"}`,
            color: tab === id ? C.text : C.muted, fontSize:12, fontFamily:mono,
            padding:"10px 14px", cursor:"pointer", transition:"all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding:"16px 20px" }}>
        {/* ── MATCHUPS TAB ── */}
        {tab === "matchups" && (
          <>
            {/* Perspective toggle */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexWrap:"wrap" }}>
              <div style={{ display:"flex", background:C.surface, border:`1px solid ${C.border}`, borderRadius:7, overflow:"hidden" }}>
                <button onClick={() => setPerspective("home")} style={{
                  background: perspective === "home" ? C.Alight : "transparent",
                  border:"none", borderRight:`1px solid ${C.border}`,
                  color: perspective === "home" ? C.A : C.muted,
                  fontSize:12, fontFamily:mono, padding:"7px 14px", cursor:"pointer",
                }}>{selectedGame.homeAbbr} OFF vs {selectedGame.awayAbbr} DEF</button>
                <button onClick={() => setPerspective("away")} style={{
                  background: perspective === "away" ? C.Blight : "transparent",
                  border:"none", color: perspective === "away" ? C.B : C.muted,
                  fontSize:12, fontFamily:mono, padding:"7px 14px", cursor:"pointer",
                }}>{selectedGame.awayAbbr} OFF vs {selectedGame.homeAbbr} DEF</button>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 12px",
                background:C.surface, border:`1px solid ${C.border}`, borderRadius:7 }}>
                <span style={{ fontSize:11, color:C.muted }}>Overall edge:</span>
                <span style={{ fontSize:13, fontFamily:mono, fontWeight:700, color:advColor(overallAdv) }}>
                  {overallAdv > 0 ? offTeam : defTeam} {advLabel(overallAdv)}
                </span>
              </div>
              {highlightTx && (
                <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px",
                  background:"rgba(167,139,250,0.08)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:7 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:C.purple }} />
                  <span style={{ fontSize:11, color:C.purple, fontFamily:mono }}>Showing transaction impact</span>
                  <button onClick={() => { setHighlightTx(null); setSelectedTx(null); }}
                    style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:13, padding:0 }}>×</button>
                </div>
              )}
            </div>

            {/* Column headers */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 1fr", gap:12, marginBottom:8 }}>
              <div style={{ fontSize:11, fontFamily:mono, color:C.A, letterSpacing:"0.07em" }}>
                ← {offTeam} OFFENSE
              </div>
              <div style={{ textAlign:"center", fontSize:11, fontFamily:mono, color:C.muted }}>EDGE</div>
              <div style={{ fontSize:11, fontFamily:mono, color:C.B, letterSpacing:"0.07em", textAlign:"right" }}>
                {defTeam} DEFENSE →
              </div>
            </div>

            {matchups?.map(m => (
              <PositionRow key={m.id} matchup={m}
                teamA={offTeam} teamB={defTeam}
                highlightTx={highlightTx} perspective={perspective} />
            ))}
          </>
        )}

        {/* ── TRANSACTIONS TAB ── */}
        {tab === "transactions" && (
          <>
            <div style={{ fontSize:12, color:C.muted, marginBottom:16, lineHeight:1.6 }}>
              Click a transaction to see its impact on position group grades and confidence scores. Highlighted transactions link directly to affected matchup rows.
            </div>
            {TRANSACTIONS.map(tx => (
              <TransactionCard key={tx.id} tx={tx}
                isSelected={selectedTx?.id === tx.id}
                onClick={() => handleTxClick(tx)} />
            ))}
          </>
        )}

        {/* ── RADAR TAB ── */}
        {tab === "radar" && (
          <>
            <div style={{ display:"flex", gap:16, marginBottom:16 }}>
              {[[selectedGame.homeAbbr, C.A], [selectedGame.awayAbbr, C.B]].map(([team, color]) => (
                <div key={team} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:10, height:3, background:color, borderRadius:2 }} />
                  <span style={{ fontSize:11, fontFamily:mono, color:C.muted }}>{team}</span>
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              {["home","away"].map(persp => {
                const pMatchups = persp === "home" ? gameMatchup?.home_off : gameMatchup?.away_off;
                const rData = pMatchups?.map(m => ({
                  group: m.group.split(" ")[0],
                  OFF: m.radarScore.off,
                  DEF: m.radarScore.def,
                }));
                const offA = persp === "home" ? selectedGame.homeAbbr : selectedGame.awayAbbr;
                const defA = persp === "home" ? selectedGame.awayAbbr : selectedGame.homeAbbr;
                return (
                  <div key={persp} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px" }}>
                    <div style={{ fontSize:12, fontWeight:500, fontFamily:disp, marginBottom:4 }}>
                      {offA} Offense vs {defA} Defense
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={rData} margin={{ top:10, right:20, bottom:10, left:20 }}>
                        <PolarGrid stroke={C.border2} />
                        <PolarAngleAxis dataKey="group" tick={{ fontSize:10, fill:C.muted, fontFamily:mono }} />
                        <Tooltip content={<RadarTooltip />} />
                        <Radar name={`${offA} OFF`} dataKey="OFF" stroke={C.A} fill={C.A} fillOpacity={0.15} strokeWidth={1.5} />
                        <Radar name={`${defA} DEF`} dataKey="DEF" stroke={C.B} fill={C.B} fillOpacity={0.15} strokeWidth={1.5} />
                      </RadarChart>
                    </ResponsiveContainer>
                    <div style={{ display:"flex", justifyContent:"space-around", marginTop:4 }}>
                      {pMatchups?.map(m => (
                        <div key={m.id} style={{ textAlign:"center" }}>
                          <div style={{ fontSize:10, color:C.muted, fontFamily:mono }}>{m.icon}</div>
                          <div style={{ fontSize:12, fontFamily:mono, fontWeight:700, color:advColor(m.advantage) }}>
                            {m.advantage > 0 ? "+" : ""}{m.advantage}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Transaction delta summary */}
            <div style={{ marginTop:16, background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px" }}>
              <div style={{ fontSize:12, fontWeight:500, fontFamily:disp, marginBottom:12 }}>Offseason grade changes — {selectedGame.homeAbbr} vs {selectedGame.awayAbbr}</div>
              {TRANSACTIONS.filter(t => t.betImpact?.some(b => b.before)).map(tx => (
                <div key={tx.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:`1px solid ${C.faint}` }}>
                  <span style={{ fontSize:10, fontFamily:mono, color:txColor(tx.type), width:60, flexShrink:0, textTransform:"uppercase" }}>{tx.type}</span>
                  <span style={{ fontSize:12, fontWeight:500, flex:1 }}>{tx.player}</span>
                  <span style={{ fontSize:11, color:C.muted, fontFamily:mono }}>{tx.fromTeam} → {tx.toTeam}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:10, color:C.muted, fontFamily:mono }}>{tx.before?.groupScore}</span>
                    <span style={{ fontSize:10, color:C.muted }}>→</span>
                    <span style={{ fontSize:13, fontFamily:mono, fontWeight:700,
                      color: tx.after?.groupScore > tx.before?.groupScore ? C.green : C.red }}>
                      {tx.after?.groupScore}
                    </span>
                    <span style={{ fontSize:10, fontFamily:mono,
                      color: tx.after?.groupScore > tx.before?.groupScore ? C.green : C.red }}>
                      ({tx.after?.groupScore > tx.before?.groupScore ? "+" : ""}{tx.after?.groupScore - tx.before?.groupScore})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
