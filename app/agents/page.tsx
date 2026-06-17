import Link from "next/link";
import { getSql } from "@/lib/db";
import { CreateAgent, RunLauncher } from "./ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AgentRow {
  id: string;
  name: string;
  model: string;
  role_prompt: string;
}

export default async function AgentsPage() {
  let agents: AgentRow[] = [];
  let error: string | null = null;
  try {
    const rows = await getSql()`select id, name, model, role_prompt from agents order by created_at desc`;
    agents = rows as unknown as AgentRow[];
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-sm text-zinc-500 hover:underline">
              Foreman
            </Link>
            <span className="text-sm text-zinc-300 dark:text-zinc-700"> · </span>
            <Link href="/evals" className="text-sm text-zinc-500 hover:underline">
              Evals
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Agents</h1>
          </div>
          <CreateAgent />
        </div>

        {error && (
          <div className="mt-8 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <p className="font-medium">Could not load agents.</p>
            <p className="mt-1 font-mono text-xs">{error}</p>
            <p className="mt-2">
              Check DATABASE_URL and that migrations have run (`npm run db:migrate`).
            </p>
          </div>
        )}

        {!error && agents.length === 0 && (
          <p className="mt-8 text-sm text-zinc-500">
            No agents yet. Seed the researcher with <code>npm run db:seed</code>, or
            create one above.
          </p>
        )}

        <ul className="mt-8 space-y-4">
          {agents.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{a.name}</h2>
                <span className="font-mono text-xs text-zinc-400">{a.model}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                {a.role_prompt}
              </p>
              <RunLauncher agentId={a.id} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
