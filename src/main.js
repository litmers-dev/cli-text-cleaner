import { cleanText, DEFAULT_OPTIONS } from "./text-cleaner.js";

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
    showToast("정리 결과를 복사했습니다.", "success");
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

sourceText.addEventListener("input", update);
outputText.addEventListener("input", updateOutputMetrics);
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

document.querySelector("#selectButton").addEventListener("click", () => {
  outputText.focus();
  outputText.select();
});

update();
