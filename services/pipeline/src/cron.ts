/**
 * Cron scheduler — attaches to the pipeline process on boot.
 *
 * Schedule:
 *   Every 10 min  → odds ingestion (via LangGraph graph)
 *   Every 15 min  → confidence scoring
 *   Every 60 min  → update final scores + grade predictions
 *   Daily 4:00 AM → self-improvement weight tuning
 *
 * The LangGraph graph (graph.ts) still handles the main adaptive cycle.
 * These crons layer on top for time-critical and scheduled-exact jobs.
 */
import cron from "node-cron";

export function startCronScheduler(): void {
  // ── Every 10 minutes: run the full pipeline graph ────────────────────────
  // (odds + social + sentiment + verify + score all in parallel)
  cron.schedule("*/10 * * * *", async () => {
    try {
      const { runPipelineGraph } = await import("./orchestration/graph.js");
      const result = await runPipelineGraph();
      const summary = Object.entries(result.results)
        .filter(([, v]) => !v.startsWith("skipped"))
        .map(([k, v]) => `${k}: ${v}`)
        .join(" | ");
      console.log(`[Cron] 10min cycle complete — ${summary || "all skipped"}`);
    } catch (err) {
      console.error("[Cron] 10min cycle failed:", (err as Error).message);
    }
  }, { timezone: "UTC" });

  // ── Every 60 minutes: fetch final scores + grade system predictions ───────
  cron.schedule("0 * * * *", async () => {
    try {
      const { runUpdateScores } = await import("./update-scores.js");
      const result = await runUpdateScores();
      console.log(`[Cron] Hourly score update — ${result.gamesUpdated} games, ${result.predictionsGraded} graded`);
    } catch (err) {
      console.error("[Cron] Score update failed:", (err as Error).message);
    }
  }, { timezone: "UTC" });

  // ── Daily at 4:00 AM UTC: self-improvement engine ─────────────────────────
  cron.schedule("0 4 * * *", async () => {
    console.log("[Cron] Starting daily self-improvement run...");
    try {
      const { runSelfImprovement } = await import("./self-improvement.js");
      const result = await runSelfImprovement();
      console.log(`[Cron] Self-improvement complete — updated: ${result.sportsUpdated.join(", ") || "none (need more data)"} | ${result.totalPredictionsAnalysed} predictions analysed`);
    } catch (err) {
      console.error("[Cron] Self-improvement failed:", (err as Error).message);
    }
  }, { timezone: "UTC" });

  console.log("[Cron] Scheduler started — 10min pipeline | 1h score-update | 4AM self-improve");
}
