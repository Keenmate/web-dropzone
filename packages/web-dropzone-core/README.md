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

- **Settings one way (BREAKING)** — `new DropzoneEngine(target, options)` → `engine.setOptions(partial)` (was `updateConfig`) → `engine.getOptions()` (was `getConfig`, also on `DropzoneController`); the same shape as every Keenmate public engine.
- **`DropzoneEngine` + `DropzoneController` — one interaction model** — The headless class is `DropzoneEngine` (was `DropzoneCore`), and its public surface is the `DropzoneController` facade (`engine.controller`, also `el.controller` on `<web-dropzone>`, was `DropzoneStoreAPI`), built once and delegating to the current engine so a captured controller survives rebuilds. Every callback takes one `ctx` and every ctx / event detail carries `controller` and `element`, non-enumerable, so `JSON.stringify(detail)` sees only the data. Standalone, events are dispatched on the host element, bubbling and not composed (web-components-core SPEC §12.5).
- **One cancel rule** — `cancelFile(id)` returns a promise: a running handler gets its `AbortSignal` and up to `cancelTimeout` ms (default 2000) to settle while the file is `cancelling`; it settles in time → `cancelled`, otherwise `cancelTimeoutBehavior` (`error`, retryable, or `remove`). Late results are ignored and the concurrency slot is freed either way. `cancelAll()`, `beforeFilesCancelCallback` and the `file-cancel` event (`{ file, result, uploadedBytes, metadata }`) complete it.
- **`labels` — every UI string in one input** — `DEFAULT_LABELS`, `resolveLabel()` and `createLabelFn()` give renderers the same per-key-merged, placeholder-filled strings as the element (status words, row-button names, validation messages), replacing the `STATUS_LABELS` / `ACTION_LABELS` exports.
- **`removeFiles(ids)` and `hasActiveUploads`** — `removeFiles` is the pair of `addFiles` (the remove gate runs once per batch); `hasActiveUploads` is `true` while any file is pending, uploading, paused or cancelling — the signal an app needs before leaving the page.

## What's New in v1.0.0-rc02

- **`@keenmate/web-components-core` ^1.0.0-rc04 — vendored logger** — Drops the transitive `loglevel` dependency and the CJS / ESM interop crash it caused under Node's native ESM loader.

See the [CHANGELOG](https://github.com/keenmate/web-dropzone/blob/main/CHANGELOG.md) for the full history.

## Demos & docs

- 🧩 [Build your own UI](#build-your-own-ui) — what the engine does, what you draw, a minimal example.
- 📘 [Usage / API reference](./docs/usage.md) — `DropzoneEngine`, `DropzoneController`, events, callbacks, helpers.
- 📚 [Examples](./docs/examples.md) — a vanilla renderer, a React hook, a status line.
- 🎨 [Theming](./docs/theming.md) — what a renderer gets (icons, status vocabulary, labels).
- ♿ [Accessibility](./docs/accessibility.md) — what a renderer must cover.
- 🏗️ [Architecture](https://github.com/keenmate/web-dropzone/blob/main/ARCHITECTURE.md) — the core / renderer split.

## Install

```bash
npm install @keenmate/web-dropzone-core
```

## Build your own UI

`DropzoneEngine` is the seam for a UI of your own — a React / Vue / Svelte / Lit renderer, or plain DOM.
`<web-dropzone>` is this same engine with the official renderer on top.

**What the engine does** — keeps the file list (`FileState[]`), validates added files (type, size, count,
total size, duplicates, `validateCallback`, the `before*Callback` gates), runs the uploads through a
worker pool (`uploadFileCallback`: progress, pause / resume, cancel with the `cancelTimeout` rule, retry
with backoff), resolves every UI string (`engine.label(key, vars)`: your `labels` → the page dictionary →
your `translateCallback` → the page-wide one → English) and reports every change as a DOM event on the
host element you give it (bubbling, not composed; `controller` + `element` on every detail).

**What you draw** — everything visible: the file input / drop target (the engine has none — call
`engine.addFiles(files)` from a `change` or `drop` handler), the file rows (render from `files-change`,
coalesced to one event per frame), the buttons (call the controller — `removeFile`, `pauseFile`,
`retryFile`, … — or `engine.activateAction({ action, fileId, source, triggerElement, sourceEvent })` for
the same `beforeActionCallback` gate + `action` event the element's buttons get), progress, error
messages (`file-reject`), icons and loaders. Icons: the exported Lucide sets (`STATUS_ICONS`,
`ACTION_ICONS`, `FILE_TYPE_ICONS`, `getFileIcon(file, config)`), or web-components-core `renderIcon(name, {
host, renderIconCallback: config.renderIconCallback })`; a loader: core `renderLoader()`.

### A minimal example

```js
import { DropzoneEngine, escapeHtml, fileStatusLabel, formatFileSize } from '@keenmate/web-dropzone-core';

const host = document.getElementById('uploader');   // <div id="uploader"><input type="file" multiple><ul></ul></div>
const engine = new DropzoneEngine(host, {
  maxFileCount: 5,
  labels: { 'errors.maxFileCount': 'At most {count} files' },
  uploadFileCallback: async ({ file, signal, setProgress }) => {
    await fetch('/api/upload', { method: 'POST', body: file, signal });
    setProgress(100);
  },
});

const input = host.querySelector('input');
input.addEventListener('change', () => engine.addFiles(input.files));
host.addEventListener('files-change', ({ detail }) => {
  host.querySelector('ul').innerHTML = detail.files
    .map((f) => `<li>${escapeHtml(f.name)} · ${formatFileSize(f.size, engine.getOptions().locale)} · ${escapeHtml(fileStatusLabel(engine.label, f))}</li>`)
    .join('');
});
host.addEventListener('file-reject', ({ detail }) => alert(detail.rejectedFiles.map((r) => r.validation.error).join(', ')));
```

`engine.setOptions(partial)` changes options later (merged into the current ones; `engine.getOptions()` reads them back, read-only); `engine.destroy()` aborts running uploads and
silences it. A vanilla renderer with remove buttons and a React hook are in
[examples.md](./docs/examples.md); the full API in [usage.md](./docs/usage.md).

### Settings shared with the element

Every option takes the same name and the same default as the matching `<web-dropzone>` property — the
defaults live once, in `DEFAULT_CONFIG` (the element's input rows read them):

| `<web-dropzone>` hook / setting | Engine option | Applies to the engine |
|---|---|---|
| `labels` | `labels` | yes — `engine.label()`, validation messages (default: the built-in English, `DEFAULT_LABELS`) |
| `translateCallback` | `translateCallback` | yes — asked before the page-wide `window.components.locale.translateCallback` |
| `renderIconCallback` | `renderIconCallback` | carried — the engine draws no icon; pass it to core `renderIcon()` when you draw one |
| `fileIcons` / `getFileIconCallback` | same | carried — `getFileIcon(file, engine.getOptions(), engine.contextBase)` applies them |
| validation, upload, gate options (`accept`, `maxFileSize`, …, `uploadFileCallback`, `before*Callback`) | same | yes |
| `renderLoadingCallback` | — | no — the engine draws no loader (core `renderLoader()` reads the page-wide hook for yours) |
| `locale` | `locale` | yes — the `{count}` numbers in `engine.label()`, the sizes in validation messages; pass `engine.getOptions().locale` to `formatFileSize(bytes, locale)` when you draw a size (default: unset — `DEFAULT_CONFIG.locale`, the page-wide `window.components.locale`, else the browser) |
| `customStyles` / `getCustomStylesCallback`, `motion`, `responsive`, `defer` | — | no — the element's shadow root / core element features |
| display options (`displayMode`, `listAppearance`, `icon`, `storageKey`, …) | same | carried — only a renderer reads them |

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
