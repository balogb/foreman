/**
 * fetch_url - fetch a public URL and extract readable text.
 *
 * Phase 1 uses a lightweight tag-strip (no heavy readability dependency). Good
 * enough to feed the agent article text; can be upgraded later. Caps response
 * size and time so a hostile or huge page cannot stall a run.
 */

import { assertPublicUrl } from "./ssrf";

const MAX_BYTES = 2_000_000; // 2 MB
// Chars returned to the agent. Kept lean on purpose: fetched text persists in
// the conversation context every subsequent turn, so a large cap multiplies
// input-token cost across a multi-fetch run. ~8k chars is enough to judge an
// article and pull a finding.
const MAX_TEXT = 8_000;
const TIMEOUT_MS = 15_000;

export interface FetchResult {
  url: string;
  title: string | null;
  text: string;
  truncated: boolean;
}

export async function fetchUrl(url: string): Promise<FetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }

  // SSRF guard: refuse internal / loopback / metadata targets before fetching.
  await assertPublicUrl(parsed.toString());

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(parsed, {
      signal: controller.signal,
      headers: { "User-Agent": "ForemanBot/0.1 (+research agent)" },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);

  const buf = await res.arrayBuffer();
  const raw = new TextDecoder("utf-8").decode(buf.slice(0, MAX_BYTES));

  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : null;

  const text = htmlToText(raw);
  return {
    url: parsed.toString(),
    title,
    text: text.slice(0, MAX_TEXT),
    truncated: text.length > MAX_TEXT,
  };
}

export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|section|article|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function decodeEntities(s: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    mdash: "-", ndash: "-", hellip: "...", rsquo: "'", lsquo: "'",
    ldquo: '"', rdquo: '"',
  };
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => named[name.toLowerCase()] ?? m);
}
