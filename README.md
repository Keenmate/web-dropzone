# Web Dropzone Component

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@keenmate/web-dropzone.svg)](https://www.npmjs.com/package/@keenmate/web-dropzone)

A lightweight, accessible file upload web component with drag-drop support, file previews, validation, and multiple display modes.

## What's New in v1.0.0-rc03 (unreleased)

Breaking — see [CHANGELOG.md](CHANGELOG.md) for the migration tables.

- **One loader for every KeenMate component** — the indicator chip's upload loader draws through the shared core loader (`renderLoadingCallback` on the store, else the page-wide `window.components.renderLoaderCallback`, else the `--base-loader-*` shape); per-row / summary loaders use the same tokens (`--dz-loader-*`) with `aria-busy` on the row. The uploading-row pulse stops under reduced motion; the loader only slows.
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

See [CHANGELOG.md](CHANGELOG.md) for the full list.

## Features

- **Drag & Drop** - Visual feedback on drag over with click-to-browse fallback
- **File Validation** - Max size, allowed types, max file count
- **Multiple Display Modes** - List, detailed, grid (with image previews), and compact
- **Image Previews** - Automatic thumbnail generation for image files
- **RTL Support** - Full right-to-left language support
- **Accessible** - Keyboard navigation and ARIA support
- **Form Integration** - Works with standard HTML forms
- **Modern** - Web Component with Shadow DOM, TypeScript, bundled with Vite
- **Framework Agnostic** - Works with any framework or vanilla JS

## Installation

```bash
npm install @keenmate/web-dropzone
```

## Usage

### Basic Usage

```html
<!-- Simple dropzone -->
<web-dropzone></web-dropzone>

<!-- With options -->
<web-dropzone
  accept="image/*,.pdf"
  multiple
  max-file-size="5242880"
  max-file-count="10"
  display-mode="detailed">
</web-dropzone>
```

### With JavaScript

```typescript
// Import the component (includes styles)
import '@keenmate/web-dropzone';

// Or import styles separately if needed
import '@keenmate/web-dropzone/style.css';

const dropzone = document.querySelector('web-dropzone');

// Listen for events (or assign the camelCase twin: dropzone.onFileAdd = (detail) => …)
dropzone.addEventListener('file-add', (e) => {
  console.log('File added:', e.detail.file);
});

dropzone.addEventListener('file-reject', (e) => {
  for (const { file, validation } of e.detail.rejectedFiles) {
    console.log(`Rejected ${file.name}: ${validation.error} (${validation.code})`);
  }
});

dropzone.addEventListener('change', (e) => {
  console.log('Files now:', e.detail.files);
});

// Get current files
const files = dropzone.files;

// The public facade — the same object every event detail / callback ctx carries
dropzone.controller.clear();
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `accept` | `string` | - | Allowed file types (e.g., `image/*,.pdf`) |
| `multiple` | `boolean` | `true` | Allow multiple file selection |
| `max-file-size` | `number` | - | Maximum file size in bytes |
| `max-file-count` | `number` | - | Maximum number of files |
| `display-mode` | `'list' \| 'detailed' \| 'grid' \| 'compact'` | `'list'` | How to display selected files |
| `files-inside` | `boolean` | `false` | Show files inside dropzone area |
| `disabled` | `boolean` | `false` | Disable the dropzone (an ancestor `<fieldset disabled>` too); `el.isDisabled` |
| `readonly` | `boolean` | `false` | Selection locked for the user (no add / Remove / Clear all); files still submitted; `el.isReadonly` |
| `render-mode` | `'bulk' \| 'structural' \| 'headless'` | inferred | Who renders: built-in UI, your render callbacks, or nothing (satellites / your own DOM). Absent → `bulk` when a display attribute is set, else `headless` |
| `max-visible-file-count` | `number` | `7` | Rows shown before the "Show N more" toggle |
| `allow-uploaded-file-removal` | `boolean` | `true` | `false` hides ✕ Remove on completed rows |
| `sink-completed-delay` | `number` (ms) | `1500` | Delay before a completed file sinks (with `sink-completed`) |
| `defer` | `boolean` | `false` | Core: hold the first build until `release()` (or removing the attribute) |
| `name` | `string` | - | Form field name for form integration |
| `value-format` | `'json' \| 'csv' \| 'array'` | `'json'` | Format for form value serialization |
| `labels` | JSON object | English | UI strings, merged per key — see [Labels (i18n)](#labels-i18n) |
| `overlay-target` | `string` | - | Element ID (or CSS selector, e.g. `#my-form`) for drag overlay (ultra-compact mode) |
| `concurrency` | `number` | `1` | Parallel uploads (with `uploadFileCallback`) |
| `auto-upload` | `boolean` | `true` | Upload files as soon as they are added |
| `cancel-timeout` | `number` (ms) | `2000` | How long a cancel waits for the aborted upload handler to settle |
| `cancel-timeout-behavior` | `'error' \| 'remove'` | `'error'` | What a timed-out cancel does — `error` (retryable) or remove the file |
| `cancel-icon` / `remove-icon` | `string` (raw HTML) | built-in | Row ⊘ Cancel / ✕ Remove glyphs — see the [XSS notice](#html-injection-xss-notice) |
| `sink-completed` | `boolean` | `false` | Auto-move completed files to the end of the list (after `sink-completed-delay`) |
| `keep-alive-when-removed` | `boolean` | `false` | Keep the store and its uploads when the element is removed from the page |
| `overlay-icon` | `string` (raw HTML) | Lucide `upload` | Icon shown in drag overlay. Accepts any HTML (SVG / `<img>` / emoji) — see the [XSS notice](#html-injection-xss-notice) |

## Display Modes

### List Mode (Default)

Simple list of file names with remove buttons.

```html
<web-dropzone display-mode="list"></web-dropzone>
```

### Detailed Mode

Shows file icon, name, size, and type for each file.

```html
<web-dropzone display-mode="detailed"></web-dropzone>
```

### Grid Mode

Image preview grid with thumbnails. Perfect for image uploads.

```html
<web-dropzone display-mode="grid" accept="image/*"></web-dropzone>
```

### Compact Mode

Minimal inline display showing file count and total size. Click to open a popover with the full file list.

```html
<web-dropzone display-mode="compact"></web-dropzone>
```

### Ultra-Compact Mode (Drag Overlay)

For minimal form integration, use compact mode with `overlay-target` to enable a drag overlay. When users drag files anywhere over the target element, a full overlay appears for dropping files.

```html
<form id="my-form">
  <input type="text" name="title" placeholder="Title">

  <web-dropzone
    display-mode="compact"
    overlay-target="my-form"
    labels='{"overlay": "Drop files here"}'
    overlay-icon="📎">
  </web-dropzone>

  <button type="submit">Submit</button>
</form>
```

### Files-Inside Mode

Display selected files inside the dropzone area instead of a separate list below:

```html
<web-dropzone files-inside display-mode="list"></web-dropzone>
<web-dropzone files-inside display-mode="grid" accept="image/*"></web-dropzone>
```

## Events

Every event bubbles and is **not composed**, fires on `<web-dropzone>`, and has a camelCase `on*` twin property that receives the **same detail** first (`dropzone.onFileAdd = ({ file }) => …`). Every detail also carries `controller` (= `dropzone.controller`) and `element` (the host) — non-enumerable, so `JSON.stringify(e.detail)` / `Object.keys` see only the data.

| Event | Twin | Detail | Description |
|-------|------|--------|-------------|
| `file-add` | `onFileAdd` | `{ file }` | A file entered the dropzone (one event per file) |
| `file-remove` | `onFileRemove` | `{ file }` | A file left the list — **local** (row ✕, `removeFile(s)`, Clear all, a single-file replace, a mode flip); one per file |
| `change` | `onChange` | `{ files }` | The selection changed (add / remove / clear) |
| `files-change` | `onFilesChange` | `{ changedIds, files }` | Coalesced queue tick, at most once per animation frame |
| `file-reject` | `onFileReject` | `{ rejectedFiles: [{ file, validation: { valid, error, code } }] }` | Files failed validation, or `beforeFilesAddCallback` vetoed the add (`code: 'rejected'`) |
| `file-progress` | `onFileProgress` | `{ id, progress, status, file }` | A file's progress changed |
| `file-status-change` | `onFileStatusChange` | `{ id, oldStatus, newStatus, file }` | A file's status transitioned |
| `file-update` | `onFileUpdate` | `{ file }` | Another field changed (preview generated, upload result merged) |
| `file-retry` | `onFileRetry` | `{ file }` | A failed / cancelled file was re-queued |
| `file-upload` | `onFileUpload` | `{ file }` | `uploadFileCallback` resolved for a file |
| `file-delete` | `onFileDelete` | `{ file }` | **Server** state: a removed file had been uploaded (or stashed metadata) — fires right after its `file-remove`; wire your server DELETE here |
| `file-cancel` | `onFileCancel` | `{ file, result, uploadedBytes, metadata }` | A cancel finished — `result`: `cancelled` \| `timeout-error` \| `timeout-remove` |
| `overlay-enter` / `overlay-leave` | `onOverlayEnter` / `onOverlayLeave` | `{ overlayElement }` | A drag entered / left the drag overlay |
| `ready` | `onReady` | — (context only) | Core: fired once, after the first build (`el.controller` is live). The host gets the `ready` attribute + `:state(ready)`; `await el.whenReady()` is the promise form. A mode-flip rebuild or a DOM move doesn't fire it again |

`<web-dropzone-list>` fires `summary-activate` (popover appearance — the summary line was activated) and `queue-open` (rolling appearance — the queue badge was clicked) on itself, with the bound store's `controller` / `element` on the detail. `file-row-update` (`{ file }`) is dispatched on the element a `renderFileItemCallback` returned (structural mode) — listen on that row.

### Event Examples

```javascript
const dropzone = document.querySelector('web-dropzone');

// Single file added
dropzone.addEventListener('file-add', (e) => {
  const { file, controller } = e.detail;
  console.log(`Added: ${file.name}`);
  console.log(`Total files: ${controller.getFiles().length}`);
});

// Files rejected (validation failed, or beforeFilesAddCallback vetoed the add → code 'rejected')
dropzone.addEventListener('file-reject', (e) => {
  for (const { file, validation } of e.detail.rejectedFiles) {
    console.log(`${file.name}: ${validation.error} (${validation.code})`);
  }
});

// Any change to the selection — the twin gets the same detail
dropzone.onChange = ({ files }) => updateUI(files);
```

## Callbacks

Every callback takes **one** `ctx` object that also carries `controller` / `element`. `before*Callback`s may be async; returning `false` vetoes.

| Callback | `ctx` | Returns |
|----------|-------|---------|
| `validateCallback` | `{ file, existingFiles }` | `ValidationResult` (sync) |
| `beforeFilesAddCallback` | `{ files, existingFiles }` | `false` vetoes (→ `file-reject`, code `rejected`); a `File[]` replaces the batch (validated again) |
| `beforeFilesRemoveCallback` | `{ files, allFiles }` | `false` vetoes (row ✕, Clear all, `removeFile(s)` / `clear` with `{ confirm: true }`) |
| `beforeFilesCancelCallback` | `{ files, allFiles }` | `false` vetoes (`cancelFile`, row ⊘; `cancelAll` / Cancel all ask once) |
| `uploadFileCallback` | `{ file, signal, setProgress, startBytes, startPercent, metadata, setMetadata, uploadMetadata }` | `Promise<void \| { metadata, downloadUrl, previewUrl, name }>` |
| `getFileIconCallback` | `{ file }` | icon HTML, or `null` to fall through |
| `renderFileItemCallback` | `{ file, fileIndex, displayMode, isInPopover }` | `string \| HTMLElement` (structural mode) |
| `renderListWrapperCallback` | `{ rowsHtml, files }` | `string \| HTMLElement` (structural mode) |
| `renderPromptCallback` | context only | `string \| HTMLElement` (structural mode) |
| `renderSummaryCallback` | `{ files }` | `string \| HTMLElement` (structural mode) |
| `renderRolling{Body,FileInfo,Progress}Callback` | `StatusSurfaceArgs` (`currentFile`, `aggregate`, `overallPercent`, …) | `string \| HTMLElement \| false \| null` (structural mode, rolling list) |
| `getCustomStylesCallback` | context only | CSS string injected into the shadow root |
| `renderLoadingCallback` | `{ component, context: 'upload', containerElement, element, label }` | fill `containerElement`; optional cleanup function — the indicator chip's upload loader (beats `window.components.renderLoaderCallback`) |
| `persistStateCallback` / `loadStateCallback` | `{ key, state }` / `{ key }` | — / `DropzoneState \| null` (may be async) |

```javascript
dropzone.beforeFilesAddCallback = async ({ files }) => {
  if (!(await myConfirm(`Add ${files.length} file(s)?`))) return false;
};

dropzone.uploadFileCallback = async ({ file, signal, setProgress }) => {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body, signal });
  setProgress(100);
  return { metadata: { serverId: await res.text() } };
};
```

## Properties

```typescript
// Get all files
const files: FileState[] = dropzone.files;

// Get/set accept types
dropzone.accept = 'image/*,.pdf';

// Get/set max size
dropzone.maxFileSize = 5242880; // 5MB

// Get/set max files
dropzone.maxFileCount = 10;

// Get/set display mode
dropzone.displayMode = 'grid';

// Boolean attributes are short (`multiple`, `disabled`, `readonly`, `auto-upload`, …);
// their properties carry the configKey name
const isMultiple = dropzone.isMultiple;
const isDisabled = dropzone.isDisabled;
dropzone.isReadonly = true; // selection locked, files still submitted
```

## File-type icons

Each file row shows an icon resolved from the file's **category** (`image`, `video`, `audio`, `pdf`, `doc`, `spreadsheet`, `archive`, `code`, `text`, `default`) — Lucide glyphs out of the box. Override them per **extension** or per **category** with the `fileIcons` map, or take full control with the `getFileIconCallback`. Both are JS-only properties (no HTML attribute).

```javascript
const dropzone = document.querySelector('web-dropzone');

// Map keyed by EXTENSION (leading dot optional, case-insensitive) or CATEGORY.
// Extension keys win over category keys, which win over the built-in icon.
dropzone.fileIcons = {
  psd: '<svg viewBox="0 0 24 24">…</svg>',   // by extension
  fig: '<img src="/icons/figma.svg" alt="">',
  archive: '📦',                             // override a whole category
};

// Full-control resolver — consulted BEFORE the map. Return HTML to use it,
// or null/undefined to fall through to fileIcons → category → default.
dropzone.getFileIconCallback = ({ file }) =>
  file.name.endsWith('.sketch') ? '<svg>…</svg>' : null;
```

**Resolution order** (first hit wins): `getFileIconCallback` → `fileIcons[extension]` → `fileIcons[category]` → built-in category icon.

> ⚠️ Icon values are **raw HTML** inserted via `innerHTML` and are **NOT sanitized**. Only pass markup you control — never untrusted / user-supplied strings. See the [HTML injection (XSS) notice](#html-injection-xss-notice).

## HTML injection (XSS) notice

The following properties / callbacks accept **raw HTML** and are intentionally **NOT XSS-safe** — this gives you full control over rendering but means you must sanitize any untrusted data before passing it in:

| Property / callback | Output used in | Risk |
|---------------------|----------------|------|
| `fileIcons` (map values) | File-row icon slot (innerHTML) | HTML injection |
| `getFileIconCallback` | File-row icon slot (innerHTML) | HTML injection |
| `icon` attr / property | Drop-zone + minimal prompt (innerHTML) | HTML injection |
| `overlay-icon` attr / property | Drag overlay (innerHTML) | HTML injection |
| `cancel-icon` / `remove-icon` attr / property | Row Cancel / Remove buttons (innerHTML) | HTML injection |
| `renderFileItemCallback` | File rows (innerHTML) | HTML injection |
| `renderListWrapperCallback` | List wrapper (innerHTML) | HTML injection |
| `renderPromptCallback` | Drop-area prompt (innerHTML) | HTML injection |
| `renderSummaryCallback` | Compact-mode summary (innerHTML) | HTML injection |
| `getCustomStylesCallback` | Injected `<style>` (textContent) | CSS injection |

**If any of these can contain user-generated content, sanitize it first** (e.g. DOMPurify). Built-in defaults and static markup you author are safe; the risk is only in interpolating untrusted strings.

## Methods

The same methods (plus `getFiles()`, `getConfig()`, `getOverallProgress()`, `isReady` and `hasActiveUploads`) are on `dropzone.controller` — the `DropzoneController` facade every event detail and callback ctx carries.

| Method | Description |
|--------|-------------|
| `addFiles(files: FileList \| File[])` | Add files programmatically |
| `removeFile(id, opts?)` / `removeFiles(ids, opts?)` | Remove files (a running upload is cancelled first); `{ confirm: true }` asks `beforeFilesRemoveCallback` (once per batch) |
| `clear(opts?)` | Remove all files |
| `cancelFile(id)` / `cancelAll()` | Cancel uploads (see [Cancelling uploads](#cancelling-uploads)); resolve when finished |
| `pauseFile(id)` / `resumeFile(id)` / `pauseAll()` / `resumeAll()` | Pause / resume (progress kept) |
| `retryFile(id)` / `retryAll()` | Re-queue failed / cancelled files (a cancelled file restarts from 0) |
| `uploadAll()` / `uploadFile(id)` | Drain the queue / upload one file now |
| `destroy()` | Final teardown (core): aborts running uploads at once, clears the form value; the element stays inert |
| `release()` / `whenReady()` | Core: build a `defer`-held element / await the first build |
| `getFileById(id: string)` | The file with this id, or `null` |
| `hasActiveUploads` (getter) | `true` while any file is `pending` / `uploading` / `paused` / `cancelling` |
| `updateFileProgress(id: string, progress: number)` | Update upload progress (0-100) |
| `setFileStatus(id: string, status, error?)` | Set file status (pending/uploading/complete/error) |

### Upload Progress Tracking

Use `updateFileProgress` and `setFileStatus` to track upload progress:

```javascript
const dropzone = document.querySelector('web-dropzone');

// Simulate upload for each file
dropzone.files.forEach(file => {
  let progress = 0;

  const interval = setInterval(() => {
    progress += 10;
    dropzone.updateFileProgress(file.id, progress);

    if (progress >= 100) {
      clearInterval(interval);
      dropzone.setFileStatus(file.id, 'complete');
    }
  }, 200);
});

// Handle upload error
dropzone.setFileStatus(file.id, 'error', 'Upload failed');
```

## Cancelling uploads

Verbs: **cancel** stops a running upload, **remove** takes a file out of the list, **delete** is
your server-side cleanup, **destroy** is the final teardown (`el.destroy()`).

- `cancelFile(id)` (and the row **⊘**) applies to `uploading` / `pending` / `paused` files.
  Nothing running → `cancelled` at once. A running handler gets `ctx.signal` aborted, the file
  shows `cancelling` ("Cancelling…", buttons disabled), and the cancel waits up to
  `cancel-timeout` ms. The handler settles in time (rejects **or** resolves) → `cancelled`.
  It doesn't → `cancel-timeout-behavior`: `error` (`file.error = 'cancel-timeout'`, retryable)
  or `remove`. Anything it reports after the timeout is ignored; the concurrency slot frees as
  soon as it settles or the timeout fires.
- `cancelAll()` / **Cancel all** cancels every uploading / queued / paused file
  (`beforeFilesCancelCallback` is asked once with all of them).
- The row **✕** (and `removeFile`) on a running file cancels it first, then removes it.
- Removing `<web-dropzone>` from the page cancels everything the same way (graceful: handlers
  get their signal + `cancel-timeout`), then destroys the store (a DOM move keeps it). The element
  stays reusable — re-adding it builds a fresh, empty store. `keep-alive-when-removed` opts out.

**Server-side cleanup is the app's job.** A cancelled upload may have left a partial file or an
open session on the server; `file-cancel` tells you what the handler knew:

```javascript
dropzone.uploadFileCallback = async ({ file, signal, setProgress, setMetadata }) => {
  const { uploadUrl } = await (await fetch('/api/uploads', { method: 'POST', signal })).json();
  setMetadata({ uploadUrl });                    // remembered on the file
  await putWithProgress(uploadUrl, file, { signal, onProgress: setProgress });
};

dropzone.addEventListener('file-cancel', ({ detail }) => {
  const { file, result, uploadedBytes, metadata } = detail;
  if (metadata?.uploadUrl) {
    // the partial upload is yours to discard
    fetch(metadata.uploadUrl, { method: 'DELETE' });
  }
  console.log(`${file.name}: ${result} after ${uploadedBytes} bytes`);
});

// Ask first (row ⊘, cancelFile, cancelAll — once for the whole batch)
dropzone.beforeFilesCancelCallback = async ({ files }) =>
  (await myConfirm(`Cancel ${files.length} upload(s)?`)) ? undefined : false;
```

### Leaving the page / the view

`hasActiveUploads` is `true` while any file is pending, uploading, paused or cancelling. The
component never blocks navigation itself — **the app decides** whether and how to ask. The flag
stays accurate while a `keep-alive-when-removed` element is detached (its store keeps uploading).

- **Reload / close the tab** — an app-level `beforeunload` listener:

```javascript
window.addEventListener('beforeunload', (e) => {
  if (!dropzone.hasActiveUploads) return;
  e.preventDefault();      // the browser shows its own leave-page prompt
  e.returnValue = '';      // legacy browsers
});
```

- **Graceful exit** (finish with the cancel rule, then tear down for good):
  `await dropzone.cancelAll(); dropzone.destroy();` — `destroy()` alone aborts at once.
- **SPA navigation** — guard the route yourself:

```javascript
router.beforeEach(async () => {
  if (!dropzone.hasActiveUploads) return true;
  if (!confirm('Uploads are still running. Leave and cancel them?')) return false;
  await dropzone.cancelAll(); // handlers get their signal; resolves when settled
  return true;
});
```

- **Just removing the element** (no `keep-alive-when-removed`) already cancels gracefully and
  leaves an empty, reusable element — no extra code needed.

## Labels (i18n)

All UI strings come from one `labels` input — a partial object merged **per key** over the
built-in English defaults (`DEFAULT_LABELS`). `{name}`, `{count}`, `{size}`, `{status}` (…)
placeholders are filled in. Set it as a property or a JSON attribute; changes re-render live
(satellites too). Every satellite also takes its **own** `labels` (property or JSON attribute),
merged per key on top of its store's.

```html
<web-dropzone labels='{"prompt": "Přetáhněte soubory sem", "selectFiles": "Vybrat soubory"}'></web-dropzone>
```

```javascript
dropzone.labels = {
  cancelFile: 'Zrušit {name}',
  removeFile: 'Odebrat {name}',
  cancelAll: 'Zrušit vše',
  statusUploading: 'Nahrávám',
  statusAria: 'Stav: {status}',
};
```

Keys: `prompt`, `hint`, `dragActive`, `selectFiles`, `noFileChosen`, `overlay`;
`statusPending` / `statusUploading` / `statusPaused` / `statusCancelling` / `statusComplete` /
`statusError` / `statusCancelled`, `statusAria`, `cancelTimeout`, `cancelling`;
`pauseFile` / `resumeFile` / `retryFile` / `cancelFile` / `removeFile`;
`pauseAll` / `resumeAll` / `retryAll` / `cancelAll`;
`noData`, `summary` (`{count}`, `{size}`), `viewFiles`, `filesChosen`, `fileCount` / `fileCountOne`,
`addMore`, `clearAll`, `showMore` / `showLess`, `showQueue`, `unknownType`;
popover limits line `limitMaxFileSize` / `limitMinFileSize` / `limitMaxTotalSize(Left)` /
`limitMaxFileCount(Left)` / `limitMinFileCount`; progress strip `progressCounts` / `progressPaused` /
`progressFailed`; indicator `indicatorTitle` / `indicatorIdle` / `indicatorStatus` / `indicatorQueue` /
`close` / `indicatorFailed` / `indicatorUploading` / `indicatorPaused` / `indicatorQueued` /
`indicatorDone`; validation `errorMaxFileSize` / `errorMinFileSize` / `errorFileType` /
`errorRejected` / `errorMaxFileCount(One)` / `errorDuplicate` / `errorMaxTotalSize` / `errorUpload`;
form validity `errorMinFileCount(One)`. `…One` variants are used when the count is 1
(`countLabel()`). Every lookup goes through `resolveLabel(sources, key, vars)` (exported) —
page-wide localisation will plug in there.

A label set to `''` is deliberately empty and renders nothing (e.g. `noData: ''` hides the empty-list
text); a missing / `undefined` key falls back to English. Labels are **text** — always inserted escaped
(no label is rendered as HTML), so placeholder values like `{name}` are safe.

## File State

Each file in the `files` array has the following structure:

```typescript
interface FileState {
  id: string;           // Unique identifier
  file: File;           // Original File object
  name: string;         // File name
  size: number;         // File size in bytes
  type: string;         // MIME type
  status: 'pending' | 'uploading' | 'paused' | 'cancelling' | 'cancelled' | 'complete' | 'error';
  progress: number;     // Upload progress (0-100)
  error?: string;       // Error message if status is 'error' ('cancel-timeout' after a timed-out cancel)
  previewUrl?: string;  // Data URL for image preview
  metadata?: Record<string, unknown>; // What the upload handler stashed (ctx.setMetadata)
}
```

## Form Integration

The component works with standard HTML forms:

```html
<form id="upload-form">
  <web-dropzone name="files" value-format="json"></web-dropzone>
  <button type="submit">Upload</button>
</form>

<script>
  document.getElementById('upload-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    // Get file references as JSON
    const filesJson = formData.get('files');
    console.log('Files:', JSON.parse(filesJson));

    // Or access files directly
    const dropzone = document.querySelector('web-dropzone');
    const files = dropzone.files.map(f => f.file);

    // Upload files
    const uploadData = new FormData();
    files.forEach(file => uploadData.append('files[]', file));
    fetch('/upload', { method: 'POST', body: uploadData });
  });
</script>
```

### Value Formats

- `json` - JSON array of file names (default)
- `csv` - Comma-separated file names
- `array` - Multiple hidden inputs with `name[]`

## Styling

The component uses Shadow DOM with CSS custom properties for theming.

### Sizing

Use `--dz-rem` for global scaling:

```html
<!-- Compact (80%) -->
<web-dropzone style="--dz-rem: 8px;"></web-dropzone>

<!-- Default (100%) -->
<web-dropzone></web-dropzone>

<!-- Large (120%) -->
<web-dropzone style="--dz-rem: 12px;"></web-dropzone>
```

### CSS Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `--dz-accent-color` | `#3b82f6` | Primary accent color |
| `--dz-text-color-1` | `#334155` / `#f1f5f9` | Primary text color |
| `--dz-text-color-2` | text 1, 75% into `--dz-main-bg` | Secondary text color |
| `--dz-main-bg` | `#ffffff` / `#1e293b` | Surface the derived colors start from |
| `--dz-border-color` | `--dz-main-bg`, OKLCH step | Border color |
| `--dz-dropzone-bg` | `--dz-main-bg` | Dropzone background |
| `--dz-dropzone-bg-active` | `--base-primary-bg-subtle` (accent 10% light / 20% dark) | Background when dragging over |
| `--dz-dropzone-border` | `2px dashed` border color | Border style |
| `--dz-dropzone-border-active` | `2px solid` accent | Border when dragging over |
| `--dz-dropzone-border-radius` | `0.8rem` | Border radius |
| `--dz-success-color` | `#10b981` | Success state color |
| `--dz-error-color` | `#dc2626` | Error state color |

Light / dark values follow `color-scheme`. The defaults are those of
[`@keenmate/base-css-variables`](https://www.npmjs.com/package/@keenmate/base-css-variables): derived
colors use the contract's formulas on the `--dz-*` inputs, so the dropzone looks the same with or
without the contract on the page.

For the complete list of CSS variables, see [_variables.css](./src/css/_variables.css).

### Theme Designer Integration

The component integrates with KeenMate's theme designer `--base-*` variables:

```css
web-dropzone {
  --dz-accent-color: var(--base-primary-color);
  --dz-text-color-1: var(--base-text-color-1);
  --dz-border-color: var(--base-border-color);
}
```

## RTL Support

Full support for right-to-left languages:

```html
<web-dropzone dir="rtl"></web-dropzone>

<!-- Or inherited from parent -->
<div dir="rtl">
  <web-dropzone></web-dropzone>
</div>
```

## Browser Support

- Chrome/Edge 67+
- Firefox 63+
- Safari 10.1+

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## License

Copyright (c) 2025 Keenmate

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

Created by [Keenmate](https://github.com/keenmate) as part of the Pure Admin design system.
