import { fileURLToPath } from "url";
import { resolve, dirname } from "path";
import { runOrchestrator } from "./agents/orchestrator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env — pipeline reads from repo root .env.local
try {
  process.loadEnvFile(resolve(__dirname, "../../../../.env.local"));
} catch { /* already loaded by shell */ }

// ─── Interval logic ────────────────────────────────────────────────────────────
// During game hours (11am–3am UTC): run every 3 minutes
// Off hours: run every 30 minutes
// This matches the "poll odds every 3min during live games" requirement
// without needing BullMQ or Temporal.

function getIntervalMs(): number {
  const hour = new Date().getUTCHours();
  const isGameHours = hour >= 11 || hour <= 3;
  return isGameHours ? 3 * 60_000 : 30 * 60_000;
}

let isRunning = false;

async function tick() {
  if (isRunning) {
    console.log("[Scheduler] Previous cycle still running — skipping tick");
    return;
  }

  isRunning = true;
  const start = Date.now();

  try {
    const result = await runOrchestrator();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[Scheduler] Cycle complete in ${elapsed}s — ${result.tokensUsed.toLocaleString()} tokens\n${result.summary}`
    );
  } catch (err) {
    console.error("[Scheduler] Cycle failed:", err);
  } finally {
    isRunning = false;
    scheduleNext();
  }
}

function scheduleNext() {
  const interval = getIntervalMs();
  const minutes = (interval / 60_000).toFixed(0);
  console.log(`[Scheduler] Next cycle in ${minutes}min`);
  setTimeout(tick, interval);
}

// ─── Manual triggers via CLI args ─────────────────────────────────────────────
// Usage: pnpm dev -- --agent odds|social|verify|sentiment|all

async function runManual(agentName: string) {
  console.log(`[Manual] Running ${agentName} agent…`);
  const { runOddsAgent }         = await import("./agents/odds-agent.js");
  const { runSocialAgent }       = await import("./agents/social-agent.js");
  const { runVerificationAgent } = await import("./agents/verification-agent.js");
  const { runSentimentAgent }    = await import("./agents/sentiment-agent.js");

  const MAP: Record<string, () => Promise<unknown>> = {
    odds:      runOddsAgent,
    social:    runSocialAgent,
    verify:    runVerificationAgent,
    sentiment: runSentimentAgent,
    all:       runOrchestrator,
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
  tick(); // Run immediately on startup, then schedule
}

// Graceful shutdown
process.on("SIGTERM", () => { console.log("[Scheduler] Shutting down"); process.exit(0); });
process.on("SIGINT",  () => { console.log("[Scheduler] Shutting down"); process.exit(0); });
