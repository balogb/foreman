import { describe, it, expect } from "vitest";
import { htmlToText, decodeEntities } from "@/lib/tools/fetch_url";

describe("htmlToText", () => {
  it("drops script and style content", () => {
    const html = "<p>Keep</p><script>var x=1;</script><style>.a{}</style>";
    const text = htmlToText(html);
    expect(text).toContain("Keep");
    expect(text).not.toContain("var x");
    expect(text).not.toContain(".a{}");
  });

  it("turns block-close tags into line breaks", () => {
    const text = htmlToText("<p>one</p><p>two</p>");
    expect(text).toBe("one\ntwo");
  });

  it("strips tags and collapses whitespace", () => {
    const text = htmlToText("<div>  a   <span>b</span>  </div>");
    expect(text).toBe("a b");
  });

  it("removes html comments", () => {
    expect(htmlToText("<!-- hidden -->visible")).toBe("visible");
  });
});

describe("decodeEntities", () => {
  it("decodes named entities", () => {
    expect(decodeEntities("Tom &amp; Jerry &lt;3")).toBe("Tom & Jerry <3");
  });

  it("decodes numeric and hex entities", () => {
    expect(decodeEntities("&#65;&#x42;")).toBe("AB");
  });

  it("leaves unknown entities intact", () => {
    expect(decodeEntities("&notathing;")).toBe("&notathing;");
  });
});
