import type { Permission } from "./tools/registry";

export type RunStatus =
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "aborted";

export type ToolCallStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executed"
  | "denied";

export type StepKind = "reasoning" | "message" | "tool_call" | "tool_result";

export interface Agent {
  id: string;
  name: string;
  role_prompt: string;
  model: string;
  memory_enabled: boolean;
  max_steps: number;
  max_tokens: number;
  created_at: string;
  updated_at: string;
}

export interface AgentTool {
  id: string;
  agent_id: string;
  tool_name: string;
  permission: Permission;
}

export interface Run {
  id: string;
  agent_id: string;
  task: string;
  status: RunStatus;
  result: string | null;
  error: string | null;
  messages: AnthropicMessage[];
  total_tokens: number;
  total_steps: number;
  started_at: string;
  ended_at: string | null;
}

export interface Step {
  id: string;
  run_id: string;
  idx: number;
  kind: StepKind;
  content: Record<string, unknown>;
  tokens: number;
  created_at: string;
}

export interface ToolCall {
  id: string;
  run_id: string;
  step_id: string | null;
  tool_use_id: string | null;
  tool_name: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  result: unknown;
  rationale: string | null;
  created_at: string;
  executed_at: string | null;
}

// Minimal shape of the Anthropic messages we persist (role + content blocks).
export interface AnthropicMessage {
  role: "user" | "assistant";
  content: unknown;
}
