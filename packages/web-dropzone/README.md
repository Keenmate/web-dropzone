# @keenmate/web-dropzone

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/keenmate/web-dropzone/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@keenmate/web-dropzone.svg)](https://www.npmjs.com/package/@keenmate/web-dropzone)

> A file-upload web component — drag and drop, previews, validation, an upload queue with progress / pause / cancel / retry, and decoupled picker / list / indicator elements. Form-associated, themeable, framework-agnostic.

## What is it

`@keenmate/web-dropzone` is a custom element (`<web-dropzone>`) that collects files by drag and drop or
the file dialog, validates them (type, size, count, total size, duplicates), shows them as a list,
detailed rows, an image grid, badges or a compact summary with a popover, and — given an
`uploadFileCallback` — uploads them through a worker pool with per-file progress, pause / resume,
cancel and retry. Inside a `<form>` it submits real `File` entries, like `<input type="file">`.

`<web-dropzone>` is also a **store**: four satellite elements bind to it with `for="<store-id>"` and
render the same queue wherever the layout needs it — `<web-dropzone-picker>` (selector),
`<web-dropzone-list>` (file list), `<web-dropzone-indicator>` (floating status chip + drawer) and
`<web-dropzone-progress>` (aggregate progress strip). Building your own renderer in React / Vue / Lit /
Svelte? Use the headless [`@keenmate/web-dropzone-core`](https://www.npmjs.com/package/@keenmate/web-dropzone-core)
instead — no DOM, no CSS.

## What's New in v1.0.0-rc03

Breaking — see [CHANGELOG.md](https://github.com/keenmate/web-dropzone/blob/main/CHANGELOG.md) for the migration tables.

- **Responsive rules** — per device class partial configs (page / `web-dropzone` tag / instance, map or callback) through core SPEC §6.7; instance attributes always win over page rules. See [Responsive rules](./docs/usage.md#responsive-rules).
- **Armed drop target** — opt-in `highlight-on-page-drag`: while files are dragged anywhere over the page, every opted-in dropzone / picker tints (`--dz-dropzone-bg-armed` → `--base-drop-target-bg`) and gets `armed` + `:state(armed)`; the card under the pointer keeps the active look. One shared page listener for all instances.
- **One loader for every KeenMate component** — the indicator chip's upload loader draws through the shared core loader (`renderLoadingCallback` on the store, else the page-wide `window.components.renderLoadingCallback`, else the `--base-loader-*` shape); per-row / summary loaders use the same tokens (`--dz-loader-*`) with `aria-busy` on the row. The uploading-row pulse stops under reduced motion; the loader only slows.
- **One cancel rule** — `cancelFile(id)` now returns a promise and gives a running upload handler its `AbortSignal` plus up to `cancel-timeout` ms (default 2000) to settle; the row shows "Cancelling…". Settles in time → `cancelled`; otherwise `cancel-timeout-behavior` (`error`, retryable — or `remove`). Late results are ignored and the concurrency slot is freed either way. `beforeFilesCancelCallback` can veto, `file-cancel` reports how it ended (`{ file, result, uploadedBytes, metadata }`), and `cancelAll()` + a **Cancel all** button cover the whole queue.
- **Row buttons split** — **⊘ Cancel** stops the upload and keeps the row (Retry available); **✕ Remove** always removes (a running upload is cancelled first). Both glyphs are configurable (`cancel-icon` / `remove-icon`).
- **`labels`** — every UI string in one input (property or JSON attribute, merged per key over English, `{name}` placeholders, live). Replaces `prompt-text`, `hint-text`, `drag-active-text`, `no-file-chosen-text`, `overlay-text`, `select-files-text`, `empty-message`, `summary-template` and the `STATUS_LABELS` / `ACTION_LABELS` exports.
- **Removal vs move** — removing `<web-dropzone>` from the page cancels its uploads and destroys the store (a DOM move doesn't); opt out with `keep-alive-when-removed`.
- **Suite-wide naming (v2)** — short boolean attributes (`sink-completed`, `keep-alive-when-removed`, `allow-uploaded-file-removal`), configKey-named properties (`el.isMultiple`, `el.isDisabled`, `el.shouldAutoUpload`, …), `render-mode` (was `mode`), `max-visible-file-count`, events `file-upload` / `file-reject` (`oldStatus` / `newStatus` in `file-status-change`), `beforeFilesCancelCallback`, `removeFiles(ids)`, the `rejected` add-veto code.
- **Core lifecycle** — `ready` fires once after the first build (+ `ready` attribute, `:state(ready)`, `whenReady()`); `defer` + `release()` hold the first build; `destroy()` is final. New `readonly` (selection locked, still submitted).
- **Every UI string in `labels`** — empty text, summary, popover, limits line, progress strip, indicator, validation messages; satellites take their own `labels` on top of the store's.
- **Fixes** — cancel during the auto-retry backoff, `destroy()` stopping the queue, no events after teardown / removal, mode-flip rebuild reporting dropped files, `multiple="false"` replace now cancels + reports the replaced file.

## What's New in v1.0.0-rc02

- **Theming — `--dz-*` custom properties now cascade into the internal renderers** — In the default (bulk) render mode, `<web-dropzone>` mounts its list/picker/progress as satellite custom elements, each with its own shadow root that re-injects `variables.css`. That stylesheet declared every token in a `:host` block, and a `:host` declaration outranks a value inherited from an outer ancestor — so a `--dz-preview-grid-gap` (or any token) set on `<web-dropzone>` silently never reached the grid inside the satellite. The `:host` block is now split: host-layout properties stay unconditional, but the token defaults move to `:host(:not([managed]))`, and the auto-mounted satellites are tagged `managed` so they inherit straight from the store host. Standalone satellites keep self-theming. Net effect: setting `--dz-*` on `<web-dropzone>` works for grid, badges, and detailed as the docs always implied.
- **Grid — natural (justified) gallery layout** — A new `grid-layout` attribute on `list-appearance="grid"`. `uniform` (default) is the responsive equal-size tile grid; `natural` renders a justified gallery where every row shares one height (`--dz-preview-row-height`) and each tile keeps its own image's aspect ratio, so mixed portrait/landscape photos sit together with nothing cropped or stretched. It switches the container from CSS grid to flex-wrap and derives each tile's width from the image; the companion `--dz-preview-item-object-fit` token lets the uniform layout choose crop (`cover`) vs fit (`contain`).
- **Grid — big status overlay on finished tiles** — The tiny corner check/error glyph is easy to miss on a thumbnail. New `grid-status="overlay"` washes a completed tile with a light veil (`--dz-preview-status-overlay-bg`) and floats a big centred glyph (`--dz-preview-status-overlay-icon-size`) — green check on success, red on error — like a photo-upload confirmation. Only terminal states trigger it; uploading keeps its corner spinner, and the veil is click-through so hover controls still work.
- **Composition — Plyr-style `controls` / `item-controls` allowlists** — Two comma-separated attributes that pick which surfaces and row parts render. `controls` chooses top-level surfaces (picker, list, overall-progress); `item-controls` chooses per-row parts (icon, name, size, type, progress, status, action, remove). Absent means render everything. This replaces a set of narrower single-purpose flags with a composable primitive — count- or state-based progress rules become external recipes over these tokens plus the `change` event, rather than dedicated attributes.
- **Badges & detailed — image thumbnails via `show-thumbnails`** — `show-thumbnails` now works for the badges and detailed list appearances, not just grid: the icon slot shows the real image preview instead of a file-type glyph. The preview URL arrives asynchronously (FileReader → data URL), so the row repaints on a `file-update` store event once the thumbnail is ready.
- **Internals — vendored logger, no more `loglevel`** — `@keenmate/web-components-core` bumped to `^1.0.0-rc04`, which vendors its logging engine. This drops the transitive `loglevel` dependency and the CJS/ESM interop crash it caused under Node's native ESM loader, which had been breaking the unit-test run.

See [CHANGELOG.md](https://github.com/keenmate/web-dropzone/blob/main/CHANGELOG.md) for the full list.

## Demos & docs

- 📘 [Usage / API reference](./docs/usage.md) — every attribute, property, method, event, callback, and the satellites.
- 🎨 [Theming](./docs/theming.md) — `--dz-*` / `--base-*` variables, dark mode, `@layer` cascade, shadow parts.
- 📚 [Examples / cookbook](./docs/examples.md) — uploads, decoupled satellites, forms, React, Vue, theming.
- ♿ [Accessibility](./docs/accessibility.md) — keyboard, ARIA, focus.
- 🏗️ [Architecture](https://github.com/keenmate/web-dropzone/blob/main/ARCHITECTURE.md) — store + satellites, the core / renderer split.
- 📜 [Release history](https://github.com/keenmate/web-dropzone/blob/main/CHANGELOG.md)
- 🧪 Live example pages: clone the repository and run `npm run dev` (`examples-*.html`).

## Install

```bash
npm install @keenmate/web-dropzone
```

## Quick start

```html
<script type="module">
  import '@keenmate/web-dropzone';           // registers <web-dropzone> and the four satellites

  const dropzone = document.querySelector('web-dropzone');
  dropzone.uploadFileCallback = async ({ file, signal, setProgress }) => {
    await fetch('/api/upload', { method: 'POST', body: file, signal });
    setProgress(100);
  };
  dropzone.addEventListener('change', (e) => console.log('Files:', e.detail.files));
</script>

<web-dropzone accept="image/*,.pdf" max-file-size="5MB" max-file-count="10"
              display-mode="detailed" name="files"></web-dropzone>
```

The element renders a drop card and a detailed file list, validates what's dropped (a refused file
fires `file-reject`), and uploads each accepted file through `uploadFileCallback` with a progress bar,
cancel and retry. Without the callback it is a plain form field. See [usage.md](./docs/usage.md) for
the full API.

## Editor IntelliSense

The package ships a [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest)
(`custom-elements.json`, the `customElements` field) generated from the components' input tables on
every build, plus editor data for the five tags and the `--dz-*` variables:

- **JetBrains** (WebStorm / IntelliJ) — discovers `web-types.json` through the `web-types` field; no setup.
- **VS Code** — point the workspace at the data files once (`.vscode/settings.json`):

  ```json
  {
    "html.customData": ["./node_modules/@keenmate/web-dropzone/vscode.html-custom-data.json"],
    "css.customData": ["./node_modules/@keenmate/web-dropzone/vscode.css-custom-data.json"]
  }
  ```

## Browser support

Modern evergreen browsers — the component uses custom elements, Shadow DOM, `ElementInternals` (form
association), CSS cascade layers and the relative-colour / `color-mix()` fallbacks of
`@keenmate/base-css-variables` 2.x:

- Chrome / Edge 119+
- Firefox 128+
- Safari 18+

No polyfills are shipped.

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
color-scheme, and accessibility. The repository's `VALIDATION-NOTES.md` documents the accepted
deviations.

## License

MIT — see [LICENSE](./LICENSE).
