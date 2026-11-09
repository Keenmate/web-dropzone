# Usage — `@keenmate/web-dropzone-core`

The headless store behind [`@keenmate/web-dropzone`](https://www.npmjs.com/package/@keenmate/web-dropzone):
file state, validation, the upload pipeline and the event substrate. No rendering, no CSS, no custom
elements. Worked examples are in [examples.md](./examples.md); what a renderer owns for theming and
accessibility is in [theming.md](./theming.md) and [accessibility.md](./accessibility.md).

## `DropzoneEngine`

```ts
import { DropzoneEngine } from '@keenmate/web-dropzone-core';

const engine = new DropzoneEngine(hostElement, config);
```

- `hostElement` — the element events are dispatched on (and `element` on every ctx / event detail).
- `config` — a partial `DropzoneConfig`, merged over `DEFAULT_CONFIG`. `engine.updateConfig(partial)`
  merges more later.

Standalone, the engine has no input and no drop target of its own — your renderer feeds it
(`engine.addFiles(input.files)` from a file input or a `drop` handler) and renders from its events.

### Config

`DropzoneConfig` (exported type) holds every option of the rendered element under its property name —
the validation limits (`accept`, `maxFileSize`, `minFileSize`, `maxTotalSize`, `maxFileCount`,
`minFileCount`, `dedupeMode`, `isMultiple`), the upload pipeline (`uploadFileCallback`, `concurrency`,
`shouldAutoUpload`, `retryPolicy`, `cancelTimeout`, `cancelTimeoutBehavior`, `progressMode`,
`progressThrottle`), the gates (`validateCallback`, `beforeFilesAddCallback`,
`beforeFilesRemoveCallback`, `beforeFilesCancelCallback`), `labels`, and persistence (`storageKey`,
`persistStateCallback`, `loadStateCallback`). Display options are carried too but only a renderer reads
them. The meaning of each option is documented once, on the element:
[`@keenmate/web-dropzone` usage → Attributes](https://github.com/keenmate/web-dropzone/blob/main/packages/web-dropzone/docs/usage.md#attributes).

### Methods

| Method | What |
|---|---|
| `addFiles(files, opts?)` | Validate and add a `FileList` / `File[]` (`beforeFilesAddCallback` applies); refused files fire `file-reject` |
| `removeFile(id, opts?)` / `removeFiles(ids, opts?)` / `clear(opts?)` | Remove (a running upload is cancelled first); `{ confirm: true }` asks `beforeFilesRemoveCallback` |
| `getFiles()` / `getFileById(id)` / `getConfig()` / `getOverallProgress()` | Reads (`getFiles()` returns a copy) |
| `hasActiveUploads` (getter) | `true` while any file is pending / uploading / paused / cancelling |
| `uploadAll()` / `uploadFile(id)` | Drain the queue / upload one file now (with `uploadFileCallback`) |
| `pauseFile(id)` / `resumeFile(id)` / `pauseAll()` / `resumeAll()` | Pause / resume, progress kept |
| `cancelFile(id)` / `cancelAll()` | Cancel (the handler's `signal` aborts; waits up to `cancelTimeout`); resolve when finished |
| `retryFile(id)` / `retryAll()` | Re-queue failed / cancelled files |
| `updateFileProgress(id, progress)` / `setFileStatus(id, status, error?)` | For apps that drive uploads themselves |
| `updateConfig(partial)` | Merge config changes |
| `destroy()` | Final teardown — aborts running uploads; the engine is silent afterwards |
| `controller` (getter) | The `DropzoneController` facade (below) |

### `DropzoneController`

The public facade: `el.controller` on the rendered element, `engine.controller` standalone, and the
`controller` on every callback ctx / event detail. It carries the reads, the mutators and the upload
controls above (`addFiles`, `removeFile(s)`, `clear`, `getFiles`, `getFileById`, `getConfig`,
`getOverallProgress`, `updateFileProgress`, `setFileStatus`, `uploadAll`, `uploadFile`, `pause*` /
`resume*` / `cancel*` / `retry*`) plus `isReady` and `hasActiveUploads`. Every call delegates to the
**current** engine, so a controller captured in a closure keeps working across rebuilds; before the
first build reads return empty defaults and mutators are no-ops. Renderers and custom satellites should
depend on this interface, not the engine class. `createDropzoneController(getTarget)` builds one for a
host of your own.

## Events

Standalone, the engine dispatches on `hostElement` — bubbling, **not composed**. Every detail carries
`controller` and `element`, non-enumerable (`JSON.stringify` sees only the data). Hosted by
`<web-dropzone>`, the engine notifies and the element emits the same events (with camelCase `on*` twins).

| Event | Detail |
|---|---|
| `file-add` / `file-remove` | `{ file }` — one per file |
| `change` | `{ files }` — the selection changed |
| `files-change` | `{ changedIds, files }` — coalesced, at most once per animation frame (the one to render from) |
| `file-reject` | `{ rejectedFiles: [{ file, validation: { valid, error, code } }] }` |
| `file-progress` | `{ id, progress, status, file }` |
| `file-status-change` | `{ id, oldStatus, newStatus, file }` |
| `file-update` | `{ file }` — another field changed (preview generated, upload result merged) |
| `file-retry` / `file-upload` / `file-delete` | `{ file }` |
| `file-cancel` | `{ file, result, uploadedBytes, metadata }` — `result`: `cancelled` / `timeout-error` / `timeout-remove` |

`DropzoneEventMap` types them for `addEventListener`.

## Callbacks

Every callback takes **one** `ctx` that also carries `controller` / `element`. `before*Callback`s may
be async; returning `false` cancels.

| Callback | `ctx` | Returns |
|---|---|---|
| `validateCallback` | `{ file, existingFiles }` | `ValidationResult` (sync) |
| `beforeFilesAddCallback` | `{ files, existingFiles }` | `false` vetoes (→ `file-reject`, code `rejected`); a `File[]` replaces the batch |
| `beforeFilesRemoveCallback` | `{ files, allFiles }` | `false` vetoes |
| `beforeFilesCancelCallback` | `{ files, allFiles }` | `false` vetoes |
| `uploadFileCallback` | `{ file, signal, setProgress, startBytes, startPercent, metadata, setMetadata, uploadMetadata }` | `Promise<void \| FileUploadResult>` |
| `persistStateCallback` / `loadStateCallback` | `{ key, state }` / `{ key }` | — / `DropzoneState \| null` |

## Helpers and types

- **File helpers** — `formatFileSize`, `getFileTypeCategory`, `getFileIcon`, `isImageFile`,
  `createImagePreview`, `generateFileId`, `validateFile`, `isFileTypeAccepted`, `dedupeKeyFor`,
  `createFileState`, `DEFAULT_CONFIG`.
- **Icons** — `STATUS_ICONS`, `ACTION_ICONS`, `actionForStatus()`, `CANCEL_ICON`, `FILE_TYPE_ICONS`,
  `UI_ICONS`, `FILE_ICONS` (Lucide SVG strings).
- **Labels** — `DEFAULT_LABELS`, `resolveLabel`, `createLabelFn`, `countLabel`, `statusLabel`,
  `fileStatusLabel`, `isLabelsValue` — the same per-key-merged UI strings the element uses.
- **Status surface** — `StatusSurfaceArgs`, `StatusSurfaceCallback`, `StatusSurfaceResult`,
  `StatusAggregate`: the contract of indicator-style UIs (focal file + aggregate counts + overall percent).
- **Types** — every callback ctx (`ValidateContext`, `BeforeFilesAddContext`, `FileUploadContext`, …),
  every event detail (`FileAddEventDetail`, `FileProgressEventDetail`, …), and the domain types
  (`DropzoneConfig`, `FileState`, `FileStatus`, `FileUploadHandler`, `FileUploadResult`,
  `OverallProgress`, `ValidationResult`, `RejectedFile`, `RetryPolicy`, …).
- **Logging** — the `DROPZONE` bundle on web-components-core logging (`logging`, plus `initLogger`,
  `fileLogger`, `uiLogger`, `interactionLogger`) and its controls: `enableLogging`, `disableLogging`,
  `resetLogging`, `setLogLevel`, `setCategoryLevel` (`'UI'` or `'DROPZONE:UI'`), `LOGGING_CATEGORIES`
  (the prefixed names, `'DROPZONE:INIT'` …). Like every KeenMate bundle it prints warnings and errors by
  default and follows the page-wide `window.components.logging` — nothing is silenced at load;
  `resetLogging()` returns to the page level. (`@keenmate/web-dropzone` attaches the same bundle to
  `window.components['web-dropzone'].logging`, whose `getCategories()` lists the bare names.)
- **`escapeHtml(value)`** — web-components-core's, re-exported: takes any value (`null` / `undefined`
  → `''`, anything else `String()`-ed).

## `FileState`

```ts
interface FileState {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'paused' | 'cancelling' | 'cancelled' | 'complete' | 'error';
  progress: number;                    // 0–100
  error?: string;                      // 'cancel-timeout' after a timed-out cancel
  previewUrl?: string;                 // data URL for image previews
  downloadUrl?: string;                // from the upload result
  metadata?: Record<string, unknown>;  // what the upload handler stashed (ctx.setMetadata)
  uploadFileCallback?: FileUploadHandler;        // per-file handler (a picker's routing)
  uploadMetadata?: Record<string, unknown>;      // per-file metadata (ctx.uploadMetadata)
}
```
