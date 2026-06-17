import Anthropic from "@anthropic-ai/sdk";
import { getSql } from "../db";
import { TOOL_REGISTRY, type Permission } from "../tools/registry";
import { executeTool } from "../tools/execute";
import type { Agent, AgentTool, Run } from "../types";

const PER_CALL_MAX_TOKENS = 8000; // response cap per Claude call (must exceed thinking budget)
const THINKING_BUDGET = 2000; // extended-thinking token budget per call
const COMPACTION_THRESHOLD_CHARS = 60_000; // ~15k tokens of context triggers compaction
const KEEP_RECENT_TOOLRESULT_TURNS = 3; // most-recent tool-result turns kept verbatim

/**
 * Build a Messages request with two current techniques:
 *  - Extended thinking: the model reasons before/between tool calls; thinking
 *    blocks are returned, persisted, and shown live in the trace.
 *  - Prompt caching: cache_control breakpoints on the system prompt, the tool
 *    definitions, and the end of the conversation so the static prefix and the
 *    prior turns are read from cache instead of re-billed each turn.
 *
 * cache_control is applied to a transient deep copy so the persisted messages
 * stay clean (avoids accumulating breakpoints past the 4-breakpoint limit and
 * keeps replayed thinking-block signatures intact).
 */
function buildRequest(
  agent: Agent,
  messages: Anthropic.MessageParam[],
  toolDefs: Anthropic.Tool[]
): Anthropic.MessageCreateParamsNonStreaming {
  const msgs = JSON.parse(JSON.stringify(messages)) as Anthropic.MessageParam[];
  const last = msgs[msgs.length - 1];
  if (last) {
    if (typeof last.content === "string") {
      last.content = [
        { type: "text", text: last.content, cache_control: { type: "ephemeral" } },
      ];
    } else if (Array.isArray(last.content) && last.content.length > 0) {
      const block = last.content[last.content.length - 1] as { cache_control?: unknown };
      block.cache_control = { type: "ephemeral" };
    }
  }

  const tools = toolDefs.length
    ? toolDefs.map((t, i) =>
        i === toolDefs.length - 1 ? { ...t, cache_control: { type: "ephemeral" as const } } : t
      )
    : undefined;

  return {
    model: agent.model,
    max_tokens: PER_CALL_MAX_TOKENS,
    thinking: { type: "enabled", budget_tokens: THINKING_BUDGET },
    system: [
      { type: "text", text: agent.role_prompt, cache_control: { type: "ephemeral" } },
    ],
    tools,
    messages: msgs,
  };
}

function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY. See .env.local.example.");
  return new Anthropic({ apiKey });
}

// --- loaders ---------------------------------------------------------------

async function loadRun(runId: string): Promise<Run> {
  const sql = getSql();
  const rows = await sql`select * from runs where id = ${runId} limit 1`;
  if (!rows[0]) throw new Error(`Run not found: ${runId}`);
  return rows[0] as unknown as Run;
}

async function loadAgent(agentId: string): Promise<Agent> {
  const sql = getSql();
  const rows = await sql`select * from agents where id = ${agentId} limit 1`;
  if (!rows[0]) throw new Error(`Agent not found: ${agentId}`);
  return rows[0] as unknown as Agent;
}

async function loadTools(agentId: string): Promise<AgentTool[]> {
  const sql = getSql();
  const rows = await sql`select * from agent_tools where agent_id = ${agentId}`;
  return rows as unknown as AgentTool[];
}

// --- tool definitions exposed to the model ---------------------------------

function buildToolDefs(tools: AgentTool[]): Anthropic.Tool[] {
  // Expose every configured tool except denied ones (the model never sees those).
  return tools
    .filter((t) => t.permission !== "deny" && TOOL_REGISTRY[t.tool_name])
    .map((t) => {
      const spec = TOOL_REGISTRY[t.tool_name];
      return {
        name: spec.name,
        description: spec.description,
        input_schema: spec.inputSchema as Anthropic.Tool.InputSchema,
      };
    });
}

function permissionFor(toolName: string, tools: AgentTool[]): Permission {
  const configured = tools.find((t) => t.tool_name === toolName);
  if (configured) return configured.permission;
  return TOOL_REGISTRY[toolName]?.defaultPermission ?? "deny";
}

// --- persistence helpers ---------------------------------------------------

async function nextStepIdx(runId: string): Promise<number> {
  const sql = getSql();
  const rows = await sql`select coalesce(max(idx), -1) + 1 as n from steps where run_id = ${runId}`;
  return Number(rows[0]?.n ?? 0);
}

async function recordAssistantSteps(runId: string, content: Anthropic.ContentBlock[]) {
  const sql = getSql();
  let idx = await nextStepIdx(runId);
  for (const block of content) {
    if (block.type === "thinking") {
      await sql`insert into steps (run_id, idx, kind, content) values (${runId}, ${idx}, 'reasoning', ${JSON.stringify({ text: block.thinking })}::jsonb)`;
    } else if (block.type === "redacted_thinking") {
      await sql`insert into steps (run_id, idx, kind, content) values (${runId}, ${idx}, 'reasoning', ${JSON.stringify({ text: "[redacted thinking]" })}::jsonb)`;
    } else if (block.type === "text") {
      await sql`insert into steps (run_id, idx, kind, content) values (${runId}, ${idx}, 'message', ${JSON.stringify({ text: block.text })}::jsonb)`;
    } else if (block.type === "tool_use") {
      await sql`insert into steps (run_id, idx, kind, content) values (${runId}, ${idx}, 'tool_call', ${JSON.stringify({ tool: block.name, input: block.input, tool_use_id: block.id })}::jsonb)`;
    }
    idx++;
  }
}

async function recordCompactionStep(runId: string, elided: number) {
  const sql = getSql();
  const idx = await nextStepIdx(runId);
  const text = `[context compaction] elided ${elided} older tool result(s) to conserve the context window`;
  await sql`insert into steps (run_id, idx, kind, content) values (${runId}, ${idx}, 'message', ${JSON.stringify({ text })}::jsonb)`;
}

/**
 * Context editing: when the working context grows past a threshold, replace the
 * content of older tool_result blocks with a stub, keeping the most recent
 * turns verbatim. Message/turn structure and tool_use<->tool_result pairing are
 * left intact (no API errors), and the bulk - old fetched-page text - is shed.
 * Findings and the full trace are persisted separately, so nothing is lost to
 * the operator; only the model's working window is trimmed. Mutates `messages`.
 */
async function compactIfNeeded(
  runId: string,
  messages: Anthropic.MessageParam[]
): Promise<number> {
  if (JSON.stringify(messages).length < COMPACTION_THRESHOLD_CHARS) return 0;

  const toolResultTurns: number[] = [];
  messages.forEach((m, i) => {
    if (
      m.role === "user" &&
      Array.isArray(m.content) &&
      m.content.some((b) => (b as Anthropic.ContentBlockParam).type === "tool_result")
    ) {
      toolResultTurns.push(i);
    }
  });
  const protectedTurns = new Set(toolResultTurns.slice(-KEEP_RECENT_TOOLRESULT_TURNS));

  let elided = 0;
  messages.forEach((m, i) => {
    if (protectedTurns.has(i) || m.role !== "user" || !Array.isArray(m.content)) return;
    for (const block of m.content) {
      const b = block as Anthropic.ToolResultBlockParam;
      if (b.type !== "tool_result") continue;
      const current = typeof b.content === "string" ? b.content : JSON.stringify(b.content ?? "");
      if (current.length > 80) {
        b.content = "[result elided to conserve context]";
        elided++;
      }
    }
  });

  if (elided > 0) await recordCompactionStep(runId, elided);
  return elided;
}

async function recordToolResultStep(runId: string, toolName: string, result: unknown) {
  const sql = getSql();
  const idx = await nextStepIdx(runId);
  await sql`insert into steps (run_id, idx, kind, content) values (${runId}, ${idx}, 'tool_result', ${JSON.stringify({ tool: toolName, result })}::jsonb)`;
}

async function persistState(
  runId: string,
  messages: Anthropic.MessageParam[],
  totalTokens: number
) {
  const sql = getSql();
  const stepCount = await nextStepIdx(runId);
  await sql`
    update runs
    set messages = ${JSON.stringify(messages)}::jsonb,
        total_tokens = ${totalTokens},
        total_steps = ${stepCount}
    where id = ${runId}
  `;
}

// --- public entrypoints ----------------------------------------------------

/**
 * Create the run row (status 'running') and return its id WITHOUT executing the
 * loop. HTTP callers create the run, return the id immediately, then `drive()`
 * in the background so the request does not block on a multi-minute run.
 */
export async function createRun(agentId: string, task: string): Promise<string> {
  const sql = getSql();

  // Anchor the model to the real "now" so it judges recency correctly instead
  // of defaulting to its training cutoff.
  const today = new Date().toISOString().slice(0, 10);
  const dateLine = `Today's date is ${today}. Treat only recently dated sources as "new"; prioritize the last few weeks.`;

  // Context engineering: hydrate the opening context with the agent's
  // cross-run memory so it starts already aware of prior state.
  const memory = await loadMemorySummary(agentId);
  const content =
    `${dateLine}\n\n${task}` +
    (memory ? `\n\n[Memory from prior runs - do not re-report items already covered]\n${memory}` : "");

  const initial: Anthropic.MessageParam[] = [{ role: "user", content }];
  const rows = await sql`
    insert into runs (agent_id, task, status, messages)
    values (${agentId}, ${task}, 'running', ${JSON.stringify(initial)}::jsonb)
    returning id
  `;
  return String(rows[0].id);
}

/** Create a run and drive it synchronously to completion or the approval pause. */
export async function startRun(agentId: string, task: string): Promise<string> {
  const runId = await createRun(agentId, task);
  await drive(runId);
  return runId;
}

/** Mark a run failed (used by background drivers when the loop throws). */
export async function failRun(runId: string, error: string): Promise<void> {
  await finish(runId, "failed", null, error);
}

/** Compact summary of an agent's stored memory, bounded in size. */
async function loadMemorySummary(agentId: string): Promise<string | null> {
  const sql = getSql();
  const rows = await sql`select key, value from memory where agent_id = ${agentId} order by updated_at desc`;
  if (rows.length === 0) return null;
  const lines = rows.map((r) => {
    const val = JSON.stringify(r.value);
    return `- ${r.key}: ${val.length > 600 ? val.slice(0, 600) + "..." : val}`;
  });
  const text = lines.join("\n");
  return text.length > 2000 ? text.slice(0, 2000) + "\n..." : text;
}

/** Resume a run that was paused awaiting approval, after decisions are recorded. */
export async function resumeRun(runId: string): Promise<void> {
  const run = await loadRun(runId);
  if (run.status !== "awaiting_approval") return;

  const sql = getSql();
  const messages = run.messages as unknown as Anthropic.MessageParam[];
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant || !Array.isArray(lastAssistant.content)) {
    throw new Error("Cannot resume: no assistant turn with tool calls found.");
  }
  const toolUses = lastAssistant.content.filter(
    (b): b is Anthropic.ToolUseBlock => (b as Anthropic.ContentBlock).type === "tool_use"
  );

  // Execute any approved-but-unrun tools now (human approved before it ran).
  for (const tu of toolUses) {
    const tcRows = await sql`select * from tool_calls where run_id = ${runId} and tool_use_id = ${tu.id} limit 1`;
    const tc = tcRows[0];
    if (!tc) continue;
    if (tc.status === "approved") {
      try {
        const result = await executeTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, {
          runId,
          agentId: run.agent_id,
        });
        await sql`update tool_calls set status = 'executed', result = ${JSON.stringify(result)}::jsonb, executed_at = now() where id = ${tc.id}`;
        await recordToolResultStep(runId, tu.name, result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await sql`update tool_calls set status = 'executed', result = ${JSON.stringify({ error: msg })}::jsonb, executed_at = now() where id = ${tc.id}`;
        await recordToolResultStep(runId, tu.name, { error: msg });
      }
    } else if (tc.status === "pending") {
      // still awaiting another decision
      return;
    }
  }

  // Build the tool_result user message from all tool_calls of this turn.
  const resultContent: Anthropic.ToolResultBlockParam[] = [];
  for (const tu of toolUses) {
    const tcRows = await sql`select * from tool_calls where run_id = ${runId} and tool_use_id = ${tu.id} limit 1`;
    const tc = tcRows[0];
    const payload =
      tc?.status === "rejected"
        ? { error: "Rejected by operator. This action was not performed." }
        : tc?.result ?? { error: "missing result" };
    resultContent.push({
      type: "tool_result",
      tool_use_id: tu.id,
      content: JSON.stringify(payload),
      is_error: !!(payload && typeof payload === "object" && "error" in payload),
    });
  }
  messages.push({ role: "user", content: resultContent });
  await sql`update runs set status = 'running', messages = ${JSON.stringify(messages)}::jsonb where id = ${runId}`;

  await drive(runId);
}

// --- the core loop ---------------------------------------------------------

export async function drive(runId: string): Promise<void> {
  const sql = getSql();
  const run = await loadRun(runId);
  const agent = await loadAgent(run.agent_id);
  const tools = await loadTools(run.agent_id);
  const toolDefs = buildToolDefs(tools);
  const anthropic = getAnthropic();

  const messages = run.messages as unknown as Anthropic.MessageParam[];
  let totalTokens = run.total_tokens; // all-inclusive, for display
  let billable = 0; // input + output + cache writes this drive(); guards the budget (cheap cache reads excluded)
  let turns = 0;
  let finalizing = false;

  try {
    while (true) {
      // When the research budget (turns or billable tokens) is spent, don't
      // fail - force one wrap-up turn that must publish with what was gathered.
      if (!finalizing && (turns >= agent.max_steps || billable > agent.max_tokens)) {
        finalizing = true;
        messages.push({
          role: "user",
          content:
            "You have reached your research budget. Do not search or fetch any further. Call publish_brief now with the findings you have already gathered.",
        });
        await persistState(runId, messages, totalTokens);
      }
      if (turns >= agent.max_steps + 2) {
        await finish(runId, "failed", null, "Reached step budget without publishing a brief.");
        return;
      }
      turns++;

      const elided = await compactIfNeeded(runId, messages);
      if (elided > 0) await persistState(runId, messages, totalTokens);

      // On the wrap-up turn, expose only publish_brief so the agent converges.
      const turnTools = finalizing
        ? toolDefs.filter((t) => t.name === "publish_brief")
        : toolDefs;
      const resp = await anthropic.messages.create(buildRequest(agent, messages, turnTools));

      // cache reads are ~0.1x cost; count them for display but not the budget.
      const calls =
        resp.usage.input_tokens +
        resp.usage.output_tokens +
        (resp.usage.cache_creation_input_tokens ?? 0);
      billable += calls;
      totalTokens += calls + (resp.usage.cache_read_input_tokens ?? 0);
      messages.push({ role: "assistant", content: resp.content });
      await recordAssistantSteps(runId, resp.content);
      await persistState(runId, messages, totalTokens);

      if (resp.stop_reason !== "tool_use") {
        const text = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        await finish(runId, "completed", text, null);
        return;
      }

      const toolUses = resp.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      let hasPending = false;
      const lastText = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      const results: Anthropic.ToolResultBlockParam[] = [];

      for (const tu of toolUses) {
        const perm = permissionFor(tu.name, tools);
        const args = (tu.input ?? {}) as Record<string, unknown>;

        if (perm === "require_approval") {
          await sql`
            insert into tool_calls (run_id, tool_use_id, tool_name, args, status, rationale)
            values (${runId}, ${tu.id}, ${tu.name}, ${JSON.stringify(args)}::jsonb, 'pending', ${lastText || null})
          `;
          hasPending = true;
          continue;
        }

        if (perm === "deny") {
          const payload = { error: `Tool '${tu.name}' is denied by policy.` };
          await sql`
            insert into tool_calls (run_id, tool_use_id, tool_name, args, status, result, executed_at)
            values (${runId}, ${tu.id}, ${tu.name}, ${JSON.stringify(args)}::jsonb, 'denied', ${JSON.stringify(payload)}::jsonb, now())
          `;
          await recordToolResultStep(runId, tu.name, payload);
          results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(payload), is_error: true });
          continue;
        }

        // allow: execute immediately
        let payload: unknown;
        let isError = false;
        try {
          payload = await executeTool(tu.name, args, { runId, agentId: run.agent_id });
        } catch (err) {
          payload = { error: err instanceof Error ? err.message : String(err) };
          isError = true;
        }
        await sql`
          insert into tool_calls (run_id, tool_use_id, tool_name, args, status, result, executed_at)
          values (${runId}, ${tu.id}, ${tu.name}, ${JSON.stringify(args)}::jsonb, 'executed', ${JSON.stringify(payload)}::jsonb, now())
        `;
        await recordToolResultStep(runId, tu.name, payload);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(payload), is_error: isError });
      }

      if (hasPending) {
        // Cannot continue until the human decides. Pause here.
        await sql`update runs set status = 'awaiting_approval' where id = ${runId}`;
        return;
      }

      messages.push({ role: "user", content: results });
      await persistState(runId, messages, totalTokens);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finish(runId, "failed", null, msg);
  }
}

async function finish(
  runId: string,
  status: "completed" | "failed",
  result: string | null,
  error: string | null
) {
  const sql = getSql();
  await sql`
    update runs set status = ${status}, result = ${result}, error = ${error}, ended_at = now()
    where id = ${runId}
  `;
}
