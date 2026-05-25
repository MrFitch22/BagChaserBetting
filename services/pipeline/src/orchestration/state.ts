/**
 * LangGraph pipeline state definition.
 * Each node reads from and writes to this shared state.
 */
import { Annotation } from "@langchain/langgraph";

export const PipelineState = Annotation.Root({
  // ── Context loaded at start of each cycle ─────────────────────────────────
  utcHour:       Annotation<number>({ default: () => 0, reducer: (_, b) => b }),
  isGameHours:   Annotation<boolean>({ default: () => false, reducer: (_, b) => b }),
  pendingPicks:  Annotation<number>({ default: () => 0, reducer: (_, b) => b }),
  upcomingGames: Annotation<number>({ default: () => 0, reducer: (_, b) => b }),
  cycleCount:    Annotation<number>({ default: () => 0, reducer: (_, b) => b }),

  // ── Agent results (merged from parallel nodes) ─────────────────────────────
  results: Annotation<Record<string, string>>({
    default:  () => ({}),
    reducer:  (a, b) => ({ ...a, ...b }),
  }),

  // ── Error accumulator ──────────────────────────────────────────────────────
  errors: Annotation<string[]>({
    default: () => [],
    reducer: (a, b) => [...a, ...b],
  }),
});

export type PipelineStateType = typeof PipelineState.State;
