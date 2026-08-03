export function stripMarkdownDecorations(text) {
  const output = [];
  let fence = null;

  for (const line of text.split("\n")) {
    const candidate = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);

    if (fence === null && candidate) {
      fence = { marker: candidate[1][0], length: candidate[1].length };
      continue;
    }

    if (fence !== null) {
      if (isClosingFence(line, fence)) {
        fence = null;
        continue;
      }
      output.push(line);
      continue;
    }

    if (isDecorationOnlyLine(line)) {
      continue;
    }

    output.push(cleanInlineMarkdown(line.replace(/^\s{0,3}#{1,6}\s+/, "").replace(/^\s{0,3}(?:>\s*)+/, "")));
  }

  return output.join("\n");
}

function isClosingFence(line, fence) {
  const candidate = line.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
  return (
    candidate !== null &&
    candidate[1][0] === fence.marker &&
    candidate[1].length >= fence.length
  );
}

function isDecorationOnlyLine(line) {
  return /^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,}|={3,})\s*$/.test(line);
}

function cleanInlineMarkdown(line) {
  const codeSpans = [];
  const escapedCharacters = [];
  let text = line.replace(/(`+)(.+?)\1/g, (_, _ticks, content) => {
    const index = codeSpans.push(content) - 1;
    return `\uE000C${index}\uE001`;
  });

  text = text.replace(/\\([\\`*_[\]{}()#+.!>|~-])/g, (_match, character) => {
    const index = escapedCharacters.push(character) - 1;
    return `\uE000E${index}\uE001`;
  });

  text = text
    .replace(/!\[([^\]\n]*)\]\(((?:[^()\s]+|\([^()\n]*\))+)(?:[ \t]+"[^"\n]*")?\)/g, "$1")
    .replace(/\[([^\]\n]+)\]\(((?:[^()\s]+|\([^()\n]*\))+)(?:[ \t]+"[^"\n]*")?\)/g, (_, label, url) =>
      label === url ? url : `${label} (${url})`,
    )
    .replace(/\[([^\]\n]+)\]\[[^\]\n]*\]/g, "$1")
    .replace(/<(https?:\/\/[^>]+|[^<>\s]+@[^<>\s]+)>/g, "$1")
    .replace(/\*\*\*(?=\S)(.+?\S)\*\*\*/g, "$1")
    .replace(/___(?=\S)(.+?\S)___/g, "$1")
    .replace(/\*\*(?=\S)(.+?\S)\*\*/g, "$1")
    .replace(/__(?=\S)(.+?\S)__/g, "$1")
    .replace(/~~(?=\S)(.+?\S)~~/g, "$1")
    .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?!\*)/g, "$1$2")
    .replace(/(^|[\s([{\"'“‘])_(?=\S)([^_\n]*?\S)_(?=$|[\s.,!?;:)\]}\"'”’])/g, "$1$2");

  return text
    .replace(/\uE000E(\d+)\uE001/g, (_, index) => escapedCharacters[Number(index)])
    .replace(/\uE000C(\d+)\uE001/g, (_, index) => codeSpans[Number(index)]);
}
