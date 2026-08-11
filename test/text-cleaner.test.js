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

test("removes CLI quote gutters and preserves quoted paragraph breaks", () => {
  const source = [
    "▎ 첫 번째 문단입니다.",
    "▎",
    "▎ 두 번째 문단입니다.",
    "▎",
    "▎ 세 번째 문단입니다.",
  ].join("\n");

  assert.equal(
    cleanText(source),
    [
      "첫 번째 문단입니다.",
      "",
      "두 번째 문단입니다.",
      "",
      "세 번째 문단입니다.",
    ].join("\n"),
  );

  for (const gutter of ["▏", "▎", "▍", "▌", "│", "┃", "║"]) {
    assert.equal(cleanText(` ${gutter} 내용`, { mode: "lines" }), "내용");
  }
});

test("removes indented vertical quote gutters and trailing separators", () => {
  const source = [
    "│ 첫 번째 문단입니다.",
    " │",
    " │ 두 번째 문단입니다.",
    " │",
    " │ 세 번째 문단입니다.",
    "",
    "",
    "----",
  ].join("\n");

  assert.equal(
    cleanText(source),
    [
      "첫 번째 문단입니다.",
      "",
      "두 번째 문단입니다.",
      "",
      "세 번째 문단입니다.",
    ].join("\n"),
  );
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

test("normalizeMessengerPunctuation avoids leading whitespace regressions", () => {
  const cases = [
    ["—third", "- third"],
    ["–third", "- third"],
    ["·third", "/ third"],
    ["•• item", "- item"],
  ];

  for (const [input, expected] of cases) {
    assert.equal(normalizeMessengerPunctuation(input), expected, input);

    const firstPass = cleanText(input, { mode: "lines", stripMarkdown: false });
    const secondPass = cleanText(firstPass, { mode: "lines", stripMarkdown: false });

    assert.equal(firstPass, expected, input);
    assert.equal(secondPass, firstPass, input);
  }
});

test("preserves a valid URL byte-for-byte while normalizing surrounding text", () => {
  assert.equal(
    cleanText("문서·안내 — https://example.com/a…b‑c·d—e", { stripMarkdown: false }),
    "문서 / 안내 - https://example.com/a…b‑c·d—e",
  );
});

test("preserves messenger punctuation inside internationalized email addresses", () => {
  assert.equal(
    cleanText("기획·디자인 — ab·cd @ example . com / 홍길동@예시.한국", {
      mode: "lines",
      stripMarkdown: false,
    }),
    "기획 / 디자인 - ab·cd@example.com / 홍길동@예시.한국",
  );
});

test("repairs wrapped URL continuations without inserting spaces", () => {
  const source = "주소: https://docs.example.com/path\n/next?x=1";

  assert.equal(
    cleanText(source, { stripMarkdown: false }),
    "주소: https://docs.example.com/path/next?x=1",
  );
});

test("repairs wrapped command-line URL continuations before code-line guards in smart and aggressive modes", () => {
  const source = "curl https://docs.example.com/path\n/next?x=1";

  for (const options of [{ stripMarkdown: false }, { mode: "aggressive", stripMarkdown: false }]) {
    const firstPass = cleanText(source, options);
    const secondPass = cleanText(firstPass, options);

    assert.equal(firstPass, "curl https://docs.example.com/path/next?x=1");
    assert.equal(secondPass, firstPass);
  }
});

test("repairs wrapped email domains without inserting spaces after @", () => {
  assert.equal(
    cleanText("문의: hello@\nexample.com", { stripMarkdown: false }),
    "문의: hello@example.com",
  );
});

test("repairs wrapped command-line email continuations before code-line guards in smart and aggressive modes", () => {
  const source = "node notify.mjs hello@\nexample.com";

  for (const options of [{ stripMarkdown: false }, { mode: "aggressive", stripMarkdown: false }]) {
    const firstPass = cleanText(source, options);
    const secondPass = cleanText(firstPass, options);

    assert.equal(firstPass, "node notify.mjs hello@example.com");
    assert.equal(secondPass, firstPass);
  }
});

test("keeps a normalized slash separator line separate from a preceding URL", () => {
  const source = "https://docs.example.com/a/b\n·third";
  const firstPass = cleanText(source, { mode: "aggressive", stripMarkdown: false });

  assert.equal(firstPass, "https://docs.example.com/a/b\n/ third");
  assert.equal(
    cleanText(firstPass, { mode: "aggressive", stripMarkdown: false }),
    firstPass,
  );
});

test("removes fence markers while preserving fenced command structure and spacing", () => {
  const source = [
    "실행 순서:",
    "```sh",
    "  pnpm   lint",
    "curl -H 'X-Test:  1' \\",
    "  https://docs.example.com/a?x=1&y=2",
    "```",
    "다음 단계",
  ].join("\n");

  assert.equal(
    cleanText(source),
    [
      "실행 순서:",
      "  pnpm   lint",
      "curl -H 'X-Test:  1' \\",
      "  https://docs.example.com/a?x=1&y=2",
      "다음 단계",
    ].join("\n"),
  );
});

test("preserves fence markers and exact fenced content when Markdown cleanup is disabled", () => {
  const source = [
    "앞 문단",
    "```txt",
    "  keep   spacing",
    "",
    "email @ example . com",
    "```",
    "뒤 문단",
  ].join("\n");

  assert.equal(
    cleanText(source, { stripMarkdown: false }),
    source,
  );
});

test("handles unclosed fenced blocks deterministically without merging surrounding prose", () => {
  const source = [
    "before",
    "~~~bash",
    "  npm   run build",
    "echo done",
  ].join("\n");

  assert.equal(
    cleanText(source),
    [
      "before",
      "  npm   run build",
      "echo done",
    ].join("\n"),
  );
});

test("still removes terminal control sequences inside protected fenced content", () => {
  const esc = "\u001b";
  const source = `\`\`\`sh\n${esc}[31mnpm run build${esc}[0m\n\`\`\``;

  assert.equal(cleanText(source), "npm run build");
});

test("does not reinterpret user text that resembles an internal fence marker", () => {
  const markerLikeText = "\uE000F0061\uE001";
  const source = `${markerLikeText}\n\`\`\`txt\nactual\n\`\`\``;

  assert.equal(cleanText(source), `${markerLikeText}\nactual`);
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

test("aggressive mode preserves literal slashes and paragraph boundaries", () => {
  const source = "alpha/beta\n\nsee https://docs.example.com/a/b";

  const result = cleanText(source, { mode: "aggressive", stripMarkdown: false });

  assert.equal(result, "alpha/beta\n\nsee https://docs.example.com/a/b");
});

test("aggressive mode preserves paths, dates, and ratios", () => {
  const source = "/etc/profile\n2026/08/03\n3/4 cup";

  assert.equal(
    cleanText(source, { mode: "aggressive", stripMarkdown: false }),
    "/etc/profile 2026/08/03 3/4 cup",
  );
});

test("aggressive mode joins arbitrary wrapped prose for paste-ready output", () => {
  assert.equal(
    cleanText("plain prose\nwrap continues", { mode: "aggressive", stripMarkdown: false }),
    "plain prose wrap continues",
  );
});

test("aggressive mode joins adjacent complete sentences while smart mode keeps them split", () => {
  const source = "첫 문장입니다.\n다음 문장입니다.";

  assert.equal(cleanText(source, { stripMarkdown: false }), source);
  assert.equal(
    cleanText(source, { mode: "aggressive", stripMarkdown: false }),
    "첫 문장입니다. 다음 문장입니다.",
  );
});

test("aggressive mode keeps the blank-line regression stable after the first pass", () => {
  const source = "a\n\n\n b";
  const firstPass = cleanText(source, { mode: "aggressive", stripMarkdown: false });

  assert.equal(firstPass, "a\n\nb");
  assert.equal(
    cleanText(firstPass, { mode: "aggressive", stripMarkdown: false }),
    firstPass,
  );
});

test("aggressive mode collapses excess blank lines to one paragraph gap", () => {
  const source = "alpha beta\n\n\n gamma delta";
  const firstPass = cleanText(source, { mode: "aggressive", stripMarkdown: false });

  assert.equal(firstPass, "alpha beta\n\ngamma delta");
  assert.equal(
    cleanText(firstPass, { mode: "aggressive", stripMarkdown: false }),
    firstPass,
  );
});

test("aggressive mode is idempotent across representative inputs", () => {
  const samples = [
    "plain prose\nwrap continues",
    "• first\n· second",
    "https://docs.example.com/a/b\n\nsee more",
    "문의: hello@\nexample.com",
    "\u001b[31mred\u001b[0m text",
    "before\n\n---\n\nafter",
    "a\n\n\n b",
    "alpha beta\n\n\n gamma delta",
  ];

  for (const sample of samples) {
    const firstPass = cleanText(sample, { mode: "aggressive" });
    const secondPass = cleanText(firstPass, { mode: "aggressive" });

    assert.equal(secondPass, firstPass, sample);
  }
});

test("leading em dash normalization is idempotent in lines and smart modes", () => {
  const firstLinesPass = cleanText("— third item", { mode: "lines", stripMarkdown: false });

  assert.equal(firstLinesPass, "- third item");
  assert.equal(
    cleanText(firstLinesPass, { mode: "lines", stripMarkdown: false }),
    firstLinesPass,
  );
  assert.equal(cleanText("— third item", { stripMarkdown: false }), "- third item");
});

test("common fenced JS remains line-separated after stripMarkdown on repeated smart passes", () => {
  const source = [
    "before",
    "```js",
    "const x = 1;",
    "console.log(x);",
    "```",
    "after",
  ].join("\n");
  const firstPass = cleanText(source);

  assert.equal(firstPass, "before\nconst x = 1;\nconsole.log(x);\nafter");
  assert.equal(cleanText(firstPass), firstPass);
});

test("common fenced shell commands remain line-separated after stripMarkdown on repeated smart passes", () => {
  const source = [
    "before",
    "```sh",
    "npm install",
    "npm run build",
    "```",
    "after",
  ].join("\n");
  const firstPass = cleanText(source);

  assert.equal(firstPass, "before\nnpm install\nnpm run build\nafter");
  assert.equal(cleanText(firstPass), firstPass);
});

test("common fenced shell commands remain line-separated after stripMarkdown on repeated aggressive passes", () => {
  const source = [
    "before",
    "```sh",
    "npm install",
    "npm run build",
    "```",
    "after",
  ].join("\n");
  const firstPass = cleanText(source, { mode: "aggressive" });

  assert.equal(firstPass, "before\nnpm install\nnpm run build\nafter");
  assert.equal(cleanText(firstPass, { mode: "aggressive" }), firstPass);
});

test("fenced JS keeps internal blank lines on repeated aggressive passes after Markdown stripping", () => {
  const source = [
    "before",
    "```js",
    "const x = 1;",
    "",
    "console.log(x);",
    "```",
    "after",
  ].join("\n");
  const firstPass = cleanText(source, { mode: "aggressive" });

  assert.equal(firstPass, "before\nconst x = 1;\n\nconsole.log(x);\nafter");
  assert.equal(cleanText(firstPass, { mode: "aggressive" }), firstPass);
});

test("fenced JS keeps repeated internal blank lines on repeated smart passes after Markdown stripping", () => {
  const source = [
    "before",
    "```js",
    "const x = 1;",
    "",
    "",
    "console.log(x);",
    "```",
    "after",
  ].join("\n");
  const firstPass = cleanText(source);

  assert.equal(firstPass, "before\nconst x = 1;\n\n\nconsole.log(x);\nafter");
  assert.equal(cleanText(firstPass), firstPass);
});

test("fenced JS keeps repeated internal blank lines on repeated aggressive passes after Markdown stripping", () => {
  const source = [
    "before",
    "```js",
    "const x = 1;",
    "",
    "",
    "console.log(x);",
    "```",
    "after",
  ].join("\n");
  const firstPass = cleanText(source, { mode: "aggressive" });

  assert.equal(firstPass, "before\nconst x = 1;\n\n\nconsole.log(x);\nafter");
  assert.equal(cleanText(firstPass, { mode: "aggressive" }), firstPass);
});

test("common function, brace, package command, and comment lines remain separate on repeated passes", () => {
  const sources = [
    ["before", "```js", "function greet() {", "return 1;", "}", "```", "after"],
    ["before", "```sh", "npm run lint", "npm run build", "```", "after"],
    ["before", "```js", "// note", "console.log('done');", "```", "after"],
  ];

  for (const sourceLines of sources) {
    const source = sourceLines.join("\n");

    for (const options of [{}, { mode: "aggressive" }]) {
      const firstPass = cleanText(source, options);
      assert.equal(cleanText(firstPass, options), firstPass, source);
    }
  }
});

test("does not mistake common English prose starters for code", () => {
  const cases = [
    ["문의:\nreturn policy applies", "문의: return policy applies"],
    ["가이드:\ntry this option first", "가이드: try this option first"],
    ["메모:\ngit status page is clean", "메모: git status page is clean"],
  ];

  for (const [source, expected] of cases) {
    assert.equal(cleanText(source, { stripMarkdown: false }), expected);
    assert.equal(cleanText(source, { mode: "aggressive", stripMarkdown: false }), expected);
  }
});

test("normalizeMessengerPunctuation does not compress repeated spaces by itself", () => {
  assert.equal(normalizeMessengerPunctuation("alpha  beta"), "alpha  beta");
});

test("collapseSpaces false preserves repeated interior spaces when punctuation normalization stays enabled", () => {
  assert.equal(
    cleanText("alpha  beta", {
      mode: "lines",
      stripMarkdown: false,
      collapseSpaces: false,
    }),
    "alpha  beta",
  );
});

test("collapseSpaces false preserves repeated spaces when joined prose lines are merged", () => {
  assert.equal(
    cleanText("alpha  beta\ncontinues", {
      stripMarkdown: false,
      collapseSpaces: false,
    }),
    "alpha  beta continues",
  );
});

test("aggressive mode respects collapseSpaces false for repeated interior spaces", () => {
  assert.equal(
    cleanText("alpha  beta", {
      mode: "aggressive",
      stripMarkdown: false,
      collapseSpaces: false,
    }),
    "alpha  beta",
  );
});

test("determinism matrix covers smart and aggressive edge cases beyond the named regressions", () => {
  const matrix = [
    {
      input: "주소:\nhttps://docs.example.com/path",
      options: { mode: "aggressive", stripMarkdown: false },
      expected: "주소: https://docs.example.com/path",
    },
    {
      input: "문의:\nhello@\nexample.com",
      options: { mode: "aggressive", stripMarkdown: false },
      expected: "문의: hello@example.com",
    },
    {
      input: "a\n\n\n b",
      options: { mode: "aggressive", stripMarkdown: false },
      expected: "a\n\nb",
    },
    {
      input: "alpha beta\n\n\n gamma delta",
      options: { mode: "aggressive", stripMarkdown: false },
      expected: "alpha beta\n\ngamma delta",
    },
    {
      input: "— third item",
      options: { mode: "lines", stripMarkdown: false },
      expected: "- third item",
    },
    {
      input: "alpha  beta\ncontinues",
      options: { stripMarkdown: false, collapseSpaces: false },
      expected: "alpha  beta continues",
    },
    {
      input: "before\nconst x = 1;\nconsole.log(x);\nafter",
      options: {},
      expected: "before\nconst x = 1;\nconsole.log(x);\nafter",
    },
  ];

  for (const { input, options, expected } of matrix) {
    const firstPass = cleanText(input, options);
    const secondPass = cleanText(firstPass, options);

    assert.equal(firstPass, expected, input);
    assert.equal(secondPass, firstPass, input);
  }
});

test("treats bare keyword prose like 'class action' as wrapped text in smart mode", () => {
  const source = "Topic:\nclass action";
  const firstPass = cleanText(source, { stripMarkdown: false });
  const secondPass = cleanText(firstPass, { stripMarkdown: false });

  assert.equal(firstPass, "Topic: class action");
  assert.equal(secondPass, firstPass);
});
