/**
 * web_search - Brave Search API.
 * Free plan: https://brave.com/search/api/ (set BRAVE_API_KEY).
 */

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  age: string | null;
}

const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

export async function webSearch(
  query: string,
  maxResults = 5
): Promise<SearchResult[]> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error("Missing BRAVE_API_KEY. See .env.local.example.");

  const count = Math.min(Math.max(maxResults, 1), 20);
  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&count=${count}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": key,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brave search failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string; page_age?: string }> };
  };

  return (data.web?.results ?? []).slice(0, count).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    description: r.description ?? "",
    age: r.age ?? r.page_age ?? null,
  }));
}
