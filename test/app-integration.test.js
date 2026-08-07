import assert from "node:assert/strict";
import test from "node:test";

class FakeElement {
  constructor({ checked = false, value = "" } = {}) {
    this.checked = checked;
    this.value = value;
    this.textContent = "";
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

  focus() {}
  select() {}
  setSelectionRange() {}
}

let importSequence = 0;

async function loadApp({ writeText = async () => {}, readText = async () => "" } = {}) {
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
  globalThis.window = { setTimeout: () => 1 };

  importSequence += 1;
  const app = await import(`../src/main.js?test=${importSequence}`);
  return { app, elements, options };
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

test("allows editing the cleaned result and copies the edited text", async () => {
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

  assert.equal(elements.get("#outputStats").textContent, "12자 · 1줄");
  assert.equal(elements.get("#changeStats").textContent, "3자 증가");

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
