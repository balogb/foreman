/* eslint-disable @next/next/no-img-element */
// Static, key-free walkthrough of a real captured run. No API calls, no operator
// key, no token spend - so anyone can see what Foreman does end to end. The screens
// are from an actual run of the task below; the audit shots are live SQL against the
// run's own rows.
import Link from "next/link";

export const metadata = {
  title: "Foreman - A recorded run",
  description:
    "A real Foreman run, captured end to end: live trace, human-in-the-loop approval, a cited report, and the audit trail in the database. No key required.",
};

interface Beat {
  step: string;
  title: string;
  body: string;
  img: string;
  alt: string;
}

const BEATS: Beat[] = [
  {
    step: "Run",
    title: "Give an agent a real task",
    body: "A research agent, configured with web search and source-fetch tools on Haiku for cheap retrieval. The task: identify the current events and tensions between Anthropic and the US government. It searches, then fetches each primary source before it will cite it - it cannot cite what it has not read.",
    img: "/demo/02-agents.png",
    alt: "The Foreman agents screen with the research agent and its task.",
  },
  {
    step: "Approve",
    title: "Nothing ships without a human",
    body: "The agent finished its research and wants to publish its brief - but it pauses. Publishing is a high-risk action, so it stops for a human decision, with the full proposed brief and its rationale in view. Approve or reject. Nothing is published autonomously.",
    img: "/demo/03-approval-gate.png",
    alt: "The human-in-the-loop approval gate: the proposed brief with Approve and Reject buttons.",
  },
  {
    step: "Report",
    title: "A cited report, after sign-off",
    body: "Once approved, the brief publishes: an executive summary and key developments, each tied to a primary source the agent actually fetched. 39 steps, ~93k tokens, fully traced.",
    img: "/demo/04-published-report.png",
    alt: "The published, cited brief on Anthropic and the US government.",
  },
];

const AUDIT: Beat[] = [
  {
    step: "Audit",
    title: "Every run, step, and decision is persisted",
    body: "Runs, steps, tool calls, approvals, findings, and briefs all land in a relational schema. The agent's entire trace - including its private reasoning - is stored, not just the final answer.",
    img: "/demo/05-audit-tables.png",
    alt: "The database tables backing Foreman: runs, steps, tool_calls, approvals, briefs, evals.",
  },
  {
    step: "Audit",
    title: "Query what the agent was thinking",
    body: "Because the reasoning is stored, you can query it directly. This pulls the agent's thinking steps for the run straight from the database - the answer to 'why did it do that?' is a SQL query away.",
    img: "/demo/06-audit-reasoning.png",
    alt: "A SQL query returning the agent's stored reasoning steps for the run.",
  },
  {
    step: "Audit",
    title: "Prove a human approved it",
    body: "The strongest audit question - 'did a person actually approve this action?' - is answerable. This joins the run's publish_brief tool call to its approval record: the exact action, the brief content, and the decision (approved). Defensible governance, not a screenshot of a chat.",
    img: "/demo/07-audit-approval-proof.png",
    alt: "A SQL join showing the publish_brief action and its approval decision.",
  },
];

function Frame({ img, alt }: { img: string; alt: string }) {
  return (
    <img
      src={img}
      alt={alt}
      className="mt-5 w-full rounded-lg border border-zinc-200 shadow-sm dark:border-zinc-800"
    />
  );
}

function Section({ beat }: { beat: Beat }) {
  return (
    <section className="mt-16">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">
          {beat.step}
        </span>
      </div>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{beat.title}</h2>
      <p className="mt-3 max-w-2xl leading-7 text-zinc-600 dark:text-zinc-400">
        {beat.body}
      </p>
      <Frame img={beat.img} alt={beat.alt} />
    </section>
  );
}

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-20">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← Foreman
        </Link>

        <p className="mt-8 text-sm font-medium uppercase tracking-widest text-zinc-500">
          A recorded run
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          See it work, no keys required.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          The live demo gates real runs behind an operator key so a public URL
          cannot run up an API bill. This is a real run, captured end to end - so
          you can see the whole thing without one: a live trace, a human-in-the-loop
          approval, a cited report, and the audit trail straight from the database.
        </p>

        {/* Optional: drop a Loom/YouTube embed of the screen recording here later. */}

        <div className="mt-12 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              The task:
            </span>{" "}
            &ldquo;Identify the current events and tensions between Anthropic and
            the US government.&rdquo; What follows is exactly what the agent did.
          </p>
        </div>

        {BEATS.map((b) => (
          <Section key={b.title} beat={b} />
        ))}

        <hr className="mt-16 border-zinc-200 dark:border-zinc-800" />
        <p className="mt-12 text-sm font-medium uppercase tracking-widest text-zinc-500">
          The audit trail
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          Trust, but verify - in the database.
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-zinc-600 dark:text-zinc-400">
          Approvals and reasoning are not UI theater. They are rows you can query.
        </p>

        {AUDIT.map((b) => (
          <Section key={b.title} beat={b} />
        ))}

        <section className="mt-16 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-semibold">Take the whole transcript with you</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            The full run - every step, tool call, and decision - exported to a
            spreadsheet.
          </p>
          <a
            href="/demo/transcript-export.xlsx"
            className="mt-3 inline-block rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Download transcript (.xlsx)
          </a>
        </section>

        <div className="mt-16 flex flex-wrap gap-4 text-sm">
          <Link
            href="/agents"
            className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            Run it live (operator key)
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Back to Foreman
          </Link>
        </div>
      </main>
    </div>
  );
}
