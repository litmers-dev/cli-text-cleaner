# PROJECT KNOWLEDGE BASE

**Generated:** 2026-08-26
**Commit:** 36c5cde
**Branch:** main

## OVERVIEW

Browser-only Vite application that turns terminal, CLI, and coding-agent output into chat-ready plain text.
The runtime is dependency-free JavaScript, HTML, and CSS; Node's built-in test runner covers pure cleaning and DOM integration behavior.

## STRUCTURE

```text
cli-text-cleaner/
├── index.html              # Entire application shell and accessible control markup
├── src/
│   ├── main.js             # DOM bindings, clipboard actions, live synchronization
│   ├── text-cleaner.js     # Main normalization pipeline and terminal-sequence parser
│   ├── markdown-cleaner.js # Markdown decoration removal
│   └── styles.css          # Design tokens, components, and responsive layout
├── test/
│   ├── app-integration.test.js # Browser-global fakes and page interaction tests
│   ├── text-cleaner.test.js    # Main heuristic regression suite
│   └── markdown-cleaner.test.js
├── DESIGN.md               # Required visual-system contract
└── package.json            # Vite, ESLint, Node test commands
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Change cleanup behavior | `src/text-cleaner.js` | Keep the ordered transformation pipeline intact |
| Change Markdown stripping | `src/markdown-cleaner.js` | Fence handling and inline cleanup are separate |
| Change page interaction | `src/main.js` | State is DOM-backed and updates immediately |
| Change markup or controls | `index.html` | Preserve native labels, buttons, and landmarks |
| Change visual styling | `DESIGN.md`, then `src/styles.css` | Add tokens or primitives to the design contract first |
| Add regression coverage | `test/*.test.js` | Use Node's built-in test runner and Given/When/Then structure |
| Change CI behavior | `.github/workflows/ci.yml` | CI runs the repository scripts |

## CODE MAP

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| `cleanText` | exported function | `src/text-cleaner.js` | app and tests | Orchestrates the full cleanup pipeline |
| `DEFAULT_OPTIONS` | exported constant | `src/text-cleaner.js` | app and tests | Defines public cleaning defaults |
| `stripTerminalSequences` | exported function | `src/text-cleaner.js` | pipeline and tests | Parses CSI and control-string sequences |
| `normalizeMessengerPunctuation` | exported function | `src/text-cleaner.js` | pipeline and tests | Converts typographic separators safely |
| `stripMarkdownDecorations` | exported function | `src/markdown-cleaner.js` | pipeline and tests | Removes Markdown syntax while preserving content |
| `update` | DOM handler | `src/main.js` | event listeners | Recomputes result and metrics from current controls |
| `syncFromOutput` | DOM handler | `src/main.js` | output listener | Keeps editable output and source synchronized |

## CONVENTIONS

- Use browser-native APIs and ES modules; do not add a framework for local interaction.
- Keep text processing pure and independently importable from DOM code.
- Merge options over `DEFAULT_OPTIONS` at the cleanup boundary.
- Preserve fenced-code content before broad text normalization, then restore it afterward.
- Keep the application browser-only. User text must not leave the device.
- Use native Node tests, strict assertions, and deterministic DOM fakes.
- Update `DESIGN.md` before introducing a new visual token, component pattern, or interaction state.

## ANTI-PATTERNS (THIS PROJECT)

- Do not send pasted text to a server, telemetry endpoint, analytics service, or remote logger.
- Do not use a broad ANSI regex in place of the explicit control-sequence parser.
- Do not reorder normalization stages without regression tests for URLs, email, lists, and fenced code.
- Do not normalize punctuation inside protected URLs or email addresses.
- Do not pin Korean prose or documentation wording in tests; assert machine-observable behavior.
- Do not replace native controls with inaccessible clickable containers.
- Do not add timing sleeps to tests or depend on real clipboard permissions.

## UNIQUE STYLES

- The source and result editors are bidirectionally synchronized, not a one-way preview.
- Cleanup favors KakaoTalk and email paste quality over reversible formatting.
- The dark command-surface design uses one red action accent, blue focus states, and ring-based depth.
- Mobile keeps the same workflow by stacking source before result rather than hiding controls.

## COMMANDS

```bash
npm ci
npm run dev
npm run check
npm run build
npm run preview
```

## NOTES

- `src/text-cleaner.js` and its regression suite are deliberate hotspots because the cleanup heuristics interact.
- Clipboard actions require a secure browser context; manual paste and copy remain valid fallbacks.
- Markdown cleanup is intentionally heuristic and not reversible.
- NFKC and messenger punctuation options can alter exact code points, so users can disable each independently.
