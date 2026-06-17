import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { TOOL_REGISTRY, type Permission } from "@/lib/tools/registry";

export const runtime = "nodejs";

export async function GET() {
  const sql = getSql();
  const agents = await sql`select * from agents order by created_at desc`;
  return NextResponse.json({ agents });
}

interface CreateBody {
  name?: string;
  role_prompt?: string;
  model?: string;
  memory_enabled?: boolean;
  max_steps?: number;
  max_tokens?: number;
  tools?: Array<{ tool_name: string; permission: Permission }>;
}

const PERMISSIONS: Permission[] = ["allow", "require_approval", "deny"];

export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = body.name?.trim();
  const rolePrompt = body.role_prompt?.trim();
  if (!name || !rolePrompt) {
    return NextResponse.json(
      { error: "name and role_prompt are required." },
      { status: 400 }
    );
  }

  // Validate tool config against the registry and permission enum.
  const tools = body.tools ?? [];
  for (const t of tools) {
    if (!TOOL_REGISTRY[t.tool_name]) {
      return NextResponse.json({ error: `Unknown tool: ${t.tool_name}` }, { status: 400 });
    }
    if (!PERMISSIONS.includes(t.permission)) {
      return NextResponse.json({ error: `Bad permission: ${t.permission}` }, { status: 400 });
    }
  }

  const sql = getSql();
  const rows = await sql`
    insert into agents (name, role_prompt, model, memory_enabled, max_steps, max_tokens)
    values (
      ${name}, ${rolePrompt},
      ${body.model ?? "claude-haiku-4-5-20251001"},
      ${body.memory_enabled ?? true},
      ${body.max_steps ?? 20},
      ${body.max_tokens ?? 200000}
    )
    returning *
  `;
  const agent = rows[0];

  for (const t of tools) {
    await sql`
      insert into agent_tools (agent_id, tool_name, permission)
      values (${agent.id}, ${t.tool_name}, ${t.permission})
      on conflict (agent_id, tool_name) do update set permission = excluded.permission
    `;
  }

  return NextResponse.json({ agent }, { status: 201 });
}
