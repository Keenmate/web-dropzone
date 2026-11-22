# @keenmate/web-dropzone

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/keenmate/web-dropzone/blob/prod/LICENSE)
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

Upgrade guide: the [1.0.0-rc03 release notes](release-notes/1.0.0-rc03.md); full list: the
[CHANGELOG 1.0.0-rc03 section](https://github.com/KeenMate/web-dropzone/blob/prod/CHANGELOG.md).

- **Interaction model — `el.controller`, present-tense events, one `ctx` (BREAKING)** — `el.getStore()` is replaced by `el.controller`, a frozen `DropzoneController` facade built once that delegates to the live store, so a captured controller survives a rebuild (satellites get the bound store's `controller`). Events are present tense and not composed (`file-added` → `file-add`, `files-rejected` → `file-reject`, `file-uploaded` → `file-upload`, `store-ready` → `ready`, …), each with an `on*` twin property, and `file-status-change` reports `oldStatus` / `newStatus`. Every callback takes one `ctx` (`uploadFileCallback({ file, signal, setProgress, … })`, `beforeFilesAddCallback({ files, existingFiles })`), and every ctx / detail carries `controller` and `element` non-enumerable, so `JSON.stringify(detail)` sees only the data. No aliases — the release notes have the full rename tables.
- **Uploads — one cancel rule, Cancel vs Remove** — `cancelFile(id)` returns a promise: a running handler gets its `AbortSignal` and up to `cancel-timeout` ms (default 2000) to settle while the file is `cancelling`; in time → `cancelled`, otherwise `cancel-timeout-behavior` (`error`, retryable, or `remove`). Late results are ignored and the concurrency slot is freed either way. Rows get a separate ⊘ Cancel (the row stays, with Retry) and ✕ Remove (a running upload is cancelled first); `cancelAll()`, a Cancel all button, `beforeFilesCancelCallback` and the `file-cancel` event (`{ file, result, uploadedBytes, metadata }`) complete it. `removeFiles(ids)` pairs `addFiles`, and `hasActiveUploads` tells an app whether leaving the page would drop work.
- **Lifecycle — ready once, final `destroy()`, removal vs move** — `<web-dropzone>` and the four satellites are core `BlissElement`s: `ready` fires once after the first build (+ `ready` attribute, `:state(ready)`, `whenReady()`), `defer` + `release()` hold the first build and `destroy()` is final. A DOM move now keeps files, uploads and an open popover (rc02 rebuilt the store and lost them); removing the element cancels its uploads one frame later and destroys the store, unless `keep-alive-when-removed` is set. New `readonly` locks the selection while the files stay visible and submitted, and `disabled` now turns off every control, row buttons included — `disabled="false"` disables, like a native input.
- **Forms — `required` and count rules through native validity (BREAKING)** — new `required` makes an empty dropzone `validity.valueMissing` ("Add a file.", `errors.required`), with `aria-required` and `:state(required)` on the host. `min-file-count` is now `rangeUnderflow` and skips an empty selection (it was `valueMissing`, also when empty — use `required`), and more files than `max-file-count` (the cap lowered after the add) is `rangeOverflow`. Read-only / disabled are never invalid.
- **Labels and locale — every UI string in `labels`** — the `prompt-text`, `hint-text`, `select-files-text`, `empty-message`, `summary-template`, … attributes are replaced by one `labels` input with flat `<elementType>.<name>` keys (`labels.prompt`, `buttons.selectFiles`, `messages.noData`, `errors.maxFileSize`), merged per key over English. Page-wide translations go into one flat dictionary (`window.components.locale.labels['web-dropzone.buttons.selectFiles']`) or a `translateCallback`, the element's own asked first. A `locale` input formats file sizes, progress percents and `{ctx.count}` through core `formatNumber` (`1,5 MB` on a Czech page); satellites follow their store.
- **Labels read the text's context — `{ctx.count}`, `{ctx.name}` (BREAKING)** — label templates read the spot's context with a dotted path (`Files: {ctx.count}, {ctx.size}`, `Remove {ctx.name}`; typed `*LabelContext`s), and a `translateCallback` gets it as `params.ctx`, with `ctx.count` = the number the noun agrees with, so one i18next bridge pluralizes every key. The `…One` singular keys are gone; English defaults put no plural noun after a number (`Files added: 3`). `{count}` → `{ctx.count}`, `{status}` → `{ctx.statusName}`, no aliases.
- **Icons and render callbacks — the core rules** — `icon`, `overlay-icon` and the new `cancel-icon` / `remove-icon` go through core `renderIcon`: markup raw, a built-in name (`delete`) as a glyph masked from `--base-icon-delete`, then the element's `renderIconCallback(name, ctx)` / the page-wide one, a class list as an icon-font `<i>`, anything else as text — a plain word is no longer inserted as HTML. `fileIcons` / `getFileIconCallback` override the file-type icons the same way, and icons repaint when the page hook changes. Every `render*Callback` result reads like core `renderSlot`: string = HTML, Node = mounted, `null` = built-in, `false` = hidden (`renderFileItemCallback` returning `null` now draws the built-in row).
- **Page integration — overlays, armed drop target, actions, announcements** — the compact popover and the indicator drawer join core's overlay tree (Escape, outside click, one overlay at a time) and become full-screen sheets on a phone; the drawer gains `drawer-mode` (`non-modal` default, or `modal`). Opt-in `highlight-on-page-drag` arms every dropzone while files are dragged over the page (`armed`, `:state(armed)`). Built-in buttons run through core `/actions` (`beforeActionCallback`, `action` event), and adds, rejects, finished batches and removals are announced to screen readers.
- **Styling — flat BEM, custom CSS, base 2.0 (BREAKING)** — classes are flat (`.dz__file-item__name` → `.dz__file-item-name`, 127 in all), the loader is `.dz__loader` with `--dz-loader-*` tokens, `rtl.css` is gone (logical properties follow the inherited direction) and the drag overlay is a core layer styled by `--dz-overlay-*` or `custom-styles`. Custom CSS comes through `custom-styles` / `getCustomStylesCallback` plus a page layer per tag, and reaches mounted satellites and the overlay. The fallbacks read the `@keenmate/base-css-variables` 2.0 names (`--base-primary-*`), dark mode follows the page signal instead of the OS, and the icons are Lucide SVG.
- **`@keenmate/web-dropzone-core` — `DropzoneEngine` (BREAKING)** — the headless class is `DropzoneEngine` (was `DropzoneCore`) with one settings shape: `new DropzoneEngine(target, options)` → `setOptions(partial)` (was `updateConfig`) → `getOptions()` (was `getConfig`), typed `DropzoneEngineOptions` (was `DropzoneConfig`, keys renamed like the element properties). `STATUS_LABELS` / `ACTION_LABELS` give way to `DEFAULT_LABELS` + `createLabelFn()`, and `createDropzoneSpinner()` / `dispatchComposedEvent` are removed.

## What's New in v1.0.0-rc02

- **Theming — `--dz-*` custom properties now cascade into the internal renderers** — In the default (bulk) render mode, `<web-dropzone>` mounts its list/picker/progress as satellite custom elements, each with its own shadow root that re-injects `variables.css`. That stylesheet declared every token in a `:host` block, and a `:host` declaration outranks a value inherited from an outer ancestor — so a `--dz-preview-grid-gap` (or any token) set on `<web-dropzone>` silently never reached the grid inside the satellite. The `:host` block is now split: host-layout properties stay unconditional, but the token defaults move to `:host(:not([managed]))`, and the auto-mounted satellites are tagged `managed` so they inherit straight from the store host. Standalone satellites keep self-theming. Net effect: setting `--dz-*` on `<web-dropzone>` works for grid, badges, and detailed as the docs always implied.
- **Grid — natural (justified) gallery layout** — A new `grid-layout` attribute on `list-appearance="grid"`. `uniform` (default) is the responsive equal-size tile grid; `natural` renders a justified gallery where every row shares one height (`--dz-preview-row-height`) and each tile keeps its own image's aspect ratio, so mixed portrait/landscape photos sit together with nothing cropped or stretched. It switches the container from CSS grid to flex-wrap and derives each tile's width from the image; the companion `--dz-preview-item-object-fit` token lets the uniform layout choose crop (`cover`) vs fit (`contain`).
- **Grid — big status overlay on finished tiles** — The tiny corner check/error glyph is easy to miss on a thumbnail. New `grid-status="overlay"` washes a completed tile with a light veil (`--dz-preview-status-overlay-bg`) and floats a big centred glyph (`--dz-preview-status-overlay-icon-size`) — green check on success, red on error — like a photo-upload confirmation. Only terminal states trigger it; uploading keeps its corner spinner, and the veil is click-through so hover controls still work.
- **Composition — Plyr-style `controls` / `item-controls` allowlists** — Two comma-separated attributes that pick which surfaces and row parts render. `controls` chooses top-level surfaces (picker, list, overall-progress); `item-controls` chooses per-row parts (icon, name, size, type, progress, status, action, remove). Absent means render everything. This replaces a set of narrower single-purpose flags with a composable primitive — count- or state-based progress rules become external recipes over these tokens plus the `change` event, rather than dedicated attributes.
- **Badges & detailed — image thumbnails via `show-thumbnails`** — `show-thumbnails` now works for the badges and detailed list appearances, not just grid: the icon slot shows the real image preview instead of a file-type glyph. The preview URL arrives asynchronously (FileReader → data URL), so the row repaints on a `file-update` store event once the thumbnail is ready.
- **Internals — vendored logger, no more `loglevel`** — `@keenmate/web-components-core` bumped to `^1.0.0-rc04`, which vendors its logging engine. This drops the transitive `loglevel` dependency and the CJS/ESM interop crash it caused under Node's native ESM loader, which had been breaking the unit-test run.

Earlier releases: [CHANGELOG](https://github.com/KeenMate/web-dropzone/blob/prod/CHANGELOG.md).

## Demos & docs

- 📘 [Usage / API reference](./docs/usage.md) — every attribute, property, method, event, callback, and the satellites.
- 🎨 [Theming](./docs/theming.md) — `--dz-*` / `--base-*` variables, dark mode, `@layer` cascade, shadow parts.
- 📚 [Examples / cookbook](./docs/examples.md) — uploads, decoupled satellites, forms, React, Vue, theming.
- ♿ [Accessibility](./docs/accessibility.md) — keyboard, ARIA, focus.
- 🏗️ [Architecture](https://github.com/keenmate/web-dropzone/blob/prod/ARCHITECTURE.md) — store + satellites, the core / renderer split.
- 📜 [Release history](https://github.com/keenmate/web-dropzone/blob/prod/CHANGELOG.md)
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
