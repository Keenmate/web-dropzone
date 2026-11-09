# Web Dropzone

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@keenmate/web-dropzone.svg)](https://www.npmjs.com/package/@keenmate/web-dropzone)

A file-upload web component with drag and drop, previews, validation, an upload queue (progress,
pause / resume, cancel, retry) and multiple display modes — plus decoupled picker / list / indicator /
progress elements and a headless store for your own renderer.

This repository is a workspaces monorepo with two published packages:

| Package | What | Docs |
|---|---|---|
| [`@keenmate/web-dropzone`](packages/web-dropzone) | `<web-dropzone>` (store + built-in UI) and the satellites `<web-dropzone-picker>`, `<web-dropzone-list>`, `<web-dropzone-indicator>`, `<web-dropzone-progress>` | [README](packages/web-dropzone/README.md) (what's new, install, quick start) · [usage](packages/web-dropzone/docs/usage.md) · [theming](packages/web-dropzone/docs/theming.md) · [examples](packages/web-dropzone/docs/examples.md) · [accessibility](packages/web-dropzone/docs/accessibility.md) |
| [`@keenmate/web-dropzone-core`](packages/web-dropzone-core) | The headless store — `DropzoneEngine`, `DropzoneController`, file / upload / label helpers. No DOM, no CSS | [README](packages/web-dropzone-core/README.md) · [usage](packages/web-dropzone-core/docs/usage.md) · [examples](packages/web-dropzone-core/docs/examples.md) |

- [ARCHITECTURE.md](ARCHITECTURE.md) — the store + satellites topology and the core / renderer split.
- [CHANGELOG.md](CHANGELOG.md) — release history of both packages.
- [VALIDATION-NOTES.md](VALIDATION-NOTES.md) — accepted deviations from the BlissFramework guidelines.

## Quick start

```bash
npm install @keenmate/web-dropzone
```

```html
<script type="module">
  import '@keenmate/web-dropzone';
</script>

<web-dropzone accept="image/*,.pdf" max-file-size="5MB" max-file-count="10"
              display-mode="detailed" name="files"></web-dropzone>
```

## Development

```bash
npm install
npm run dev              # example pages (examples-*.html) on the devkit dev server
npm run build            # builds web-dropzone-core, then web-dropzone (+ custom-elements.json)
npm run build:examples   # static examples site into dist-examples/
npm run test:unit        # vitest (packages/web-dropzone)
npm run test:e2e         # Playwright, against the fixture pages under test/
npm run doctor           # kmwc doctor (the BlissFramework rulebook checks)
```

## About

Authored and maintained by [Keenmate s.r.o.](https://keenmate.com/).
The component ships standalone with sensible light/dark defaults;
when mounted inside [Pure Admin](https://pureadmin.io/) — or any
host that publishes the `--base-*` taxonomy via
[`@keenmate/theme-designer`](https://www.npmjs.com/package/@keenmate/theme-designer) — it adopts the host's colors,
typography, and sizing automatically. There is no runtime
dependency on Pure Admin; the integration is opt-in via CSS
variables.

## Built with BlissFramework

Follows the [BlissFramework component guidelines](https://blissframework.dev/) for structure, theming,
color-scheme, and accessibility.

## License

MIT — see [LICENSE](LICENSE).
