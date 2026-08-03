import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanText,
  DEFAULT_OPTIONS,
  normalizeMessengerPunctuation,
  stripTerminalSequences,
} from "../src/text-cleaner.js";

test("exports immutable defaults for the browser controls", () => {
  assert.equal(Object.isFrozen(DEFAULT_OPTIONS), true);
  assert.deepEqual(DEFAULT_OPTIONS, {
    mode: "smart",
    stripAnsi: true,
    collapseSpaces: true,
    preserveBullets: true,
    stripMarkdown: true,
    normalizePunctuation: true,
    normalizeUnicode: true,
  });
});

test("normalizes bullets and typographic punctuation for chat and email", () => {
  const source = [
    "• 첫 번째",
    "◦ 두 번째",
    "* 세 번째",
    "기획·디자인 — 카톡용–문장…",
    "https://docs.example.com/a—b",
  ].join("\n");

  assert.equal(
    cleanText(source, { mode: "lines", stripMarkdown: false }),
    [
      "- 첫 번째",
      "- 두 번째",
      "- 세 번째",
      "기획 / 디자인 - 카톡용 - 문장...",
      "https://docs.example.com/a—b",
    ].join("\n"),
  );
});

test("keeps consecutive bullet items on separate lines", () => {
  assert.equal(cleanText("• 첫 번째\n· 두 번째"), "- 첫 번째\n- 두 번째");
});

test("keeps normal text and URLs separate from a preceding bullet item", () => {
  const source = [
    "• 첫 번째",
    "◦ 두 번째",
    "기획·디자인 — 카톡용–문장…",
    "https://docs.example.com/a—b",
  ].join("\n");

  assert.equal(
    cleanText(source),
    [
      "- 첫 번째",
      "- 두 번째",
      "기획 / 디자인 - 카톡용 - 문장...",
      "https://docs.example.com/a—b",
    ].join("\n"),
  );
});

test("joins only obvious wrapped continuations after list items", () => {
  const source = [
    "• 첫 번째 항목은",
    "추가 설명이 이어집니다.",
    "1. 두 번째 항목은",
    "another line continues.",
  ].join("\n");

  assert.equal(
    cleanText(source),
    "- 첫 번째 항목은 추가 설명이 이어집니다.\n1. 두 번째 항목은 another line continues.",
  );
});

test("allows messenger punctuation normalization to be disabled", () => {
  const source = "• 항목\n기획·디자인 — 원문…";

  assert.equal(
    cleanText(source, {
      mode: "lines",
      stripMarkdown: false,
      normalizePunctuation: false,
    }),
    source,
  );
});

test("normalizes standalone punctuation without touching URLs", () => {
  assert.equal(normalizeMessengerPunctuation("· 항목"), "- 항목");
  assert.equal(
    normalizeMessengerPunctuation("문서 — https://example.com/a—b"),
    "문서 - https://example.com/a—b",
  );
});

test("strips CSI, OSC, DCS, APC, PM, and SOS terminal sequences", () => {
  const esc = "\u001b";
  const source = [
    "before",
    `${esc}[31mred${esc}[0m`,
    `${esc}]0;hidden title\u0007after`,
    `${esc}]8;;https://docs.example.com${esc}\\link${esc}]8;;${esc}\\`,
    `${esc}Pprivate payload${esc}\\dcs`,
    `${esc}_private payload${esc}\\apc`,
    `${esc}^private payload${esc}\\pm`,
    `${esc}Xprivate payload${esc}\\sos`,
    "\u009b32mgreen",
    "\u009d0;hidden\u0007title",
    "\u0090private\u009cdone",
  ].join("|");

  assert.equal(
    stripTerminalSequences(source),
    "before|red|after|link|dcs|apc|pm|sos|green|title|done",
  );
});

test("honors the stripAnsi option", () => {
  const source = "\u001b[31mred\u001b[0m";

  assert.equal(cleanText(source, { mode: "lines", stripAnsi: false }), source);
  assert.equal(cleanText(source, { mode: "lines", stripAnsi: true }), "red");
});

test("lines mode preserves leading, trailing, and consecutive line breaks", () => {
  const source = "\n\n  first  \r\n\r\n\r\n  second\t\n\n";

  const result = cleanText(source, { mode: "lines", stripMarkdown: false });

  assert.equal(result, "\n\nfirst\n\n\nsecond\n\n");
});

test("lines mode permits explicit Markdown decoration lines to be removed", () => {
  assert.equal(cleanText("\n---\nvalue\n", { mode: "lines" }), "\nvalue\n");
});

test("normalizes Unicode, non-breaking spaces, and zero-width characters", () => {
  const source = "Ａ\u00a0Ｂ\u200b\u200c\u200d\u2060\ufeff";

  assert.equal(cleanText(source, { mode: "lines", stripMarkdown: false }), "A B");
  assert.equal(
    cleanText(source, { mode: "lines", stripMarkdown: false, normalizeUnicode: false }),
    "Ａ Ｂ",
  );
});

test("repairs spaced URLs and email addresses without changing line breaks", () => {
  const source =
    "문서: https: / /docs.example.com / guide?page=1\n문의: hello.world+cli @ example . com";

  const result = cleanText(source, { mode: "lines", stripMarkdown: false });

  assert.equal(
    result,
    "문서: https://docs.example.com/guide?page=1\n문의: hello.world+cli@example.com",
  );
});

test("removes only leading CLI quote decorations", () => {
  const source = "▏ \t▏  quoted\nmiddle ▏ stays";

  assert.equal(
    cleanText(source, { mode: "lines", stripMarkdown: false }),
    "quoted\nmiddle ▏ stays",
  );
});

test("aggressive mode collapses paragraph gaps and spaces standalone slashes without corrupting URLs", () => {
  const source = "alpha/beta\n\nsee https://docs.example.com/a/b";

  const result = cleanText(source, { mode: "aggressive", stripMarkdown: false });

  assert.equal(result, "alpha / beta\nsee https://docs.example.com/a/b");
});
