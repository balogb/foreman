import { getSql } from "../db";
import { webSearch } from "./web_search";
import { fetchUrl } from "./fetch_url";
import { normalizeUrl } from "../util/url";

/** Context every tool execution gets: which run/agent it belongs to. */
export interface ToolContext {
  runId: string;
  agentId: string;
}

/**
 * Execute a tool by name. Permission enforcement happens in the agent loop;
 * by the time we get here the call is allowed (or an approved gated action).
 * Throws on unknown tool or bad args; the loop turns that into a tool_result
 * error fed back to the model.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  switch (name) {
    case "web_search":
      return webSearch(String(args.query ?? ""), Number(args.max_results ?? 5));

    case "fetch_url":
      return fetchUrl(String(args.url ?? ""));

    case "save_finding":
      return saveFinding(args, ctx);

    case "read_memory":
      return readMemory(String(args.key ?? ""), ctx);

    case "write_memory":
      return writeMemory(String(args.key ?? ""), args.value, ctx);

    case "publish_brief":
      return publishBrief(args, ctx);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function saveFinding(args: Record<string, unknown>, ctx: ToolContext) {
  const sql = getSql();
  const title = String(args.title ?? "").trim();
  const sourceUrl = String(args.source_url ?? "").trim();
  if (!title || !sourceUrl) throw new Error("save_finding requires title and source_url");

  const summary = args.summary ? String(args.summary) : null;
  const sourceDate = args.source_date ? String(args.source_date) : null;
  const dedupeKey = normalizeUrl(sourceUrl);

  // Dedupe on (agent_id, dedupe_key): no-op if already seen.
  const rows = await sql`
    insert into findings (agent_id, run_id, title, summary, source_url, source_date, dedupe_key)
    values (${ctx.agentId}, ${ctx.runId}, ${title}, ${summary}, ${sourceUrl}, ${sourceDate}, ${dedupeKey})
    on conflict (agent_id, dedupe_key) do nothing
    returning id
  `;
  return { saved: rows.length > 0, deduped: rows.length === 0, dedupe_key: dedupeKey };
}

async function readMemory(key: string, ctx: ToolContext) {
  if (!key) throw new Error("read_memory requires key");
  const sql = getSql();
  const rows = await sql`
    select value from memory where agent_id = ${ctx.agentId} and key = ${key} limit 1
  `;
  return { key, value: rows[0]?.value ?? null, found: rows.length > 0 };
}

async function writeMemory(key: string, value: unknown, ctx: ToolContext) {
  if (!key) throw new Error("write_memory requires key");
  const sql = getSql();
  const json = JSON.stringify(value ?? {});
  await sql`
    insert into memory (agent_id, key, value)
    values (${ctx.agentId}, ${key}, ${json}::jsonb)
    on conflict (agent_id, key) do update set value = ${json}::jsonb, updated_at = now()
  `;
  return { key, written: true };
}

async function publishBrief(args: Record<string, unknown>, ctx: ToolContext) {
  const sql = getSql();
  const title = String(args.title ?? "").trim();
  const content = String(args.content ?? "").trim();
  if (!title || !content) throw new Error("publish_brief requires title and content");

  // Reached here only after human approval, so it is published.
  const rows = await sql`
    insert into briefs (agent_id, run_id, title, content, status, approved_at)
    values (${ctx.agentId}, ${ctx.runId}, ${title}, ${content}, 'published', now())
    returning id
  `;
  return { brief_id: rows[0]?.id, status: "published" };
}
