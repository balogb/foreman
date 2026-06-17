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
    select er.id, er.aggregate_score, er.started_at, er.ended_at,
           s.name as suite_name, a.name as agent_name
    from eval_runs er
    join eval_suites s on s.id = er.suite_id
    join agents a on a.id = er.agent_id
    where er.id = ${id} limit 1
  `;
  if (!runRows[0]) return NextResponse.json({ error: "Eval run not found." }, { status: 404 });

  const results = await sql`
    select r.id, r.run_id, r.scores, r.total_score, r.passed, c.task
    from eval_results r
    join eval_cases c on c.id = r.case_id
    where r.eval_run_id = ${id}
    order by r.created_at asc
  `;

  return NextResponse.json({ eval_run: runRows[0], results });
}
