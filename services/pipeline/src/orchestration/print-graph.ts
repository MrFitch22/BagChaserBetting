/**
 * Prints the LangGraph pipeline as a Mermaid diagram.
 * Paste the output into https://mermaid.live to view it visually.
 *
 * Usage: pnpm --filter @sharp-edge/pipeline exec tsx src/orchestration/print-graph.ts
 */
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
try {
  process.loadEnvFile(resolve(__dirname, "../../../../.env.local"));
} catch { /* ignore */ }

// Mock the DB so we don't need a live connection just to print the graph
process.env["DATABASE_URL"] = process.env["DATABASE_URL"] ?? "postgresql://mock:mock@localhost/mock";

const { pipelineGraph } = await import("./graph.js");

const diagram = pipelineGraph.getGraph().drawMermaid();

console.log("\n─── BagChaser Pipeline Graph (Mermaid) ──────────────────────\n");
console.log(diagram);
console.log("\n─── Paste the above into https://mermaid.live ───────────────\n");
