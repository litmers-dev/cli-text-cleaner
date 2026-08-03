import { stripMarkdownDecorations } from "./markdown-cleaner.js";

export const DEFAULT_OPTIONS = Object.freeze({
  mode: "smart",
  stripAnsi: true,
  collapseSpaces: true,
  preserveBullets: true,
  stripMarkdown: true,
  normalizePunctuation: true,
  normalizeUnicode: true,
});

const ESC = "\u001b";
const C1_CSI = 0x9b;
const C1_DCS = 0x90;
const C1_SOS = 0x98;
const C1_OSC = 0x9d;
const C1_PM = 0x9e;
const C1_APC = 0x9f;
const C1_ST = 0x9c;

/**
 * Remove terminal control sequences without interpreting or executing them.
 * Supports CSI commands and the common string controls OSC, DCS, APC, PM, and
 * SOS in both 7-bit ESC-prefixed and 8-bit C1 forms.
 */
export function stripTerminalSequences(value) {
  const text = String(value ?? "");
  let output = "";

  for (let index = 0; index < text.length; ) {
    const code = text.charCodeAt(index);

    if (text[index] === ESC) {
      const introducer = text[index + 1];

      if (introducer === "[") {
        index = consumeCsi(text, index + 2);
        continue;
      }

      if (introducer === "]") {
        index = consumeControlString(text, index + 2, true);
        continue;
      }

      if (introducer === "P" || introducer === "X" || introducer === "^" || introducer === "_") {
        index = consumeControlString(text, index + 2, false);
        continue;
      }

      index = consumeEscapeSequence(text, index + 1);
      continue;
    }

    if (code === C1_CSI) {
      index = consumeCsi(text, index + 1);
      continue;
    }

    if (code === C1_OSC) {
      index = consumeControlString(text, index + 1, true);
      continue;
    }

    if (code === C1_DCS || code === C1_SOS || code === C1_PM || code === C1_APC) {
      index = consumeControlString(text, index + 1, false);
      continue;
    }

    if (code === C1_ST) {
      index += 1;
      continue;
    }

    output += text[index];
    index += 1;
  }

  return output;
}

function consumeCsi(text, start) {
  let index = start;

  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code >= 0x40 && code <= 0x7e) return index + 1;
    if ((code >= 0x30 && code <= 0x3f) || (code >= 0x20 && code <= 0x2f)) {
      index += 1;
      continue;
    }
    return index;
  }

  return index;
}

function consumeControlString(text, start, allowBell) {
  let index = start;

  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (allowBell && code === 0x07) return index + 1;
    if (code === C1_ST) return index + 1;
    if (text[index] === ESC && text[index + 1] === "\\") return index + 2;
    index += 1;
  }

  return index;
}

function consumeEscapeSequence(text, start) {
  let index = start;

  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code >= 0x20 && code <= 0x2f) {
      index += 1;
      continue;
    }
    if (code >= 0x30 && code <= 0x7e) return index + 1;
    return start;
  }

  return index;
}

export function cleanText(raw, options = DEFAULT_OPTIONS) {
  const settings = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
  let text = String(raw ?? "").replace(/\r\n?/g, "\n");

  if (settings.normalizeUnicode && typeof text.normalize === "function") {
    text = normalizeUnicodeText(text, !settings.normalizePunctuation);
  }

  if (settings.stripAnsi) {
    text = stripTerminalSequences(text);
  }

  text = text
    .replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n");

  if (settings.stripMarkdown) {
    text = stripMarkdownDecorations(text);
  }

  const lines = text.split("\n").map((line) => normalizeLine(line, settings));
  let result = buildParagraphs(lines, settings).join("\n");

  result = result
    .replace(/[ \t]+([,.:;!?])/g, "$1")
    .replace(/([([{])[ \t]+/g, "$1")
    .replace(/[ \t]+([)\]}])/g, "$1");

  if (settings.mode !== "lines") {
    result = result.replace(/\n{3,}/g, "\n\n").trim();
  }

  if (settings.mode === "aggressive") {
    result = normalizeAggressiveSlashes(
      result.replace(/[ \t]{2,}/g, " ").replace(/\n{2,}/g, "\n"),
    );
  }

  return result;
}

function normalizeLine(line, options) {
  let next = line
    .replace(/^[\t ]+/, "")
    .replace(/^(?:▏[\t ]*)+/, "")
    .replace(/[\t ]+$/, "");

  if (options.normalizePunctuation) {
    next = normalizeMessengerPunctuation(next);
  }

  if (options.collapseSpaces) {
    next = next.replace(/[\t ]{2,}/g, " ");
  }

  return repairEmails(repairUrls(next)).replace(/[ \t]+:[ \t]+/g, ": ");
}

const UNICODE_BULLETS = "•●◦○▪▫■□‣⁃∙⋅·";
const BULLET_LINE = new RegExp(`^(?:[-*]|[${UNICODE_BULLETS}])(?:[ \\t]+|$)`);
const MESSENGER_PUNCTUATION = new RegExp(
  `([${UNICODE_BULLETS}—–―‑…])`,
  "g",
);

function normalizeUnicodeText(value, preserveMessengerPunctuation) {
  if (!preserveMessengerPunctuation) return value.normalize("NFKC");

  return value
    .split(MESSENGER_PUNCTUATION)
    .map((segment, index) => (index % 2 === 1 ? segment : segment.normalize("NFKC")))
    .join("");
}

/**
 * Replace typographic list and separator characters with punctuation that
 * reads naturally when pasted into KakaoTalk or email. URLs are left intact.
 */
export function normalizeMessengerPunctuation(value) {
  const text = String(value ?? "").replace(
    new RegExp(`^(?:[*]|[${UNICODE_BULLETS}])(?:[ \\t]+|$)`),
    "- ",
  );

  return text
    .split(/(\bhttps?:\/\/[^\s<>"']+)/gi)
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      return segment
        .replace(/[•●◦○▪▫■□‣⁃]+/g, " - ")
        .replace(/[·∙⋅]+/g, " / ")
        .replace(/[—–―]+/g, " - ")
        .replace(/‑/g, "-")
        .replace(/…/g, "...")
        .replace(/[ \t]{2,}/g, " ");
    })
    .join("")
    .trimEnd();
}

function repairUrls(line) {
  return line.replace(
    /https?:[ \t]*\/[ \t]*\/[ \t]*[a-z0-9.:-]+(?:(?:[ \t]*\/[ \t]*)[a-z0-9._~!$&'()*+,;=:@%-]*)*(?:[ \t]*[?#][ \t]*[a-z0-9._~!$&'()*+,;=:@%/?-]*)?/gi,
    (match) => match.replace(/[ \t]+/g, ""),
  );
}

function repairEmails(line) {
  return line.replace(
    /\b([a-z0-9.!#$%&'*+/=?^_`{|}~-]+)[ \t]*@[ \t]*([a-z0-9-]+(?:[ \t]*\.[ \t]*[a-z0-9-]+)+)\b/gi,
    (_match, local, domain) => `${local}@${domain.replace(/[ \t]+/g, "")}`,
  );
}

function buildParagraphs(lines, options) {
  if (options.mode === "lines") return lines;

  const output = [];

  for (const line of lines) {
    if (!line) {
      pushBlank(output);
      continue;
    }

    if (isStandalone(line, options)) {
      output.push(line);
      continue;
    }

    const previous = output[output.length - 1];
    if (!previous || previous === "") {
      output.push(line);
      continue;
    }

    if (shouldAppendToPrevious(previous, line, options)) {
      output[output.length - 1] = joinLines(previous, line);
    } else {
      output.push(line);
    }
  }

  return output.filter((line, index, list) => !(line === "" && list[index - 1] === ""));
}

function pushBlank(output) {
  if (output.length && output[output.length - 1] !== "") output.push("");
}

function isStandalone(line, options) {
  if (!options.preserveBullets) return false;
  return (
    /^\d+[.)]\s+/.test(line) ||
    BULLET_LINE.test(line) ||
    /^#{1,6}\s+/.test(line)
  );
}

function shouldAppendToPrevious(previous, line, options) {
  if (options.preserveBullets && BULLET_LINE.test(previous)) return false;
  if (options.preserveBullets && /^\d+[.)]\s+/.test(previous)) return false;
  if (/^https?:\/\//i.test(line) && /:$/.test(previous)) return true;
  if (/^[A-Za-z0-9._%+-]+@/.test(line) && /\/$/.test(previous)) return true;
  if (/^[가-힣A-Za-z0-9([{]/.test(line) && endsAsContinuation(previous)) return true;
  if (options.preserveBullets && BULLET_LINE.test(line)) return false;
  if (options.preserveBullets && /^\d+[.)]\s+/.test(line)) return false;
  return !/[.!?。)]$/.test(previous) && !/:$/.test(previous);
}

function endsAsContinuation(line) {
  return /[,/→:·-]$/.test(line) || /[가-힣A-Za-z0-9)]$/.test(line) || /\[$/.test(line);
}

function joinLines(previous, line) {
  if (/\/$/.test(previous)) return `${previous} ${line}`.replace(/ {2,}/g, " ");
  if (/[:(]$/.test(previous)) return `${previous} ${line}`;
  if (/^https?:\/\//i.test(line)) return `${previous} ${line}`;
  return `${previous} ${line}`.replace(/ {2,}/g, " ");
}

function normalizeAggressiveSlashes(text) {
  return text
    .split(/(\bhttps?:\/\/[^\s<>"']+)/gi)
    .map((segment, index) =>
      index % 2 === 1 ? segment : segment.replace(/[ \t]*\/[ \t]*/g, " / "),
    )
    .join("");
}
