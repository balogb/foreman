"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "@/lib/operator-key";

interface Suite {
  id: string;
  name: string;
  case_count: number;
}
interface Agent {
  id: string;
  name: string;
}

export function RunEval({ suites, agents }: { suites: Suite[]; agents: Agent[] }) {
  const router = useRouter();
  const [suiteId, setSuiteId] = useState(suites[0]?.id ?? "");
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (suites.length === 0 || agents.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Need at least one eval suite and one agent. Run <code>npm run db:seed</code>.
      </p>
    );
  }

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await mutate("/api/evals", { suite_id: suiteId, agent_id: agentId });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eval failed");
      router.push(`/evals/${data.evalRunId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Suite
          <select
            value={suiteId}
            onChange={(e) => setSuiteId(e.target.value)}
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {suites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.case_count} cases)
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Agent
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={busy}
          onClick={run}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Starting..." : "Run eval"}
        </button>
      </div>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
    </div>
  );
}
