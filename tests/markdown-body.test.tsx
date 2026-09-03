import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownBody } from "@/components/MarkdownBody";

describe("MarkdownBody", () => {
  it("renders common GFM message formatting", () => {
    const html = renderToStaticMarkup(
      <MarkdownBody>{"## Review\n\n- **Good**\n- `Needs work`"}</MarkdownBody>,
    );

    expect(html).toContain("<h2>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<strong>Good</strong>");
    expect(html).toContain("<code");
  });

  it("does not execute raw HTML from a message", () => {
    const html = renderToStaticMarkup(<MarkdownBody>{"<script>alert(1)</script>"}</MarkdownBody>);
    expect(html).not.toContain("<script>");
  });
});
