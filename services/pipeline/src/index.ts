import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env BEFORE any agent module imports — lib/anthropic.ts throws at init
// time if ANTHROPIC_API_KEY is missing, and static imports are hoisted past
// process.loadEnvFile. Dynamic imports below run after this line.
try {
  process.loadEnvFile(resolve(__dirname, "../../../.env.local"));
} catch { /* already loaded by shell */ }

const { runPipelineGraph } = await import("./orchestration/graph.js");

// ─── Manual triggers via CLI args ─────────────────────────────────────────────
// Usage: pnpm dev -- --agent odds|social|verify|sentiment|all

async function runManual(agentName: string) {
  console.log(`[Manual] Running ${agentName} agent…`);
  const { runOddsAgent }         = await import("./agents/odds-agent.js");
  const { runSocialAgent }       = await import("./agents/social-agent.js");
  const { runVerificationAgent } = await import("./agents/verification-agent.js");
  const { runSentimentAgent }    = await import("./agents/sentiment-agent.js");
  const { runPipelineGraph: runGraph } = await import("./orchestration/graph.js");
  const { runConfidenceScorer }  = await import("./score-confidence.js");
  const { runUpdateScores }      = await import("./update-scores.js");
  const { runSelfImprovement }   = await import("./self-improvement.js");

  const MAP: Record<string, () => Promise<unknown>> = {
    odds:          runOddsAgent,
    social:        runSocialAgent,
    verify:        runVerificationAgent,
    sentiment:     runSentimentAgent,
    score:         runConfidenceScorer,
    all:           runGraph,
    "update-scores": runUpdateScores,
    improve:       runSelfImprovement,
  };

  const fn = MAP[agentName];
  if (!fn) {
    console.error(`Unknown agent: ${agentName}. Use: odds | social | verify | sentiment | all`);
    process.exit(1);
  }

  const result = await fn();
  console.log(result);
  process.exit(0);
}

// ─── Boot ──────────────────────────────────────────────────────────────────────

const agentArg = process.argv.find((a, i) => process.argv[i - 1] === "--agent");

if (agentArg) {
  runManual(agentArg).catch((err) => { console.error(err); process.exit(1); });
} else {
  console.log("[Scheduler] Sharp Edge Pipeline starting…");
  const { startCronScheduler } = await import("./cron.js");
  startCronScheduler();
}

// Graceful shutdown
process.on("SIGTERM", () => { console.log("[Scheduler] Shutting down"); process.exit(0); });
process.on("SIGINT",  () => { console.log("[Scheduler] Shutting down"); process.exit(0); });
