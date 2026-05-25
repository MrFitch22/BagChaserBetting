import Anthropic from "@anthropic-ai/sdk";

if (!process.env["ANTHROPIC_API_KEY"]) {
  throw new Error("ANTHROPIC_API_KEY is required");
}

export const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

// Model constants — use Sonnet for orchestrator (complex reasoning),
// Haiku for sub-agents doing structured extraction (faster + cheaper)
export const MODELS = {
  orchestrator: "claude-sonnet-4-6" as const,
  agent:        "claude-haiku-4-5-20251001" as const,
} satisfies Record<string, Anthropic.Model>;
