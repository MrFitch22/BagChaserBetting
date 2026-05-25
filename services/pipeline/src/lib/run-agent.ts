import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "./anthropic.js";

export interface AgentTool<TInput = unknown, TOutput = unknown> {
  definition: Anthropic.Tool;
  execute: (input: TInput) => Promise<TOutput>;
}

export interface AgentConfig {
  name: string;
  model: Anthropic.Model;
  systemPrompt: string;
  tools: AgentTool[];
  maxIterations?: number;
}

export interface AgentResult {
  agentName: string;
  success: boolean;
  summary: string;
  iterations: number;
  tokensUsed: number;
}

/**
 * Generic agentic loop. Runs until the model issues a stop_reason="end_turn"
 * or hits maxIterations. Each tool call is dispatched to the matching executor.
 */
export async function runAgent(
  config: AgentConfig,
  userMessage: string
): Promise<AgentResult> {
  const { name, model, systemPrompt, tools, maxIterations = 20 } = config;

  const toolMap = new Map(tools.map((t) => [t.definition.name, t]));
  const toolDefs = tools.map((t) => t.definition);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  let iterations = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let lastTextContent = "";

  console.log(`[${name}] Starting — ${userMessage.slice(0, 80)}…`);

  while (iterations < maxIterations) {
    iterations++;

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: systemPrompt,
          // Cache the system prompt — it never changes between iterations
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: toolDefs,
      messages,
    });

    totalInputTokens  += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Collect all text and tool_use blocks from this response
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );

    if (textBlocks.length > 0) {
      lastTextContent = textBlocks.map((b) => b.text).join("\n");
    }

    // Add assistant turn to history
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
      break;
    }

    // Execute all tool calls in parallel, then add a single user turn with all results
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block): Promise<Anthropic.ToolResultBlockParam> => {
        const tool = toolMap.get(block.name);
        if (!tool) {
          return {
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: `Unknown tool: ${block.name}`,
          };
        }

        try {
          console.log(`[${name}] → ${block.name}`);
          const result = await tool.execute(block.input);
          return {
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[${name}] ✗ ${block.name}: ${message}`);
          return {
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: message,
          };
        }
      })
    );

    messages.push({ role: "user", content: toolResults });
  }

  const tokensUsed = totalInputTokens + totalOutputTokens;
  console.log(
    `[${name}] Done — ${iterations} iterations, ${tokensUsed.toLocaleString()} tokens`
  );

  return {
    agentName: name,
    success: true,
    summary: lastTextContent || `${name} completed in ${iterations} iterations`,
    iterations,
    tokensUsed,
  };
}
