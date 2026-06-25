const LIFECYCLE = [
  { step: "Create", body: "Define an agent: name, role, model." },
  { step: "Configure", body: "Set each tool to allow, require approval, or deny. Toggle memory and budget." },
  { step: "Run", body: "Give it a task and watch the live execution trace." },
  { step: "Approve", body: "High-risk actions pause for a human decision, with rationale." },
  { step: "Audit", body: "Every run and every decision is recorded and reviewable." },
  { step: "Evaluate", body: "Score the agent against a fixed test suite. Track regressions." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-24">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
          Foreman
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          A control plane for trustworthy agents.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Wiring an LLM to tools is easy. Making an agent safe to run inside a
          real organization is the hard part - permissions, approvals, audit,
          and evaluation. Foreman is that layer.
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

        <p className="mt-12 text-sm text-zinc-500">
          First agent in the works: an AI-agents market-intelligence researcher
          that surfaces what is new and hands you cited briefs.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <a
            href="/agents"
            className="inline-block rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Open agents
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
