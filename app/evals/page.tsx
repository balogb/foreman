import Link from "next/link";
import { getSql } from "@/lib/db";
import { RunEval } from "./ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EvalsPage() {
  let suites: { id: string; name: string; case_count: number }[] = [];
  let agents: { id: string; name: string }[] = [];
  let runs: {
    id: string;
    suite_name: string;
    agent_name: string;
    aggregate_score: number | null;
    started_at: string;
    ended_at: string | null;
  }[] = [];
  let error: string | null = null;

  try {
    const sql = getSql();
    const [s, a, r] = await Promise.all([
      sql`select s.id, s.name, count(c.id)::int as case_count
          from eval_suites s left join eval_cases c on c.suite_id = s.id
          group by s.id, s.name order by s.created_at asc`,
      sql`select id, name from agents order by created_at desc`,
      sql`select er.id, er.aggregate_score, er.started_at, er.ended_at,
                 s.name as suite_name, a.name as agent_name
          from eval_runs er
          join eval_suites s on s.id = er.suite_id
          join agents a on a.id = er.agent_id
          order by er.started_at desc limit 25`,
    ]);
    suites = s as typeof suites;
    agents = a as typeof agents;
    runs = r as typeof runs;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          Foreman
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Evals</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Score the agent against a fixed suite: a programmatic citation-validity
          check plus an independent LLM judge.
        </p>

        {error ? (
          <p className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        ) : (
          <div className="mt-6">
            <RunEval suites={suites} agents={agents} />
          </div>
        )}

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Recent eval runs
        </h2>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No eval runs yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {runs.map((r) => (
              <li key={r.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                <Link href={`/evals/${r.id}`} className="flex items-center justify-between hover:underline">
                  <span>
                    {r.suite_name} <span className="text-zinc-400">·</span> {r.agent_name}
                  </span>
                  <span className="font-mono">
                    {r.ended_at
                      ? `${Math.round((r.aggregate_score ?? 0) * 100)}%`
                      : "running..."}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
