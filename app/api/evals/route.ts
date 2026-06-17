import { NextResponse, after } from "next/server";
import { getSql } from "@/lib/db";
import { createEvalRun, runEvalCases } from "@/lib/eval/runner";

export const runtime = "nodejs";
export const maxDuration = 300; // the background case runner runs within this window

export async function GET() {
  const sql = getSql();
  const runs = await sql`
    select er.id, er.aggregate_score, er.started_at, er.ended_at,
           s.name as suite_name, a.name as agent_name
    from eval_runs er
    join eval_suites s on s.id = er.suite_id
    join agents a on a.id = er.agent_id
    order by er.started_at desc
    limit 50
  `;
  return NextResponse.json({ runs });
}

export async function POST(req: Request) {
  let body: { suite_id?: string; agent_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const suiteId = body.suite_id?.trim();
  const agentId = body.agent_id?.trim();
  if (!suiteId || !agentId) {
    return NextResponse.json({ error: "suite_id and agent_id are required." }, { status: 400 });
  }
  let evalRunId: string;
  try {
    evalRunId = await createEvalRun(suiteId, agentId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  // Run the cases after responding; the scorecard auto-refreshes as they land.
  after(() => runEvalCases(evalRunId, suiteId, agentId));

  return NextResponse.json({ evalRunId }, { status: 201 });
}
