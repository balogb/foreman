import { describe, it, expect } from "vitest";
import { citationValidity, citedUrlsFrom } from "@/lib/eval/score";
import { extractUrls } from "@/lib/util/url";

describe("extractUrls", () => {
  it("pulls urls from markdown and trims trailing punctuation", () => {
    const md = "See [o3](https://techcrunch.com/o3) and https://anthropic.com/mcp.";
    expect(extractUrls(md).sort()).toEqual(
      ["https://anthropic.com/mcp", "https://techcrunch.com/o3"].sort()
    );
  });
});

describe("citationValidity", () => {
  it("scores 1 when every cited url was fetched (ignoring query/scheme)", () => {
    const cited = ["https://example.com/a?utm=x", "http://example.com/b"];
    const fetched = ["https://example.com/a", "https://example.com/b/"];
    const cv = citationValidity(cited, fetched);
    expect(cv.score).toBe(1);
    expect(cv.ungrounded).toEqual([]);
  });

  it("flags ungrounded (hallucinated) citations", () => {
    const cv = citationValidity(
      ["https://real.com/x", "https://made-up.com/y"],
      ["https://real.com/x"]
    );
    expect(cv.score).toBe(0.5);
    expect(cv.groundedCount).toBe(1);
    expect(cv.ungrounded).toEqual(["https://made-up.com/y"]);
  });

  it("treats an empty brief (no citations) as vacuously valid", () => {
    expect(citationValidity([], ["https://x.com"]).score).toBe(1);
  });
});

describe("citedUrlsFrom", () => {
  it("merges brief urls with finding urls, deduped", () => {
    const out = citedUrlsFrom("text https://a.com here", ["https://a.com", "https://b.com"]);
    expect(out.sort()).toEqual(["https://a.com", "https://b.com"].sort());
  });
});
