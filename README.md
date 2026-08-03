# CLI Text Cleaner

[Live demo](https://cli-text-cleaner.vercel.app/) · [Report a bug](https://github.com/litmers-dev/cli-text-cleaner/issues) · [Security](SECURITY.md)

CLI Text Cleaner turns text copied from terminals, CLIs, and AI coding tools into plain text that is ready to paste into chat or email. Paste text on the left and copy the cleaned result on the right.

터미널·CLI·AI 코딩 도구에서 복사하며 깨진 줄바꿈, 공백, ANSI 문자, 마크다운 장식을 카톡이나 이메일에 바로 붙여넣기 좋은 평문으로 정리하는 작은 도구입니다.

## Privacy / 개인정보

Pasted text is processed only in browser memory. This repository has no backend, account system, database, or application telemetry, and the app does not submit the text you enter.

입력한 텍스트는 브라우저 메모리 안에서만 처리되며 서버로 전송되지 않습니다.

## Features / 기능

- Repairs common hard wraps and indentation from terminal output.
- Removes leading CLI quote bars (`▏`), ANSI escape sequences, zero-width characters, and trailing whitespace.
- Optionally compresses spaces while preserving numbered lists and bullets.
- Converts typographic bullets to `-`, middle dots to `/`, and em/en dashes to a plain `-` for chat- and email-friendly text.
- Converts common Markdown decorations to readable plain text while retaining link destinations and fenced-code content.
- Optionally applies Unicode NFKC normalization.
- Provides paste, copy, select, swap, clear, sample, and live character/line counts.

## Modes / 모드

| Mode | Behavior |
| --- | --- |
| Document cleanup / 문서 정리 | Joins likely wrapped lines while keeping paragraphs and list items. |
| Keep lines / 라인 유지 | Cleans characters and whitespace without joining non-empty lines. |
| Aggressive / 강하게 정리 | Applies document cleanup, then collapses extra spacing and paragraph breaks. |

The toggles let you control ANSI removal, space compression, list preservation, Markdown removal, messenger-friendly punctuation, and Unicode normalization independently.

## Local development / 로컬 실행

Requires Node.js 20.19 or newer.

~~~sh
npm ci
npm run dev
~~~

Vite prints the local URL after startup. To run the same checks used by CI:

~~~sh
npm run check
npm run build
~~~

Other useful commands are `npm test`, `npm run lint`, and `npm run preview`.

## Limitations / 제한사항

- Cleanup is heuristic. Review the result when exact whitespace or formatting is important.
- Markdown cleanup produces readable plain text; it is not a reversible Markdown parser.
- NFKC normalization can change compatibility or presentation characters. Disable it when exact code points matter.
- Messenger punctuation normalization changes typographic characters by design. Disable it when middle dots, long dashes, or exact list markers matter.
- Clipboard buttons depend on browser permission and a secure context. Manual paste and copy still work when permission is unavailable.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change, and report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

The package remains `"private": true` to prevent accidental publication to npm. The source code is available under the [MIT License](LICENSE).

Built by [Litmers](https://litmers.com/) at [Cigro Inc.](https://www.cigro.io/en).
