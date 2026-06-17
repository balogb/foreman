/** Stable dedupe/identity key: lowercase host + path, drop query/hash and trailing slash. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.host + u.pathname).toLowerCase().replace(/\/$/, "");
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Extract all http(s) URLs from free text (e.g. a markdown brief). */
export function extractUrls(text: string): string[] {
  const out = new Set<string>();
  const re = /https?:\/\/[^\s)\]<>"']+/gi;
  for (const m of text.matchAll(re)) {
    out.add(m[0].replace(/[.,);]+$/, "")); // trim trailing punctuation
  }
  return [...out];
}
