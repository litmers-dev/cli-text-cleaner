# Contributing

Thanks for helping improve CLI Text Cleaner.

## Before you start

- Search [existing issues](https://github.com/litmers-dev/cli-text-cleaner/issues) before opening a new one.
- Use the bug report form for reproducible defects and the feature request form for proposed behavior.
- Open an issue before a large UI, behavior, or dependency change so the direction can be agreed first.
- Never paste credentials, customer data, or private terminal output into an issue or test fixture.
- Report security concerns through [GitHub private vulnerability reporting](https://github.com/litmers-dev/cli-text-cleaner/security/advisories/new), not a public issue.

## Development setup

Use Node.js 20.19 or newer and install the locked dependencies:

~~~sh
npm ci
npm run dev
~~~

Keep the app's privacy boundary intact: text processing should remain browser-only, with no backend, analytics, or input transmission unless maintainers have explicitly approved the change.

## Making a change

1. Create a focused branch from `main`.
2. Keep changes small and avoid unrelated formatting or generated `dist/` files.
3. Add or update `node:test` coverage for text-cleaning behavior and regressions.
4. Update documentation when a mode, option, limitation, or development command changes.
5. Run the full local verification:

   ~~~sh
   npm run check
   npm run build
   ~~~

## Pull requests

Describe the problem, the chosen behavior, and how you verified it. Link the relevant issue when one exists. A pull request should keep tests, lint, and the production build green.

By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE).
