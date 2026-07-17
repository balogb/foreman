const LIFECYCLE = [
  {
    step: "Permissions",
    body: "Configure every tool as allowed, denied, or approval-required before the agent runs.",
  },
  {
    step: "Approval",
    body: "Pause consequential actions for a human decision with the agent's rationale in view.",
  },
  {
    step: "Trace",
    body: "Persist the reasoning, tool calls, retrieved context, findings, and published output.",
  },
  {
    step: "Audit",
    body: "Answer who approved what, when, and why from database rows instead of screenshots.",
  },
  {
    step: "Evals",
    body: "Score quality with citation checks and LLM judgment so regressions are visible.",
  },
  {
    step: "Cost",
    body: "Use model choice, budgets, prompt caching, and graceful convergence to control spend.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-24">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
          Foreman / Public proof artifact
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Governed AI agents, built to be inspected.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Foreman is a deployed reference implementation for the layer most
          agent demos skip: permissions, human approval gates, audit trails,
          evals, cost controls, and MCP access.
        </p>
        <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
          The first agent is an AI-agents market-intelligence researcher. It
          searches public sources, fetches anything it cites, dedupes against
          memory, pauses before publishing, and records the run for review.
        </p>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-2">
          {LIFECYCLE.map(({ step, body }, i) => (
            <li key={step} className="bg-white p-5 dark:bg-zinc-950">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-mono text-zinc-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-semibold">{step}</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {body}
              </p>
            </li>
          ))}
        </ol>

        <section className="mt-12 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-semibold">Why this matters</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Enterprise agent adoption stalls on control questions: what can the
            agent do, who approved it, what did it read, did it cite real
            sources, and did a change make it better or worse? Foreman is built
            around those questions rather than around a chat transcript.
          </p>
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <a
            href="/agents"
            className="inline-block rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Open live app
          </a>
          <a
            href="/demo"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            See a recorded run, no key required →
          </a>
        </div>
      </main>
    </div>
  );
}
