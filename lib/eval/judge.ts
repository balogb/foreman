import Anthropic from "@anthropic-ai/sdk";

const JUDGE_MODEL = "claude-haiku-4-5-20251001";

export interface JudgeScores {
  relevance: number; // 0-1: on-topic for the task
  specificity: number; // 0-1: concrete and detailed vs vague
  grounding: number; // 0-1: claims appear supported by cited sources
  rationale: string;
}

/**
 * LLM-as-judge: an independent Claude call scores a brief against the task.
 * The judge is forced to return structured scores via a tool call so output is
 * always parseable.
 */
export async function llmJudge(task: string, brief: string): Promise<JudgeScores> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY.");
  const client = new Anthropic({ apiKey });

  const tool: Anthropic.Tool = {
    name: "submit_scores",
    description: "Submit the evaluation scores for the brief.",
    input_schema: {
      type: "object",
      properties: {
        relevance: { type: "number", description: "0-1: how on-topic the brief is for the task." },
        specificity: { type: "number", description: "0-1: concrete/detailed vs vague." },
        grounding: { type: "number", description: "0-1: claims appear supported by the cited sources." },
        rationale: { type: "string", description: "One or two sentences explaining the scores." },
      },
      required: ["relevance", "specificity", "grounding", "rationale"],
    },
  };

  const resp = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 1024,
    tools: [tool],
    tool_choice: { type: "tool", name: "submit_scores" },
    messages: [
      {
        role: "user",
        content:
          `You are an impartial evaluator. Score this research brief against the task.\n\n` +
          `TASK:\n${task}\n\nBRIEF:\n${brief}\n\n` +
          `Score relevance, specificity, and grounding each from 0 to 1. Be strict.`,
      },
    ],
  });

  const block = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!block) throw new Error("Judge did not return scores.");
  const i = block.input as Record<string, unknown>;
  const clamp = (n: unknown) => Math.max(0, Math.min(1, Number(n) || 0));
  return {
    relevance: clamp(i.relevance),
    specificity: clamp(i.specificity),
    grounding: clamp(i.grounding),
    rationale: String(i.rationale ?? ""),
  };
}
