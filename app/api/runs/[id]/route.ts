import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sql = getSql();

  const runRows = await sql`
    select id, agent_id, task, status, result, error, total_tokens, total_steps, started_at, ended_at
    from runs where id = ${id} limit 1
  `;
  if (!runRows[0]) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  const [steps, toolCalls, findings, briefs] = await Promise.all([
    sql`select id, idx, kind, content, created_at from steps where run_id = ${id} order by idx asc`,
    sql`select id, tool_name, args, status, result, rationale, created_at, executed_at from tool_calls where run_id = ${id} order by created_at asc`,
    sql`select id, title, summary, source_url, source_date, discovered_at from findings where run_id = ${id} order by discovered_at asc`,
    sql`select id, title, content, status, created_at, approved_at from briefs where run_id = ${id} order by created_at asc`,
  ]);

  return NextResponse.json({
    run: runRows[0],
    steps,
    tool_calls: toolCalls,
    findings,
    briefs,
  });
}
