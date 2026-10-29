# @keenmate/web-dropzone-core

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/keenmate/web-dropzone/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@keenmate/web-dropzone-core.svg)](https://www.npmjs.com/package/@keenmate/web-dropzone-core)

Headless store for the [`@keenmate/web-dropzone`](https://www.npmjs.com/package/@keenmate/web-dropzone) family — file state, validation, the upload pipeline, and the event substrate. **No DOM rendering. No CSS. No custom elements.**

This package is what you install when you want to build your own React / Vue / Lit / Svelte renderer on top of the same battle-tested file-handling primitives that back the official web components, without paying the cost of the renderer or Floating UI.

```bash
npm install @keenmate/web-dropzone-core
```

## When to use this package

| You want to… | Install |
|---|---|
| Drop `<web-dropzone>` (or its satellites) into a page | `@keenmate/web-dropzone` |
| Build a custom renderer in your framework of choice | `@keenmate/web-dropzone-core` |

The renderer package already depends on this one — installing both is unnecessary unless you're explicitly composing your own renderer.

## What's exported

- **`DropzoneEngine`** — the store class. Holds `FileState[]`, runs validation, drives the upload worker pool, reports events. Standalone, `engine.controller` is its public facade.
- **`DropzoneController`** + **`createDropzoneController(getTarget)`** — the public facade (`<web-dropzone>`'s `el.controller`, and the `controller` on every callback ctx / event detail). Satellites and BYO renderers should depend on this, not the concrete class.
- **Interaction-model types** — `DropzoneContext` and every callback ctx (`ValidateContext`, `BeforeFilesAddContext`, `BeforeFilesRemoveContext`, `FileIconContext`, `FileUploadContext`, `FileItemRenderContext`, …), every event detail (`FileAddEventDetail`, `FileProgressEventDetail`, `FileStatusChangeEventDetail`, …) and `DropzoneEventMap`.
- **Domain types** — `DropzoneConfig`, `FileState`, `FileStatus`, `FileUploadHandler`, `FileUploadResult`, `OverallProgress`, `ValidationResult`, `RejectedFile`, …
- **Pure helpers** — `formatFileSize`, `getFileTypeCategory`, `getFileIcon`, `isImageFile`, `createImagePreview`, `validateFile`, `dedupeKeyFor`, `createFileState`.
- **Status-surface contract** — `StatusSurfaceArgs`, `StatusSurfaceCallback`, `StatusAggregate` for indicator-style UIs.
- **Icons** — `STATUS_ICONS`, `ACTION_ICONS`, `actionForStatus()`.

## Interaction model

Every callback takes **one** `ctx`; every ctx and event detail carries `controller` and `element` (non-enumerable — `JSON.stringify` sees only the data). `before*Callback`s may be async; `false` cancels.

```ts
const engine = new DropzoneEngine(host, {
  beforeFilesAddCallback: async ({ files }) => (files.length > 5 ? false : undefined),
  uploadFileCallback: async ({ file, signal, setProgress, startBytes, setMetadata }) => { /* … */ },
});
host.addEventListener('file-add', (e) => console.log(e.detail.file, e.detail.controller.getFiles().length));
```

Hosted by `<web-dropzone>`, the engine *notifies* and the element *emits* (with the camelCase `on*` twins). Standalone, the engine dispatches the same events on its `element` — bubbling, **not composed**:

- `file-add` `{ file }`, `file-remove` `{ file }`
- `change` `{ files }`, `files-change` `{ changedIds, files }` (rAF-coalesced)
- `file-reject` `{ rejectedFiles }`
- `file-progress` `{ id, progress, status, file }`
- `file-status-change` `{ id, oldStatus, newStatus, file }`
- `file-update` `{ file }` — a field other than progress / status changed (`previewUrl` generated, upload result merged)
- `file-retry` `{ file }`, `file-upload` `{ file }`, `file-delete` `{ file }`

`<web-dropzone>` adds `overlay-enter` / `overlay-leave` `{ overlayElement }` and `ready`. See [`ARCHITECTURE.md`](https://github.com/keenmate/web-dropzone/blob/main/ARCHITECTURE.md) for the topology this package fits into.

## Versioning

Pre-1.x in spirit — the package is published at `1.0.0` to mark the core/renderer split as a milestone, but breaking changes are still expected until the wider API stabilises. Pin to a major.

## License

MIT © [Keenmate](https://github.com/keenmate)
