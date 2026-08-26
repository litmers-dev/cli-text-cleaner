import assert from "node:assert/strict";
import test from "node:test";

class FakeElement {
  constructor({ checked = false, value = "" } = {}) {
    this.checked = checked;
    this.value = value;
    this.textContent = "";
    this.children = [];
    this.hidden = false;
    this.scrollTop = 0;
    this.dataset = {};
    this.classList = { add() {}, remove() {} };
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  dispatch(type) {
    return this.listeners.get(type)?.({ target: this });
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  focus() {}
  select() {}
  setSelectionRange() {}
}

class FakeStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

let importSequence = 0;

async function loadApp({
  writeText = async () => {},
  readText = async () => "",
  storage = new FakeStorage(),
} = {}) {
  const elements = new Map();
  const elementIds = [
    "sourceText",
    "outputText",
    "sourceStats",
    "outputStats",
    "changeStats",
    "toast",
    "sampleButton",
    "swapButton",
    "clearButton",
    "copyButton",
    "pasteButton",
    "selectButton",
    "historyCount",
    "historyList",
    "historyEmpty",
    "clearHistoryButton",
  ];
  elementIds.forEach((id) => elements.set(`#${id}`, new FakeElement()));

  const smartMode = new FakeElement({ checked: true, value: "smart" });
  const options = new Map([
    ["#stripAnsi", new FakeElement({ checked: true })],
    ["#collapseSpaces", new FakeElement({ checked: true })],
    ["#preserveBullets", new FakeElement({ checked: true })],
    ["#stripMarkdown", new FakeElement({ checked: true })],
    ["#normalizePunctuation", new FakeElement({ checked: true })],
    ["#normalizeUnicode", new FakeElement({ checked: true })],
  ]);
  const inputs = [smartMode, ...options.values()];

  globalThis.document = {
    createElement() {
      return new FakeElement();
    },
    querySelector(selector) {
      if (selector === "input[name='mode']:checked") return smartMode;
      return elements.get(selector) ?? options.get(selector);
    },
    querySelectorAll(selector) {
      return selector === "input" ? inputs : [];
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { readText, writeText } },
  });
  globalThis.window = { localStorage: storage, setTimeout: () => 1 };

  importSequence += 1;
  const app = await import(`../src/main.js?test=${importSequence}`);
  return { app, elements, options, storage };
}

test("applies the Markdown option through the page controls", async () => {
  const { elements, options } = await loadApp();
  const source = elements.get("#sourceText");
  const output = elements.get("#outputText");

  source.value = "## **제목**\n\n- **항목**";
  source.dispatch("input");
  assert.equal(output.value, "제목\n\n- 항목");

  options.get("#stripMarkdown").checked = false;
  options.get("#stripMarkdown").dispatch("change");
  assert.equal(output.value, source.value);
});

test("loads a synthetic example.com sample and cleans it locally", async () => {
  const { app, elements } = await loadApp();

  elements.get("#sampleButton").dispatch("click");

  const source = elements.get("#sourceText").value;
  const output = elements.get("#outputText").value;
  assert.equal(source, app.SAMPLE_TEXT);
  assert.match(source, /docs\.example\.com/);
  assert.match(source, /support @ example\.com/);
  assert.doesNotMatch(source, /password|비밀번호|api[_ -]?key|secret[_ -]?key/i);
  assert.match(output, /https:\/\/docs\.example\.com\/getting-started/);
  assert.match(output, /support@example\.com/);
  assert.match(output, /- 터미널 색상 코드 제거/);
  assert.match(output, /- 줄바꿈 \/ 공백 정리 - 카톡과 이메일에 붙여넣기/);
  assert.doesNotMatch(output, /\u001b/);
});

test("can disable chat and email punctuation normalization", async () => {
  const { elements, options } = await loadApp();
  const source = elements.get("#sourceText");
  const output = elements.get("#outputText");

  source.value = "• 항목\n· 기획·디자인 — 안내…";
  source.dispatch("input");
  assert.equal(output.value, "- 항목\n- 기획 / 디자인 - 안내...");

  options.get("#normalizePunctuation").checked = false;
  options.get("#normalizePunctuation").dispatch("change");
  assert.equal(output.value, source.value);
});

test("syncs edited output back to the source and copies the edited text", async () => {
  let copied = "";
  const { elements } = await loadApp({
    writeText: async (value) => {
      copied = value;
    },
  });
  const source = elements.get("#sourceText");
  const output = elements.get("#outputText");

  source.value = "  원본 문구  ";
  source.dispatch("input");
  output.value = "직접 수정한 최종 문구";
  output.dispatch("input");

  assert.equal(source.value, "직접 수정한 최종 문구");
  assert.equal(elements.get("#sourceStats").textContent, "12자 · 1줄");
  assert.equal(elements.get("#outputStats").textContent, "12자 · 1줄");
  assert.equal(elements.get("#changeStats").textContent, "양쪽 동기화됨");

  await elements.get("#copyButton").dispatch("click");
  assert.equal(copied, "직접 수정한 최종 문구");
});

test("shows a warning toast when clipboard copy is rejected", async () => {
  const { elements } = await loadApp({
    writeText: async () => {
      throw new Error("permission denied");
    },
  });
  const source = elements.get("#sourceText");
  source.value = "복사 테스트";
  source.dispatch("input");

  await elements.get("#copyButton").dispatch("click");

  const toast = elements.get("#toast");
  assert.equal(toast.dataset.type, "warning");
  assert.match(toast.textContent, /복사할 수 없습니다/);
});

test("keeps ten distinct results after successful clipboard copies", async () => {
  // Given
  const { elements, storage } = await loadApp();
  const source = elements.get("#sourceText");
  const copyButton = elements.get("#copyButton");

  // When
  for (let index = 0; index < 12; index += 1) {
    source.value = `result-${index}`;
    source.dispatch("input");
    await copyButton.dispatch("click");
  }
  await copyButton.dispatch("click");

  // Then
  const history = JSON.parse(storage.getItem("cli-text-cleaner.history.v1"));
  assert.equal(history.length, 10);
  assert.deepEqual(history.slice(0, 3), ["result-11", "result-10", "result-9"]);
  assert.equal(elements.get("#historyCount").textContent, "10");
});

test("restores and clears browser-local copy history", async () => {
  // Given
  const { elements, storage } = await loadApp();
  const source = elements.get("#sourceText");
  const copyButton = elements.get("#copyButton");

  source.value = "```text\nalpha\nbeta\n```";
  source.dispatch("input");
  assert.equal(elements.get("#outputText").value, "alpha\nbeta");
  await copyButton.dispatch("click");
  source.value = "second saved result";
  source.dispatch("input");
  await copyButton.dispatch("click");

  // When
  elements.get("#historyList").children[1].children[0].dispatch("click");

  // Then
  assert.equal(source.value, "alpha\nbeta");
  assert.equal(elements.get("#outputText").value, "alpha\nbeta");

  // When
  elements.get("#clearHistoryButton").dispatch("click");

  // Then
  assert.equal(storage.getItem("cli-text-cleaner.history.v1"), null);
  assert.equal(elements.get("#historyList").children.length, 0);
  assert.equal(elements.get("#historyCount").textContent, "0");
});
