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
const PROTECTED_FENCE_LINE_PREFIX_BASE = "\uE000F";
const PROTECTED_FENCE_LINE_SUFFIX = "\uE001";

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

  if (settings.stripAnsi) {
    text = stripTerminalSequences(text);
  }

  text = text
    .replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n");

  const fenceProtection = protectFencedBlockLines(text, settings.stripMarkdown);
  text = fenceProtection.text;
  settings.protectedFenceLinePrefix = fenceProtection.prefix;

  if (settings.normalizeUnicode && typeof text.normalize === "function") {
    text = normalizeUnicodeText(text, !settings.normalizePunctuation);
  }

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
    result = result.trim();
  }

  if (settings.mode === "aggressive") {
    if (settings.collapseSpaces) {
      result = result.replace(/[ \t]{2,}/g, " ");
    }
  }

  return restoreProtectedFenceLines(result, settings.protectedFenceLinePrefix);
}

function normalizeLine(line, options) {
  if (isProtectedFenceLine(line, options.protectedFenceLinePrefix)) return line;

  let next = line
    .replace(/^[\t ]+/, "")
    .replace(/^(?:[▏▎▍▌][\t ]*)+/, "")
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
const EMAIL_LOCAL_ATOM_CHARS = "\\p{L}\\p{N}\\p{M}.!#$%&'*+/=?^_`{|}~·∙⋅—–―‑…-";
const EMAIL_LOCAL_ATOM_SOURCE = `[${EMAIL_LOCAL_ATOM_CHARS}]+`;
const EMAIL_DOMAIN_LABEL_SOURCE = "[\\p{L}\\p{N}\\p{M}-]+";
const EMAIL_SPAN_SOURCE = `${EMAIL_LOCAL_ATOM_SOURCE}[ \\t]*@[ \\t]*${EMAIL_DOMAIN_LABEL_SOURCE}(?:[ \\t]*\\.[ \\t]*${EMAIL_DOMAIN_LABEL_SOURCE})+`;
const PROTECTED_CONTACT_SPAN = new RegExp(
  `(https?:\\/\\/[^\\s<>"']+)|(^|[^${EMAIL_LOCAL_ATOM_CHARS}])(${EMAIL_SPAN_SOURCE})`,
  "giu",
);
const REPAIRABLE_EMAIL = new RegExp(
  `(^|[^${EMAIL_LOCAL_ATOM_CHARS}])(${EMAIL_LOCAL_ATOM_SOURCE})[ \\t]*@[ \\t]*(${EMAIL_DOMAIN_LABEL_SOURCE}(?:[ \\t]*\\.[ \\t]*${EMAIL_DOMAIN_LABEL_SOURCE})+)`,
  "giu",
);
const WRAPPED_URL_CONTINUATION = /^[/?#&]\S/i;

function normalizeUnicodeText(value, preserveMessengerPunctuation) {
  return replaceOutsideContactSpans(value, (segment) => {
    if (!preserveMessengerPunctuation) return segment.normalize("NFKC");

    return segment
      .split(MESSENGER_PUNCTUATION)
      .map((part, index) => (index % 2 === 1 ? part : part.normalize("NFKC")))
      .join("");
  });
}

/**
 * Replace typographic list and separator characters with punctuation that
 * reads naturally when pasted into KakaoTalk or email. URLs are left intact.
 */
export function normalizeMessengerPunctuation(value) {
  const text = String(value ?? "").replace(
    new RegExp(`^(?:[*—–―]|[${UNICODE_BULLETS}])(?:[ \\t]+|$)`),
    "- ",
  );

  return replaceOutsideContactSpans(text, (segment) =>
    segment
      .replace(/[ \t]*[•●◦○▪▫■□‣⁃]+[ \t]*/g, " - ")
      .replace(/[ \t]*[·∙⋅]+[ \t]*/g, " / ")
      .replace(/[ \t]*[—–―]+[ \t]*/g, " - ")
      .replace(/‑/g, "-")
      .replace(/…/g, "..."),
  )
    .replace(/^[ \t]+(?=[/-])/, "")
    .trimEnd();
}

function replaceOutsideContactSpans(value, transform) {
  const text = String(value ?? "");
  let output = "";
  let lastIndex = 0;

  for (const match of text.matchAll(PROTECTED_CONTACT_SPAN)) {
    const span = match[1] ?? match[3];
    const prefixLength = match[1] ? 0 : (match[2]?.length ?? 0);
    const start = (match.index ?? 0) + prefixLength;
    output += transform(text.slice(lastIndex, start));
    output += span;
    lastIndex = start + span.length;
  }

  output += transform(text.slice(lastIndex));
  return output;
}

function repairUrls(line) {
  return line.replace(
    /https?:[ \t]*\/[ \t]*\/[ \t]*[a-z0-9.:-]+(?:(?:[ \t]*\/[ \t]*)[a-z0-9._~!$&'()*+,;=:@%-]*)*(?:[ \t]*[?#][ \t]*[a-z0-9._~!$&'()*+,;=:@%/?-]*)?/gi,
    (match) => match.replace(/[ \t]+/g, ""),
  );
}

function repairEmails(line) {
  return line.replace(
    REPAIRABLE_EMAIL,
    (_match, prefix, local, domain) =>
      `${prefix}${local}@${domain.replace(/[ \t]+/g, "")}`,
  );
}

function buildParagraphs(lines, options) {
  if (options.mode === "lines") return lines;

  const output = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line) {
      let blankEnd = index;
      while (blankEnd + 1 < lines.length && lines[blankEnd + 1] === "") blankEnd += 1;

      const previous = output[output.length - 1];
      const next = lines[blankEnd + 1];

      if (shouldPreserveCodeBlankRun(previous, next)) {
        pushBlankRun(output, blankEnd - index + 1);
      } else {
        pushBlank(output);
      }

      index = blankEnd;
      continue;
    }

    if (isProtectedFenceLine(line, options.protectedFenceLinePrefix)) {
      output.push(line);
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
      output[output.length - 1] = joinLines(previous, line, options);
    } else {
      output.push(line);
    }
  }

  return output;
}

function pushBlank(output) {
  if (output.length && output[output.length - 1] !== "") output.push("");
}

function pushBlankRun(output, count) {
  if (!output.length || count < 1) return;
  for (let index = 0; index < count; index += 1) {
    output.push("");
  }
}

function isStandalone(line, options) {
  if (!options.preserveBullets) return false;
  return isListItem(line) || /^#{1,6}\s+/.test(line);
}

function shouldAppendToPrevious(previous, line, options) {
  if (
    isProtectedFenceLine(previous, options.protectedFenceLinePrefix) ||
    isProtectedFenceLine(line, options.protectedFenceLinePrefix)
  ) {
    return false;
  }
  if (/https?:\/\/\S*$/i.test(previous) && WRAPPED_URL_CONTINUATION.test(line)) return true;
  if (/https?:\/\/\S*$/i.test(previous) && /^[/-]\s/.test(line)) return false;
  if (/^https?:\/\//i.test(line) && /:$/.test(previous)) return true;
  if (/@$/.test(previous) && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/i.test(line)) return true;
  if (isLikelyCodeOrCommandLine(previous) || isLikelyCodeOrCommandLine(line)) {
    return false;
  }
  if (options.preserveBullets && isListItem(line)) return false;
  if (options.preserveBullets && isListItem(previous)) {
    return isLikelyListContinuation(previous, line);
  }
  if (options.mode === "aggressive") return true;
  if (/^[A-Za-z0-9._%+-]+@/.test(line) && /\/$/.test(previous)) return true;
  if (/^[가-힣A-Za-z0-9([{]/.test(line) && endsAsContinuation(previous)) return true;
  return !/[.!?。)]$/.test(previous) && !/:$/.test(previous);
}

function isListItem(line) {
  return BULLET_LINE.test(line) || /^\d+[.)]\s+/.test(line);
}

function isLikelyListContinuation(previous, line) {
  return (
    /(?:[,/→:·-]|\[$|(?:은|는|을|를|에서|에게|으로|부터|까지|처럼|보다|및|또는|그리고|하며|하고|해서|되어|되는|있는|없는|위해|통해|대해|따라|경우|때문에))$/.test(
      previous,
    ) || /^[a-z]/.test(line)
  );
}

function endsAsContinuation(line) {
  return /[,/→:·-]$/.test(line) || /[가-힣A-Za-z0-9)]$/.test(line) || /\[$/.test(line);
}

function shouldPreserveCodeBlankRun(previous, next) {
  return Boolean(
    previous &&
      next &&
      isLikelyCodeOrCommandLine(previous) &&
      isLikelyCodeOrCommandLine(next),
  );
}

function isLikelyCodeOrCommandLine(line) {
  return (
    /^(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/.test(line) ||
    /^(?:async\s+)?function(?:\s*\*)?\s+[A-Za-z_$][\w$]*\s*\(/.test(line) ||
    /^(?:def|class)\s+[A-Za-z_$][\w$]*(?:\([^)]*\))?\s*:/.test(line) ||
    /^class\s+[A-Za-z_$][\w$]*(?:\s+extends\s+[A-Za-z_$][\w$.]*)?\s*\{/.test(line) ||
    /^import\s+(?:["'][^"']+["']|.+\s+from\s+["'][^"']+["'])\s*;?$/.test(line) ||
    /^export\s+(?:default\s+)?(?:class\s+[A-Za-z_$][\w$]*(?:\s+extends\s+[A-Za-z_$][\w$.]*)?\s*\{|function\s+[A-Za-z_$][\w$]*\s*\(|(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=|\{[^}]+\})/.test(
      line,
    ) ||
    /^(?:await\s+)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\([^)]*\);?$/.test(line) ||
    /^(?:return|throw|yield|break|continue)(?:\s+.+)?;\s*$/.test(line) ||
    /^(?:if|for|while|switch|catch)\s*\([^)]*\)\s*\{?/.test(line) ||
    /^(?:else|try|finally|do)\b.*(?:\{|:)\s*$/.test(line) ||
    /^(?:\/\/|\/\*|\*\/|#\s)|^[}\])]+[;,]?$/.test(line) ||
    /^(?:npm|pnpm|yarn|bun)\s+(?:run|exec|dlx|install|add|remove|test|build|lint|dev|start|create|publish|pack|cache|config|why|workspace|workspaces)\b/.test(
      line,
    ) ||
    /^curl\b(?=.*(?:\s-\S|\shttps?:\/\/)).+/.test(line) ||
    /^node\s+(?:-\S+|\S+\.(?:[cm]?js|mjs|cjs))(?:\s|$)/.test(line)
  );
}

function joinLines(previous, line, options) {
  if (/https?:\/\/\S*$/i.test(previous) && WRAPPED_URL_CONTINUATION.test(line)) {
    return `${previous}${line}`;
  }
  if (/@$/.test(previous) && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/i.test(line)) {
    return `${previous}${line}`;
  }
  if (/\/$/.test(previous)) return joinWithSpace(previous, line, options);
  if (/[:(]$/.test(previous)) return `${previous} ${line}`;
  if (/^https?:\/\//i.test(line)) return `${previous} ${line}`;
  return joinWithSpace(previous, line, options);
}

function joinWithSpace(previous, line, options) {
  const joined = `${previous} ${line}`;
  return options.collapseSpaces ? joined.replace(/ {2,}/g, " ") : joined;
}

function protectFencedBlockLines(text, stripMarkers) {
  const protectedLines = [];
  const prefix = createProtectedFenceLinePrefix(text);
  let fence = null;

  for (const line of text.split("\n")) {
    const candidate = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);

    if (fence === null && candidate) {
      fence = { marker: candidate[1][0], length: candidate[1].length };
      if (!stripMarkers) protectedLines.push(encodeProtectedFenceLine(line, prefix));
      continue;
    }

    if (fence !== null) {
      if (isClosingFenceLine(line, fence)) {
        if (!stripMarkers) protectedLines.push(encodeProtectedFenceLine(line, prefix));
        fence = null;
        continue;
      }

      protectedLines.push(encodeProtectedFenceLine(line, prefix));
      continue;
    }

    protectedLines.push(line);
  }

  return { text: protectedLines.join("\n"), prefix };
}

function createProtectedFenceLinePrefix(text) {
  let prefix = PROTECTED_FENCE_LINE_PREFIX_BASE;
  while (text.includes(prefix)) prefix += "F";
  return prefix;
}

function isClosingFenceLine(line, fence) {
  const candidate = line.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
  return (
    candidate !== null &&
    candidate[1][0] === fence.marker &&
    candidate[1].length >= fence.length
  );
}

function encodeProtectedFenceLine(line, prefix) {
  let hex = "";
  for (let index = 0; index < line.length; index += 1) {
    hex += line.charCodeAt(index).toString(16).padStart(4, "0");
  }
  return `${prefix}${hex}${PROTECTED_FENCE_LINE_SUFFIX}`;
}

function restoreProtectedFenceLines(text, prefix) {
  return text.replace(
    new RegExp(`${prefix}([0-9a-f]*)${PROTECTED_FENCE_LINE_SUFFIX}`, "g"),
    (_match, hex) => {
      let line = "";
      for (let index = 0; index < hex.length; index += 4) {
        line += String.fromCharCode(Number.parseInt(hex.slice(index, index + 4), 16));
      }
      return line;
    },
  );
}

function isProtectedFenceLine(line, prefix) {
  return line.startsWith(prefix) && line.endsWith(PROTECTED_FENCE_LINE_SUFFIX);
}
