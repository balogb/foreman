import { normalizeUrl, extractUrls } from "../util/url";

export interface CitationValidity {
  score: number; // fraction of cited URLs that were actually fetched (0-1)
  citedCount: number;
  groundedCount: number;
  ungrounded: string[];
}

/**
 * The anti-hallucination check: every URL the agent cites in its brief should
 * be one it actually fetched during the run. A high score means citations are
 * grounded in real reads, not invented.
 */
export function citationValidity(citedUrls: string[], fetchedUrls: string[]): CitationValidity {
  const fetched = new Set(fetchedUrls.map(normalizeUrl));
  const uniqueCited = [...new Set(citedUrls.map((u) => u))];
  const grounded = uniqueCited.filter((u) => fetched.has(normalizeUrl(u)));
  const ungrounded = uniqueCited.filter((u) => !fetched.has(normalizeUrl(u)));
  return {
    score: uniqueCited.length === 0 ? 1 : grounded.length / uniqueCited.length,
    citedCount: uniqueCited.length,
    groundedCount: grounded.length,
    ungrounded,
  };
}

/** Pull cited URLs from a brief's text plus any structured finding URLs. */
export function citedUrlsFrom(briefContent: string, findingUrls: string[]): string[] {
  return [...new Set([...extractUrls(briefContent), ...findingUrls])];
}
