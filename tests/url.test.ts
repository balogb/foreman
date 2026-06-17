import { describe, it, expect } from "vitest";
import { normalizeUrl } from "@/lib/util/url";

// normalizeUrl produces the dedupe key that drives "surface only what is new".
// Two URLs that point at the same article must collapse to the same key.
describe("normalizeUrl", () => {
  it("ignores scheme, query string, and hash", () => {
    const a = normalizeUrl("https://example.com/post?utm_source=x#frag");
    const b = normalizeUrl("http://example.com/post");
    expect(a).toBe("example.com/post");
    expect(a).toBe(b);
  });

  it("lowercases host and path and strips a trailing slash", () => {
    expect(normalizeUrl("https://Example.COM/Blog/Post/")).toBe(
      "example.com/blog/post"
    );
  });

  it("keeps distinct paths distinct", () => {
    expect(normalizeUrl("https://example.com/a")).not.toBe(
      normalizeUrl("https://example.com/b")
    );
  });

  it("falls back to a lowercased trim for non-URL input", () => {
    expect(normalizeUrl("  Not A Url  ")).toBe("not a url");
  });
});
