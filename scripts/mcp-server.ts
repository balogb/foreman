/**
 * Foreman MCP server (stdio).
 *
 * Exposes the research agent over the Model Context Protocol so any MCP client
 * (Claude Desktop, Claude Code, etc.) can run research and read briefs. Run via:
 *   npm run mcp
 * and point your MCP client at that command (see README).
 *
 * IMPORTANT: stdio transport uses stdout for JSON-RPC - nothing else may write
 * to stdout here. (The agent loop is silent; keep it that way.)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getSql } from "../lib/db";
import { startRun, resumeRun } from "../lib/agent/loop";

const RESEARCHER = "AI Agents Market Researcher";

async function researcherId(): Promise<string> {
  const sql = getSql();
  const rows = await sql`select id from agents where name = ${RESEARCHER} limit 1`;
  if (!rows[0]) throw new Error(`Agent "${RESEARCHER}" not found. Run "npm run db:seed" first.`);
  return String(rows[0].id);
}

/**
 * In MCP mode the calling operator is implicitly the approver, so we auto-grant
 * the publish_brief gate. Recorded as decided_by 'mcp-client' in the audit trail.
 */
async function autoApprove(runId: string, maxRounds = 4): Promise<void> {
  const sql = getSql();
  for (let i = 0; i < maxRounds; i++) {
    const rows = await sql`select status from runs where id = ${runId} limit 1`;
    if (rows[0]?.status !== "awaiting_approval") return;
    const pending = await sql`select id, args from tool_calls where run_id = ${runId} and status = 'pending'`;
    for (const tc of pending) {
      await sql`update tool_calls set status = 'approved' where id = ${tc.id}`;
      await sql`
        insert into approvals (run_id, tool_call_id, decision, decided_by, proposed_action)
        values (${runId}, ${tc.id}, 'approved', 'mcp-client', ${JSON.stringify(tc.args)}::jsonb)
      `;
    }
    await resumeRun(runId);
  }
}

const server = new McpServer({ name: "foreman", version: "0.1.0" });

server.tool(
  "run_research",
  "Run the Foreman research agent on a task and return the published brief. The human-in-the-loop approval is auto-granted in MCP mode (logged as 'mcp-client').",
  { task: z.string().describe("What to research, e.g. 'what is new in AI agent frameworks'.") },
  async ({ task }) => {
    const agentId = await researcherId();
    const runId = await startRun(agentId, task);
    await autoApprove(runId);
    const sql = getSql();
    const briefs = await sql`select title, content from briefs where run_id = ${runId} order by created_at desc limit 1`;
    const text = briefs[0]
      ? `# ${briefs[0].title}\n\n${briefs[0].content}\n\n(run ${runId})`
      : `No brief was produced (run ${runId}).`;
    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "list_briefs",
  "List recent research briefs (id, title, date).",
  { limit: z.number().int().min(1).max(50).optional().describe("Max briefs (default 10).") },
  async ({ limit }) => {
    const sql = getSql();
    const rows = await sql`select id, title, created_at from briefs order by created_at desc limit ${limit ?? 10}`;
    const text = rows.length
      ? rows.map((r) => `- ${r.id}  ${r.title}  (${r.created_at})`).join("\n")
      : "No briefs yet.";
    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "get_brief",
  "Get the full markdown of a brief by id.",
  { brief_id: z.string().describe("Brief id from list_briefs.") },
  async ({ brief_id }) => {
    const sql = getSql();
    const rows = await sql`select title, content from briefs where id = ${brief_id} limit 1`;
    if (!rows[0]) return { content: [{ type: "text", text: "Brief not found." }], isError: true };
    return { content: [{ type: "text", text: `# ${rows[0].title}\n\n${rows[0].content}` }] };
  }
);

async function main() {
  await server.connect(new StdioServerTransport());
}
main().catch((err) => {
  // stderr only - stdout is reserved for the JSON-RPC protocol stream.
  console.error(err);
  process.exit(1);
});
