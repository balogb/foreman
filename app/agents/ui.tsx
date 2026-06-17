"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TOOL_REGISTRY, type Permission } from "@/lib/tools/registry";
import { mutate } from "@/lib/operator-key";

const PERMISSIONS: Permission[] = ["allow", "require_approval", "deny"];

export function CreateAgent() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rolePrompt, setRolePrompt] = useState("");
  const [perms, setPerms] = useState<Record<string, Permission>>(
    Object.fromEntries(
      Object.values(TOOL_REGISTRY).map((t) => [t.name, t.defaultPermission])
    )
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const tools = Object.entries(perms).map(([tool_name, permission]) => ({
        tool_name,
        permission,
      }));
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role_prompt: rolePrompt, tools }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Create failed");
      setOpen(false);
      setName("");
      setRolePrompt("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        + New agent
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h3 className="font-semibold">New agent</h3>
      <label className="mt-3 block text-sm">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          placeholder="AI Agents Market Researcher"
        />
      </label>
      <label className="mt-3 block text-sm">
        Role prompt
        <textarea
          value={rolePrompt}
          onChange={(e) => setRolePrompt(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          placeholder="You are a market-intelligence researcher..."
        />
      </label>

      <div className="mt-4">
        <p className="text-sm font-medium">Tools</p>
        <div className="mt-2 space-y-2">
          {Object.values(TOOL_REGISTRY).map((t) => (
            <div key={t.name} className="flex items-center justify-between gap-3 text-sm">
              <div>
                <span className="font-mono">{t.name}</span>
                {t.risk === "high" && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    high risk
                  </span>
                )}
              </div>
              <select
                value={perms[t.name]}
                onChange={(e) =>
                  setPerms((p) => ({ ...p, [t.name]: e.target.value as Permission }))
                }
                className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {PERMISSIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      <div className="mt-4 flex gap-2">
        <button
          disabled={busy || !name || !rolePrompt}
          onClick={submit}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Creating..." : "Create"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function RunLauncher({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [task, setTask] = useState(
    "What changed in the AI-agents product landscape recently? Surface what is new."
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await mutate("/api/runs", { agent_id: agentId, task });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      router.push(`/runs/${data.run_id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        rows={2}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
      <button
        disabled={busy || !task.trim()}
        onClick={run}
        className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {busy ? "Starting..." : "Run"}
      </button>
    </div>
  );
}
