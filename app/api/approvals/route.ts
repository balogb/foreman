import { NextResponse, after } from "next/server";
import { getSql } from "@/lib/db";
import { resumeRun, failRun } from "@/lib/agent/loop";

export const runtime = "nodejs";
export const maxDuration = 300; // the background resume continues the agent loop

export async function POST(req: Request) {
  let body: { tool_call_id?: string; decision?: string; rationale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const toolCallId = body.tool_call_id?.trim();
  const decision = body.decision?.trim();
  if (!toolCallId || (decision !== "approved" && decision !== "rejected")) {
    return NextResponse.json(
      { error: "tool_call_id and decision ('approved' | 'rejected') are required." },
      { status: 400 }
    );
  }

  const sql = getSql();
  const tcRows = await sql`select * from tool_calls where id = ${toolCallId} limit 1`;
  const tc = tcRows[0];
  if (!tc) return NextResponse.json({ error: "Tool call not found." }, { status: 404 });
  if (tc.status !== "pending") {
    return NextResponse.json(
      { error: `Tool call is '${tc.status}', not pending.` },
      { status: 409 }
    );
  }

  // Record the decision and the audit-trail row.
  await sql`update tool_calls set status = ${decision} where id = ${toolCallId}`;
  await sql`
    insert into approvals (run_id, tool_call_id, decision, proposed_action, rationale)
    values (${tc.run_id}, ${toolCallId}, ${decision}, ${JSON.stringify(tc.args)}::jsonb, ${body.rationale ?? null})
  `;

  // Resume after responding; the run page polls for progress.
  const runId = String(tc.run_id);
  after(async () => {
    try {
      await resumeRun(runId);
    } catch (err) {
      await failRun(runId, err instanceof Error ? err.message : String(err));
    }
  });

  return NextResponse.json({ ok: true, run_id: runId });
}
