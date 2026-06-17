import Link from "next/link";
import { getSql } from "@/lib/db";
import { AutoRefresh } from "@/components/auto-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Result {
  id: string;
  run_id: string | null;
  task: string;
  total_score: number | null;
  passed: boolean | null;
  scores: Record<string, unknown>;
}

function pct(n: unknown): string {
  const v = Number(n);
  return Number.isFinite(v) ? `${Math.round(v * 100)}%` : "-";
}

export default async function EvalRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sql = getSql();

  const runRows = await sql`
    select er.id, er.aggregate_score, er.ended_at, s.name as suite_name, a.name as agent_name
    from eval_runs er
    join eval_suites s on s.id = er.suite_id
    join agents a on a.id = er.agent_id
    where er.id = ${id} limit 1
  `;
  const run = runRows[0];
  const results = run
    ? ((await sql`
        select r.id, r.run_id, r.scores, r.total_score, r.passed, c.task
        from eval_results r join eval_cases c on c.id = r.case_id
        where r.eval_run_id = ${id} order by r.created_at asc
      `) as unknown as Result[])
    : [];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/evals" className="text-sm text-zinc-500 hover:underline">
          ← Evals
        </Link>

        {!run ? (
          <p className="mt-4 text-red-600">Eval run not found.</p>
        ) : (
          <>
            <AutoRefresh active={!run.ended_at} />
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              {String(run.suite_name)}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {String(run.agent_name)} ·{" "}
              {run.ended_at ? (
                <>
                  aggregate{" "}
                  <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                    {pct(run.aggregate_score)}
                  </span>
                </>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">running... ({results.length} done)</span>
              )}
            </p>

            <ul className="mt-6 space-y-4">
              {results.map((r) => {
                const s = r.scores ?? {};
                const ungrounded = Array.isArray(s.ungrounded) ? (s.ungrounded as string[]) : [];
                return (
                  <li key={r.id} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{r.task}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.passed
                            ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {r.passed ? "pass" : "fail"} {pct(r.total_score)}
                      </span>
                    </div>

                    {"error" in s ? (
                      <p className="mt-2 text-sm text-red-600">{String(s.error)}</p>
                    ) : (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          <Metric label="Citations" value={pct(s.citation_validity)} />
                          <Metric label="Relevance" value={pct(s.relevance)} />
                          <Metric label="Specificity" value={pct(s.specificity)} />
                          <Metric label="Grounding" value={pct(s.grounding)} />
                        </div>
                        <p className="mt-3 text-xs text-zinc-500">
                          {String(s.grounded_count ?? 0)}/{String(s.cited_count ?? 0)} cited URLs were
                          actually fetched.
                          {ungrounded.length > 0 && (
                            <span className="text-amber-600 dark:text-amber-400">
                              {" "}
                              {ungrounded.length} ungrounded.
                            </span>
                          )}
                        </p>
                        {typeof s.rationale === "string" && s.rationale && (
                          <p className="mt-1 text-xs italic text-zinc-500">Judge: {s.rationale}</p>
                        )}
                        {r.run_id && (
                          <Link
                            href={`/runs/${r.run_id}`}
                            className="mt-2 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            view run trace →
                          </Link>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-900">
      <div className="text-zinc-500">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}
