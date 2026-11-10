# @keenmate/web-dropzone-core

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/keenmate/web-dropzone/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@keenmate/web-dropzone-core.svg)](https://www.npmjs.com/package/@keenmate/web-dropzone-core)

> The headless store of the [`@keenmate/web-dropzone`](https://www.npmjs.com/package/@keenmate/web-dropzone) family — file state, validation, the upload pipeline and the event substrate. No DOM rendering, no CSS, no custom elements.

## What is it

`@keenmate/web-dropzone-core` is what you install to build your own React / Vue / Lit / Svelte renderer
on the same file-handling engine that backs the official web components. `DropzoneEngine` validates
files (type, size, count, total size, duplicates), runs uploads through a worker pool with progress,
pause / resume, cancel (with a timeout rule) and retry with backoff, and reports every change as a DOM
event on a host element you choose. Your renderer draws the UI from those events and drives the store
through the `DropzoneController` facade.

| You want… | Install |
|---|---|
| Drop `<web-dropzone>` (or its satellites) into a page | `@keenmate/web-dropzone` |
| Build a custom renderer in your framework of choice | `@keenmate/web-dropzone-core` |

`@keenmate/web-dropzone` already depends on (and bundles) this package — install both only when you
compose your own renderer next to the official one.

## What's New in v1.0.0-rc03

- **`DropzoneEngine` + `DropzoneController` — one interaction model** — The headless class is `DropzoneEngine` (was `DropzoneCore`), and its public surface is the `DropzoneController` facade (`engine.controller`, also `el.controller` on `<web-dropzone>`, was `DropzoneStoreAPI`), built once and delegating to the current engine so a captured controller survives rebuilds. Every callback takes one `ctx` and every ctx / event detail carries `controller` and `element`, non-enumerable, so `JSON.stringify(detail)` sees only the data. Standalone, events are dispatched on the host element, bubbling and not composed (web-components-core SPEC §12.5).
- **One cancel rule** — `cancelFile(id)` returns a promise: a running handler gets its `AbortSignal` and up to `cancelTimeout` ms (default 2000) to settle while the file is `cancelling`; it settles in time → `cancelled`, otherwise `cancelTimeoutBehavior` (`error`, retryable, or `remove`). Late results are ignored and the concurrency slot is freed either way. `cancelAll()`, `beforeFilesCancelCallback` and the `file-cancel` event (`{ file, result, uploadedBytes, metadata }`) complete it.
- **`labels` — every UI string in one input** — `DEFAULT_LABELS`, `resolveLabel()` and `createLabelFn()` give renderers the same per-key-merged, placeholder-filled strings as the element (status words, row-button names, validation messages), replacing the `STATUS_LABELS` / `ACTION_LABELS` exports.
- **`removeFiles(ids)` and `hasActiveUploads`** — `removeFiles` is the pair of `addFiles` (the remove gate runs once per batch); `hasActiveUploads` is `true` while any file is pending, uploading, paused or cancelling — the signal an app needs before leaving the page.

## What's New in v1.0.0-rc02

- **`@keenmate/web-components-core` ^1.0.0-rc04 — vendored logger** — Drops the transitive `loglevel` dependency and the CJS / ESM interop crash it caused under Node's native ESM loader.

See the [CHANGELOG](https://github.com/keenmate/web-dropzone/blob/main/CHANGELOG.md) for the full history.

## Demos & docs

- 📘 [Usage / API reference](./docs/usage.md) — `DropzoneEngine`, `DropzoneController`, events, callbacks, helpers.
- 📚 [Examples](./docs/examples.md) — a vanilla renderer, a React hook, a status line.
- 🎨 [Theming](./docs/theming.md) — what a renderer gets (icons, status vocabulary, labels).
- ♿ [Accessibility](./docs/accessibility.md) — what a renderer must cover.
- 🏗️ [Architecture](https://github.com/keenmate/web-dropzone/blob/main/ARCHITECTURE.md) — the core / renderer split.

## Install

```bash
npm install @keenmate/web-dropzone-core
```

## Quick start

```ts
import { DropzoneEngine } from '@keenmate/web-dropzone-core';

const host = document.getElementById('uploader')!;
const engine = new DropzoneEngine(host, {
  maxFileCount: 5,
  beforeFilesAddCallback: async ({ files }) => (files.length > 5 ? false : undefined),
  uploadFileCallback: async ({ file, signal, setProgress }) => {
    await fetch('/api/upload', { method: 'POST', body: file, signal });
    setProgress(100);
  },
});

fileInput.addEventListener('change', () => engine.addFiles(fileInput.files!));
host.addEventListener('files-change', (e) => render(e.detail.files)); // once per frame
```

The engine validates the added files (a refused file fires `file-reject`), uploads the accepted ones
and reports every step as an event on `host`; `render()` is yours. See [usage.md](./docs/usage.md) for
the full API.

## Browser support

Modern evergreen browsers (Chrome / Edge, Firefox, Safari) — ES2020 modules, `AbortController`,
`requestAnimationFrame`. No polyfills are shipped.

## About

Authored and maintained by [Keenmate s.r.o.](https://keenmate.com/). This package is the headless part
of the family; the rendered `@keenmate/web-dropzone` ships standalone with sensible light/dark defaults;
when mounted inside [Pure Admin](https://pureadmin.io/) — or any host that publishes the `--base-*`
taxonomy via [`@keenmate/theme-designer`](https://www.npmjs.com/package/@keenmate/theme-designer) — it
adopts the host's colors, typography, and sizing automatically. There is no runtime dependency on Pure
Admin; the integration is opt-in via CSS variables.

## Built with BlissFramework

Follows the [BlissFramework component guidelines](https://blissframework.dev/) for structure and the
shared Keenmate interaction model.

## License

MIT — see [LICENSE](./LICENSE).
