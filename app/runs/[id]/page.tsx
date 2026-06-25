"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { mutate } from "@/lib/operator-key";

interface Step {
  id: string;
  idx: number;
  kind: string;
  content: Record<string, unknown>;
}
interface ToolCall {
  id: string;
  tool_name: string;
  args: Record<string, unknown>;
  status: string;
  result: unknown;
  rationale: string | null;
}
interface Finding {
  id: string;
  title: string;
  summary: string | null;
  source_url: string;
  source_date: string | null;
}
interface Brief {
  id: string;
  title: string;
  content: string;
  status: string;
}
interface RunData {
  run: {
    id: string;
    task: string;
    status: string;
    result: string | null;
    error: string | null;
    total_tokens: number;
    total_steps: number;
  };
  steps: Step[];
  tool_calls: ToolCall[];
  findings: Finding[];
  briefs: Brief[];
}

const STATUS_STYLE: Record<string, string> = {
  running: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  awaiting_approval: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  aborted: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export default function RunPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<RunData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  // Shared fetch used by the event handler below. The polling effect inlines its
  // own copy so it does not call a state-setting function from inside the effect.
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/runs/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error((await res.json()).error ?? "Load failed");
    setData(await res.json());
  }, [id]);

  // Initial load + poll while the run is active; self-stops on a terminal status.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      try {
        const res = await fetch(`/api/runs/${id}`, { cache: "no-store" });
        const json = await res.json();
        if (!active) return;
        if (!res.ok) {
          setErr(json.error ?? "Load failed");
          return;
        }
        setData(json);
        const status = json.run?.status;
        if (active && (status === "running" || status === "awaiting_approval")) {
          // Poll every 5s while active. Each poll re-pulls the full run payload
          // from the DB, so a tighter interval multiplies network egress; 5s keeps
          // the live view responsive while cutting transfer ~60% vs the prior 2s.
          timer = setTimeout(tick, 5000);
        }
      } catch (e) {
        if (active) setErr(e instanceof Error ? e.message : String(e));
      }
    }
    tick();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  async function decide(toolCallId: string, decision: "approved" | "rejected") {
    setActing(true);
    try {
      const res = await mutate("/api/approvals", { tool_call_id: toolCallId, decision });
      if (!res.ok) throw new Error((await res.json()).error ?? "Decision failed");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(false);
    }
  }

  if (err) return <Shell><p className="text-red-600">{err}</p></Shell>;
  if (!data) return <Shell><p className="text-zinc-500">Loading run...</p></Shell>;

  const { run, steps, tool_calls, findings, briefs } = data;
  const pending = tool_calls.filter((t) => t.status === "pending");

  return (
    <Shell>
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[run.status] ?? ""}`}>
          {run.status.replace("_", " ")}
        </span>
        <span className="text-xs text-zinc-500">
          {run.total_steps} steps · {run.total_tokens.toLocaleString()} tokens
        </span>
      </div>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">{run.task}</h1>

      {run.error && (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {run.error}
        </p>
      )}

      {pending.length > 0 && (
        <section className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/40">
          <h2 className="font-semibold text-amber-900 dark:text-amber-200">
            Approval required
          </h2>
          {pending.map((tc) => (
            <div key={tc.id} className="mt-3">
              <p className="text-sm">
                The agent wants to run <span className="font-mono">{tc.tool_name}</span>.
              </p>
              {tc.rationale && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{tc.rationale}</p>
              )}
              <ProposedAction args={tc.args} />
              <div className="mt-3 flex gap-2">
                <button
                  disabled={acting}
                  onClick={() => decide(tc.id, "approved")}
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={acting}
                  onClick={() => decide(tc.id, "rejected")}
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {briefs.map((b) => (
        <section key={b.id} className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{b.title}</h2>
            <span className="text-xs text-zinc-400">{b.status}</span>
          </div>
          <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            <Markdown>{b.content}</Markdown>
          </div>
        </section>
      ))}

      {findings.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Findings ({findings.length})
          </h2>
          <ul className="mt-2 space-y-2">
            {findings.map((f) => (
              <li key={f.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                <a href={f.source_url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {f.title}
                </a>
                {f.summary && <p className="mt-1 text-zinc-600 dark:text-zinc-400">{f.summary}</p>}
                <p className="mt-1 truncate text-xs text-zinc-400">{f.source_url}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Execution trace
        </h2>
        <ol className="mt-2 space-y-2">
          {steps.map((s) => (
            <li key={s.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <TraceStep step={s} />
            </li>
          ))}
        </ol>
      </section>
    </Shell>
  );
}

function ProposedAction({ args }: { args: Record<string, unknown> }) {
  const content = typeof args.content === "string" ? args.content : null;
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-zinc-950">
      {typeof args.title === "string" && <p className="font-medium">{args.title}</p>}
      {content ? (
        <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
          <Markdown>{content}</Markdown>
        </div>
      ) : (
        <pre className="mt-1 overflow-x-auto text-xs">{JSON.stringify(args, null, 2)}</pre>
      )}
    </div>
  );
}

function TraceStep({ step }: { step: Step }) {
  const c = step.content;
  if (step.kind === "tool_call") {
    return (
      <div>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
          tool_call · {String(c.tool ?? "")}
        </span>
        <pre className="mt-1 overflow-x-auto text-xs text-zinc-500">
          {JSON.stringify(c.input ?? {}, null, 2)}
        </pre>
      </div>
    );
  }
  if (step.kind === "tool_result") {
    return (
      <div>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
          tool_result · {String(c.tool ?? "")}
        </span>
        <pre className="mt-1 max-h-40 overflow-auto text-xs text-zinc-500">
          {truncate(JSON.stringify(c.result ?? {}, null, 2), 1200)}
        </pre>
      </div>
    );
  }
  if (step.kind === "reasoning") {
    return (
      <div>
        <span className="rounded bg-violet-100 px-1.5 py-0.5 font-mono text-xs text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          thinking
        </span>
        <p className="mt-1 whitespace-pre-wrap text-sm italic text-zinc-500">
          {String(c.text ?? "")}
        </p>
      </div>
    );
  }
  // message
  return <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{String(c.text ?? "")}</p>;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "\n..." : s;
}

function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="my-2 leading-6">{children}</p>,
        ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
        li: ({ children }) => <li className="leading-6">{children}</li>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline dark:text-blue-400">
            {children}
          </a>
        ),
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        h1: ({ children }) => <h3 className="mt-3 mb-1 font-semibold">{children}</h3>,
        h2: ({ children }) => <h3 className="mt-3 mb-1 font-semibold">{children}</h3>,
        h3: ({ children }) => <h3 className="mt-3 mb-1 font-semibold">{children}</h3>,
        code: ({ children }) => (
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">{children}</code>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/agents" className="text-sm text-zinc-500 hover:underline">
          ← Agents
        </Link>
        <div className="mt-4">{children}</div>
      </main>
    </div>
  );
}
