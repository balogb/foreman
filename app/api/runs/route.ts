import { NextResponse, after } from "next/server";
import { createRun, drive, failRun } from "@/lib/agent/loop";

export const runtime = "nodejs";
export const maxDuration = 300; // the background drive runs within this window

export async function POST(req: Request) {
  let body: { agent_id?: string; task?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const agentId = body.agent_id?.trim();
  const task = body.task?.trim();
  if (!agentId || !task) {
    return NextResponse.json({ error: "agent_id and task are required." }, { status: 400 });
  }

  let runId: string;
  try {
    runId = await createRun(agentId, task);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  // Drive the loop after responding so the client isn't blocked for minutes.
  // The run page polls for progress. drive() catches its own errors; this guard
  // covers anything before the loop's try block.
  after(async () => {
    try {
      await drive(runId);
    } catch (err) {
      await failRun(runId, err instanceof Error ? err.message : String(err));
    }
  });

  return NextResponse.json({ run_id: runId }, { status: 201 });
}
