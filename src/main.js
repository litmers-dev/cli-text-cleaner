import { cleanText, DEFAULT_OPTIONS } from "./text-cleaner.js";
import {
  clearHistory,
  readHistory,
  saveHistoryEntry,
} from "./history-store.js";

export const SAMPLE_TEXT = `\u001b[36m1. 릴리스 확인\u001b[0m
   - 문서: https: / /docs.example.com /getting-started
   - 문의: support @ example.com

   2. CLI 출력
▏   처리 상태: 완료
▏   다음 문장이 화면 너비 때문에
 여러 줄로 나뉘었습니다.

   3. 확인 항목
   • **터미널 색상 코드** 제거
   · 줄바꿈·공백 정리 — 카톡과 이메일에 붙여넣기`;

const sourceText = document.querySelector("#sourceText");
const outputText = document.querySelector("#outputText");
const sourceStats = document.querySelector("#sourceStats");
const outputStats = document.querySelector("#outputStats");
const changeStats = document.querySelector("#changeStats");
const optionInputs = [...document.querySelectorAll("input")];
const toast = document.querySelector("#toast");
const historyCount = document.querySelector("#historyCount");
const historyList = document.querySelector("#historyList");
const historyEmpty = document.querySelector("#historyEmpty");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
let historyEntries = [];

function getOptions() {
  const mode = document.querySelector("input[name='mode']:checked")?.value ?? DEFAULT_OPTIONS.mode;
  return {
    mode,
    stripAnsi: document.querySelector("#stripAnsi").checked,
    collapseSpaces: document.querySelector("#collapseSpaces").checked,
    preserveBullets: document.querySelector("#preserveBullets").checked,
    stripMarkdown: document.querySelector("#stripMarkdown").checked,
    normalizePunctuation: document.querySelector("#normalizePunctuation").checked,
    normalizeUnicode: document.querySelector("#normalizeUnicode").checked,
  };
}

function update() {
  const raw = sourceText.value;
  const cleaned = cleanText(raw, getOptions());
  outputText.value = cleaned;
  outputText.scrollTop = 0;
  sourceStats.textContent = formatStats(raw);
  updateOutputMetrics();
}

function updateOutputMetrics() {
  const raw = sourceText.value;
  const result = outputText.value;
  outputStats.textContent = formatStats(result);
  updateChangeStats(raw, result);
}

function syncFromOutput() {
  const result = outputText.value;
  sourceText.value = result;
  sourceStats.textContent = formatStats(result);
  outputStats.textContent = formatStats(result);
  changeStats.textContent = result ? "양쪽 동기화됨" : "변경 없음";
}

function formatStats(value) {
  const chars = value.length.toLocaleString("ko-KR");
  const lines = value ? value.split("\n").length.toLocaleString("ko-KR") : "0";
  return `${chars}자 · ${lines}줄`;
}

function updateChangeStats(raw, cleaned) {
  if (!raw && !cleaned) {
    changeStats.textContent = "변경 없음";
    return;
  }

  const delta = raw.length - cleaned.length;
  const lineDelta = (raw ? raw.split("\n").length : 0) - (cleaned ? cleaned.split("\n").length : 0);
  const parts = [];

  if (delta > 0) parts.push(`${delta.toLocaleString("ko-KR")}자 감소`);
  if (delta < 0) parts.push(`${Math.abs(delta).toLocaleString("ko-KR")}자 증가`);
  if (lineDelta > 0) parts.push(`${lineDelta.toLocaleString("ko-KR")}줄 합침`);
  if (!parts.length) parts.push("공백과 문자만 정리");

  changeStats.textContent = parts.join(" · ");
}

async function copyResult() {
  if (!outputText.value) {
    showToast("복사할 결과가 없습니다.", "warning");
    return;
  }
  try {
    await navigator.clipboard.writeText(outputText.value);
    try {
      historyEntries = saveHistoryEntry(window.localStorage, outputText.value);
      renderHistory();
      showToast("정리 결과를 복사하고 기록에 저장했습니다.", "success");
    } catch {
      showToast("복사는 완료했지만 로컬 기록을 저장할 수 없습니다.", "warning");
    }
  } catch {
    showToast("브라우저 권한 때문에 복사할 수 없습니다.", "warning");
  }
}

async function pasteFromClipboard() {
  try {
    sourceText.value = await navigator.clipboard.readText();
    update();
    sourceText.focus();
    showToast("클립보드에서 붙여넣었습니다.", "success");
  } catch {
    showToast("브라우저 권한 때문에 붙여넣기를 실행할 수 없습니다.", "warning");
  }
}

let toastTimer;
function showToast(message, type = "success") {
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function renderHistory() {
  historyCount.textContent = String(historyEntries.length);
  historyEmpty.hidden = historyEntries.length > 0;
  clearHistoryButton.disabled = historyEntries.length === 0;

  const items = historyEntries.map((entry) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const preview = document.createElement("span");
    const action = document.createElement("span");

    button.type = "button";
    button.className = "history-item";
    button.title = "이 기록을 편집기로 불러오기";
    preview.className = "history-preview";
    preview.textContent = entry.replace(/\s+/g, " ").slice(0, 120);
    action.className = "history-action";
    action.textContent = "불러오기";
    button.append(preview, action);
    button.addEventListener("click", () => {
      outputText.value = entry;
      outputText.scrollTop = 0;
      syncFromOutput();
      sourceText.scrollTop = 0;
      sourceText.focus();
      showToast("기록을 편집기로 불러왔습니다.", "success");
    });
    item.append(button);
    return item;
  });

  historyList.replaceChildren(...items);
}

function loadHistory() {
  try {
    historyEntries = readHistory(window.localStorage);
  } catch {
    historyEntries = [];
    showToast("저장된 로컬 기록을 읽을 수 없습니다.", "warning");
  }
  renderHistory();
}

sourceText.addEventListener("input", update);
outputText.addEventListener("input", syncFromOutput);
optionInputs.forEach((input) => input.addEventListener("change", update));

document.querySelector("#sampleButton").addEventListener("click", () => {
  sourceText.value = SAMPLE_TEXT;
  update();
  sourceText.setSelectionRange(0, 0);
  sourceText.scrollTop = 0;
  sourceText.focus();
});

document.querySelector("#swapButton").addEventListener("click", () => {
  sourceText.value = outputText.value;
  update();
  sourceText.setSelectionRange(0, 0);
  sourceText.scrollTop = 0;
  sourceText.focus();
});

document.querySelector("#clearButton").addEventListener("click", () => {
  sourceText.value = "";
  update();
  sourceText.focus();
});

document.querySelector("#copyButton").addEventListener("click", copyResult);
document.querySelector("#pasteButton").addEventListener("click", pasteFromClipboard);
clearHistoryButton.addEventListener("click", () => {
  try {
    clearHistory(window.localStorage);
    historyEntries = [];
    renderHistory();
    showToast("로컬 기록을 모두 지웠습니다.", "success");
  } catch {
    showToast("브라우저에서 로컬 기록을 지울 수 없습니다.", "warning");
  }
});

document.querySelector("#selectButton").addEventListener("click", () => {
  outputText.focus();
  outputText.select();
});

loadHistory();
update();
