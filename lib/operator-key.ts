// Client-only helper for calling the gated (paid) endpoints. Attaches the
// operator key from localStorage; if the server rejects (401), prompts once and
// retries. Locally (no key configured server-side) it never prompts.

const STORAGE = "foreman_operator_key";

function getKey(): string | null {
  try {
    return localStorage.getItem(STORAGE);
  } catch {
    return null;
  }
}

function promptForKey(): string | null {
  const v = typeof window !== "undefined" ? window.prompt("Operator key (required to run paid actions):") : null;
  if (v) {
    try {
      localStorage.setItem(STORAGE, v);
    } catch {
      /* ignore */
    }
  }
  return v;
}

/** POST JSON to a gated endpoint, supplying the operator key (prompting if needed). */
export async function mutate(url: string, body: unknown): Promise<Response> {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  const key = getKey();
  if (key) base["x-foreman-key"] = key;

  const res = await fetch(url, { method: "POST", headers: base, body: JSON.stringify(body) });
  if (res.status !== 401) return res;

  const entered = promptForKey();
  if (!entered) return res;
  return fetch(url, {
    method: "POST",
    headers: { ...base, "x-foreman-key": entered },
    body: JSON.stringify(body),
  });
}
