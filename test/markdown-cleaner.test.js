import assert from "node:assert/strict";
import test from "node:test";

import { stripMarkdownDecorations } from "../src/markdown-cleaner.js";

test("removes Markdown decoration while preserving readable content", () => {
  const source = `## 원칙: 바꾼 게 아니라 "**완성**"한 것
---

**① 3D 공간 뷰** — 설명
- **도면→옵션 설계 연결**: 설명
\`OPT-KIT-001\`과 [사용 안내](https://docs.example.com/demo)`;

  const result = stripMarkdownDecorations(source);

  assert.equal(
    result,
    `원칙: 바꾼 게 아니라 "완성"한 것

① 3D 공간 뷰 — 설명
- 도면→옵션 설계 연결: 설명
OPT-KIT-001과 사용 안내 (https://docs.example.com/demo)`,
  );
});

test("preserves Markdown list markers", () => {
  const source = "- **첫 번째**\n1. __두 번째__\n· 세 번째";

  const result = stripMarkdownDecorations(source);

  assert.equal(result, "- 첫 번째\n1. 두 번째\n· 세 번째");
});

test("removes matching code fences without changing fenced code", () => {
  const source = "````js\nconst power = 2 ** 3;\n``` stays in code\n````";

  const result = stripMarkdownDecorations(source);

  assert.equal(result, "const power = 2 ** 3;\n``` stays in code");
});

test("preserves surrounding blank lines and only drops decoration-only lines", () => {
  assert.equal(stripMarkdownDecorations("\n\n## Heading\n\n\nTail\n\n"), "\n\nHeading\n\n\nTail\n\n");
  assert.equal(stripMarkdownDecorations("before\n---\nafter"), "before\nafter");
});

test("handles escaped markers, code spans, links, images, and autolinks", () => {
  const source =
    "\\*literal\\* and `**code**` and **bold**\n" +
    "[guide](https://docs.example.com/a_(b) \"Docs\") ![diagram](https://docs.example.com/image.png)\n" +
    "<https://docs.example.com> <help@example.com> [manual][docs]";

  const result = stripMarkdownDecorations(source);

  assert.equal(
    result,
    "*literal* and **code** and bold\n" +
      "guide (https://docs.example.com/a_(b)) diagram\n" +
      "https://docs.example.com help@example.com manual",
  );
});
