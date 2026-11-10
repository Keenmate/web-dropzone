# Usage — `@keenmate/web-dropzone`

The full API of `<web-dropzone>` (the store, plus its built-in picker / list) and the four satellite
elements. Theming lives in [theming.md](./theming.md), worked examples in [examples.md](./examples.md),
keyboard / ARIA in [accessibility.md](./accessibility.md). The attribute and property tables below are
generated from the package's Custom Elements Manifest (`custom-elements.json`), which is built from the
components' input tables — the same source the runtime uses.

## Contents

- [Basic usage](#basic-usage)
- [Attributes](#attributes)
- [JS-only properties](#js-only-properties)
- [Display modes](#display-modes)
- [Events](#events)
- [Callbacks](#callbacks)
- [File-type icons](#file-type-icons)
- [HTML injection (XSS) notice](#html-injection-xss-notice)
- [Methods](#methods)
- [Cancelling uploads](#cancelling-uploads)
- [Labels (i18n)](#labels-i18n)
- [Responsive rules](#responsive-rules)
- [File state](#file-state)
- [Form integration](#form-integration)
- [RTL](#rtl)
- [Satellites](#satellites)
- [Logging](#logging)
- [Lifecycle](#lifecycle)

## Basic usage

```html
<!-- Simple dropzone -->
<web-dropzone></web-dropzone>

<!-- With options -->
<web-dropzone
  accept="image/*,.pdf"
  multiple
  max-file-size="5MB"
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

Attributes of `<web-dropzone>`. Every attribute has a property (the **Property** column); boolean
attributes are short (`multiple`, `disabled`, `auto-upload`, …) and their properties carry the
`is` / `should` name (`el.isMultiple`, `el.isDisabled`, `el.shouldAutoUpload`). Removing an attribute
(or assigning `undefined`) resets the input to its default; an invalid value is refused with a warning
and the core `input-rejected` event, keeping the previous value. That covers: an unknown enum value, a
size that isn't one (`max-file-size`, `min-file-size`, `max-total-size` take bytes or `5MB`, `1.5GB`,
`300 kB`, `2MiB` — binary units, core `toBytes()`), a negative count (`concurrency` must be ≥ 1), and a
`controls` / `item-controls` list with an unknown token (the whole value is refused). Extra CSS for the
shadow root (`custom-styles` / `getCustomStylesCallback`, page-wide per tag) is described in
[theming.md](./theming.md#extra-css-for-the-shadow-root).

| Attribute | Property | Type | Default | Description |
|---|---|---|---|---|
| `accept` | `accept` |  |  | Accepted file types (MIME types / extensions), comma-separated. |
| `multiple` | `isMultiple` | `boolean` | `true` | Allow selecting multiple files. |
| `max-file-size` | `maxFileSize` | `number` | `0` | Maximum size per file in bytes (the attribute takes a size: "5MB", "1.5GB", "300 kB", "2MiB" — binary units). 0 = unlimited. |
| `min-file-size` | `minFileSize` | `number` | `0` | Minimum size per file in bytes. 0 = no minimum. |
| `max-total-size` | `maxTotalSize` | `number` | `0` | Maximum combined size of all files in bytes. 0 = unlimited. |
| `max-file-count` | `maxFileCount` | `number` | `0` | Maximum number of files. 0 = unlimited. |
| `min-file-count` | `minFileCount` | `number` | `0` | Minimum number of files; reflected into the form validity (valueMissing). |
| `max-visible-file-count` | `maxVisibleFileCount` | `number` | `7` | How many file rows are visible before the list scrolls. |
| `dedupe-mode` | `dedupeMode` | `'name' \| 'name-size' \| 'none'` | `'name'` | How duplicate files are detected: by name, name+size, or not at all. |
| `disabled` | `isDisabled` | `boolean` | `false` | Disable the dropzone (like a native control: no clicks / drops, every button — selector, rows, bulk actions, satellites — disabled and out of the tab order; boolean attribute — present = on). An ancestor `<fieldset disabled>` disables it too (core `isEffectivelyDisabled`); `el.isDisabled` keeps the authored value. |
| `readonly` | `isReadonly` | `boolean` | `false` | Read-only (like a native control): the user cannot change the selection — no add (click / drop / overlay / Add more), no row Remove, no Clear all — but the files stay visible and ARE submitted with the form. Uploads keep running; the programmatic API is unaffected. |
| `render-mode` | `renderMode` | `'bulk' \| 'structural' \| 'headless' \| null` |  | Render mode — who renders the file list. When absent it is inferred from the presence of renderer-trigger attributes (display-mode / selector-appearance / list-appearance → bulk; none → headless). `structural` is the only way to opt into render callbacks. |
| `progress-throttle` | `progressThrottle` | `number` | `0` | Throttle interval in ms for file-progress events. 0 = every tick. |
| `display-mode` | `displayMode` | `'list' \| 'detailed' \| 'grid' \| 'compact'` | `'list'` | Single-axis display shorthand. |
| `selector-appearance` | `selectorAppearance` | `'card' \| 'button' \| 'minimal' \| 'native' \| null` |  | File-selector appearance (overrides the display shorthand when set). |
| `list-appearance` | `listAppearance` | `'list' \| 'detailed' \| 'grid' \| 'badges' \| 'rolling' \| 'popover' \| 'none' \| null` |  | File-list appearance (overrides the display shorthand when set). |
| `grid-layout` | `gridLayout` | `'uniform' \| 'natural'` | `'uniform'` | Tile layout for list-appearance="grid": uniform equal-size tiles, or natural (equal-height rows that keep each image aspect ratio). |
| `grid-status` | `gridStatus` | `'badge' \| 'overlay'` | `'badge'` | How finished grid files are flagged: badge (corner glyph) or overlay (full-tile veil + big centred check/error glyph). |
| `controls` | `controls` | `DropzoneControl[]` |  | Plyr-style allowlist of top-level surfaces (comma-separated): picker, list, overall-progress. Unset = render all. |
| `item-controls` | `itemControls` | `FileItemPart[]` |  | Plyr-style allowlist of per-row parts (comma-separated): icon, name, size, type, progress, status, action, cancel, remove. Unset = render all. |
| `rolling-rotation` | `rollingRotation` | `'horizontal' \| 'vertical' \| 'slide-in'` | `'slide-in'` | Rotation style for the rolling list appearance. |
| `card-size` | `cardSize` | `'minimal' \| 'compact' \| 'big' \| null` |  | Card size for the card selector appearance. |
| `show-thumbnails` | `isThumbnailsShown` | `boolean` | `null` | Force image thumbnails on/off. Property-only tristate: unset (undefined) means auto (on for grid, icons elsewhere). |
| `files-inside` | `isFilesInside` | `boolean` | `false` | Render the file list inside the drop area. |
| `cancel-icon` | `cancelIcon` |  |  | HTML for the row Cancel (⊘) button glyph (raw HTML — NOT sanitized). Unset = built-in icon. |
| `remove-icon` | `removeIcon` |  |  | HTML for the row Remove (✕) button glyph (raw HTML — NOT sanitized). Unset = built-in icon. |
| `icon` | `icon` |  |  | Prompt icon (emoji or markup). |
| `labels` | `labels` | `Partial<DropzoneLabels>` |  | Every UI string (see `DropzoneLabels` / `DEFAULT_LABELS`), merged per key over the built-in English; `{name}` / `{count}` / `{size}` / … placeholders: prompt, hint, empty, summary, status names, row + bulk buttons, popover, limits line, progress strip, validation messages. Satellites inherit them (and take their own `labels` on top). Property (object) or JSON attribute. Live. |
| `popover-placement` | `popoverPlacement` | `'top' \| 'top-start' \| 'top-end' \| 'bottom' \| 'bottom-start' \| 'bottom-end' \| 'left' \| 'left-start' \| 'left-end' \| 'right' \| 'right-start' \| 'right-end'` | `'bottom-start'` | Placement of the compact-mode popover relative to the summary (floating-ui placement). |
| `overlay-target` | `overlayTarget` | `HTMLElement \| string` |  | Element (or selector string) that acts as the full-viewport drag-overlay target. Assign an HTMLElement via the property; a selector string via the `overlay-target` attribute. |
| `overlay-icon` | `overlayIcon` |  |  | Icon shown in the drag overlay. |
| `highlight-on-page-drag` | `shouldHighlightOnPageDrag` | `boolean` | `false` | Arm the drop target while FILES are dragged anywhere over the page: the host gets the `armed` attribute + `:state(armed)` and the card takes `--dz-dropzone-bg-armed` (the card under the pointer keeps `--dz-dropzone-bg-active`). Cleared on drop anywhere, when the drag leaves the window, on Escape / `dragend`, and on disconnect. Never armed while disabled / read-only; text and other non-file drags never arm. One shared page listener for all instances. |
| `name` | `name` |  |  | Form field name. Files submit as real FormData blobs under this name. |
| `concurrency` | `concurrency` | `number` | `1` | Maximum concurrent uploads through the worker pool. |
| `cancel-timeout` | `cancelTimeout` | `number` | `2000` | How long (ms) a cancel waits for the aborted upload handler to settle (the row shows "Cancelling…"). Settles in time → `cancelled`; otherwise `cancel-timeout-behavior` applies and later results are ignored. |
| `cancel-timeout-behavior` | `cancelTimeoutBehavior` | `'error' \| 'remove'` | `'error'` | What a timed-out cancel does: `error` (status error, reason `cancel-timeout`, retryable) or `remove` (the file is removed from the list). |
| `auto-upload` | `shouldAutoUpload` | `boolean` | `true` | Auto-upload newly added files. |
| `allow-uploaded-file-removal` | `isUploadedFileRemovalAllowed` | `boolean` | `true` | Whether already-uploaded files can be removed. |
| `sink-completed` | `shouldSinkCompleted` | `boolean` | `false` | Auto-move completed files to the end of the list (after `sink-completed-delay`). |
| `sink-completed-delay` | `sinkCompletedDelay` | `number` | `1500` | Delay in ms before a completed file reorders. Only meaningful when sink-completed is on. |
| `progress-mode` | `progressMode` | `'optimistic' \| 'pessimistic'` | `'optimistic'` | Progress reporting contract: optimistic (tick before ACK, snap back on failure) or pessimistic (tick only after ACK). |
| `keep-alive-when-removed` | `shouldKeepAliveWhenRemoved` | `boolean` | `false` | Keep the store (files, running uploads) when the element is removed from the page. Default: a removal cancels every upload (handlers get their signal + cancel-timeout) and then destroys the store. A DOM move never tears anything down. |
| `storage-key` | `storageKey` |  |  | Key of the persisted UI state (popover size; core SPEC §12.17). Unset / empty = off; set = localStorage `km-state:web-dropzone:<key>`, or `loadStateCallback` / `saveStateCallback`. |
| `custom-styles` | `customStyles` | `string \| null` |  | Extra CSS for the shadow root (raw CSS — NOT sanitized). Comes after the page-wide `window.components['web-dropzone'].customStyles`, so it overrides it; `getCustomStylesCallback` wins over it. An `@import` (an icon font) is also linked once in the document head (core). |
| `defer` | `shouldDefer` | `boolean` | `false` | Hold the first build (core, SPEC §6.3): while set when the element first connects, nothing is built and every input, callback and listener assigned meanwhile accumulates; `release()` (or removing the attribute) then builds once. Latched after the first build. |
| `theme-source` | `themeSource` | `string` |  | Where this element reads its theme from instead of the page (core, SPEC §12.10): a CSS selector (nearest matching ancestor, else the first match), `'closest'` (the nearest ancestor carrying a theme signal), or (property only) an `Element`. Unset = the page. |
| `motion` | `motion` | `'auto' \| 'none' \| 'snappy' \| 'smooth'` | `'auto'` | Motion level (core, SPEC §12.16): `auto` (default — inherit: the nearest `data-motion` ancestor (a section), else the page level `window.components.motion` / `<html data-motion>`; closest wins), `none` (no transitions, instant scrolling), `snappy` (short) or `smooth` (longer). Sets the shared `--base-duration-*` / `--base-scroll-behavior` tokens on the element through `data-motion`; the OS reduced-motion setting always wins. |
| `responsive` | `responsive` | `ResponsiveMap \| null` |  | Instance responsive rules (core, SPEC §6.7): partial configs on two axes — `device` (keyed by device class `mobile` / `tablet` / `desktop`; a mouse device is `desktop` at any width) and `breakpoint` (keyed by the window-width bucket); the breakpoint entry applies first, the device entry over it (device wins). An object or a JSON attribute, e.g. `{"device":{"tablet":{"presentation":"modal"}},"breakpoint":{"mobile":{…}}}`. Beats page rules (`window.components.responsive*`) and values set on the element; never reflects. An entry of `null` ignores the page rules while it matches. |

## JS-only properties

Properties with no attribute (objects, callbacks, read-only state). Callbacks are described in [Callbacks](#callbacks); every event also has a camelCase `on*` twin property (see [Events](#events)).

| Property | Type | Description |
|---|---|---|
| `isArmed` | `boolean` | True while the dropzone is armed (`highlight-on-page-drag` + files are dragged over the page + it accepts drops). Mirrors the `armed` attribute / `:state(armed)`. (read-only) |
| `files` | `FileState[]` | Get all current files. (read-only) |
| `hasActiveUploads` | `boolean` | `true` while any file is pending / uploading / paused / cancelling — work that leaving the page (or removing the element) would lose. Graceful exit: `await el.cancelAll(); el.destroy()`. (read-only) |
| `validateCallback` | `(ctx: ValidateContext) => ValidationResult` | Custom per-file validation, after the built-in size / type checks. `ctx`: `{ file, existingFiles }`. Sync. |
| `beforeFilesAddCallback` | `(ctx: BeforeFilesAddContext) => false \| File[] \| void \| Promise<false \| File[] \| void>` | Gate before a validated batch is added. `ctx`: `{ files, existingFiles }`. `false` cancels (files reported in `file-reject` with code `rejected`); a `File[]` replaces the batch (validated again); may be async. |
| `beforeFilesRemoveCallback` | `(ctx: BeforeFilesRemoveContext) => false \| void \| Promise<false \| void>` | Gate before a user-initiated removal (row ✕, Clear all) or `removeFile` / `clear` with `{ confirm: true }`. `ctx`: `{ files, allFiles }`. `false` cancels; may be async. |
| `beforeFilesCancelCallback` | `(ctx: BeforeFilesCancelContext) => false \| void \| Promise<false \| void>` | Gate before a cancel: `cancelFile(id)` / the row Cancel button (`files: [file]`) and `cancelAll()` / "Cancel all" (once, every file). `ctx`: `{ files, allFiles }`. `false` vetoes; may be async. Internal cancels (removing a running file, element removal) skip it. |
| `uploadFileCallback` | `(ctx: FileUploadContext) => Promise<void \| FileUploadResult>` | Component-driven upload handler; added files run through the worker pool. `ctx`: `{ file, signal, setProgress, startBytes, startPercent, metadata, setMetadata, uploadMetadata }`. |
| `retryPolicy` | `RetryPolicy` | Retry policy applied when uploadFileCallback rejects. Property-only object. |
| `fileIcons` | `Record<string, string>` | Icon overrides keyed by extension or category (raw HTML — NOT sanitized). Property-only object. |
| `getFileIconCallback` | `(ctx: FileIconContext) => string \| null \| undefined` | Full-control file-icon resolver (raw HTML — NOT sanitized). `ctx`: `{ file }`. Return null to fall back to fileIcons / category. |
| `renderFileItemCallback` | `(ctx: FileItemRenderContext) => string \| HTMLElement` | Custom render for a single file row (structural mode). `ctx`: `{ file, fileIndex, displayMode, isInPopover }`. |
| `renderListWrapperCallback` | `(ctx: ListWrapperRenderContext) => string \| HTMLElement` | Custom wrapper around the rendered file rows (structural mode). `ctx`: `{ rowsHtml, files }`. |
| `renderPromptCallback` | `(ctx: PromptRenderContext) => string \| HTMLElement` | Custom render for the drop-area prompt (structural mode). `ctx`: context only. |
| `renderSummaryCallback` | `(ctx: SummaryRenderContext) => string \| HTMLElement` | Custom render for the compact-mode summary (structural mode). `ctx`: `{ files }`. |
| `renderRollingBodyCallback` | `StatusSurfaceCallback` | Rolling list appearance (structural mode): replace the whole rolling body. `ctx`: `StatusSurfaceArgs`. `null` → default, `false` → hide. |
| `renderRollingFileInfoCallback` | `StatusSurfaceCallback` | Rolling list appearance (structural mode): the file-info slot of the current row. `ctx`: `StatusSurfaceArgs`. |
| `renderRollingProgressCallback` | `StatusSurfaceCallback` | Rolling list appearance (structural mode): the progress slot of the current row. `ctx`: `StatusSurfaceArgs`. |
| `renderLoadingCallback` | `(ctx: LoaderRenderContext) => void \| (() => void)` | Draw the upload loader of the bound `<web-dropzone-indicator>` chip (`ctx.context` = `upload`): fill `ctx.containerElement`, optionally return a cleanup. Beats the page-wide `window.components.renderLoadingCallback`; unset = that, else the default `.dz__loader` (the shared `--base-loader-*` contract). The tiny per-row / summary loaders are CSS-only (`--dz-loader-*` tokens). Read when a loader is drawn. |
| `getCustomStylesCallback` | `(ctx: CustomStylesContext) => string \| null \| undefined` | Returns extra CSS for the shadow root (raw CSS — NOT sanitized); wins over `customStyles`. Re-run on every build and when `customStyles` / this callback change. `ctx`: context only (`controller`, `element`). |
| `loadStateCallback` | `LoadStateCallback<DropzoneState>` | Persisted UI state source (core SPEC §12.17): `(ctx) => DropzoneState \| null \| Promise<…>`, `ctx`: `{ key }` + context. Set both callbacks; either one alone switches `localStorage` off. Read when the popover first opens. |
| `saveStateCallback` | `SaveStateCallback<DropzoneState>` | Persisted UI state sink (core SPEC §12.17): `ctx`: `{ key, state }` + context, `state` = the WHOLE `DropzoneState` (`{ popoverWidth?, popoverHeight? }`). Set both callbacks; either one alone switches `localStorage` off. Called after the user resizes the popover. |
| `responsiveCallback` | `ResponsiveCallback \| null` | Instance computed responsive rule (core, SPEC §6.7): `(ctx) => partial config \| null \| undefined`, ctx `{ env, deviceClass, breakpoint, element, component, config }` (`config` = base). Runs after `responsive` (wins key by key); re-runs on environment flips, throttled viewport-width changes, rule and config changes. `null` ignores every page rule. |
| `isReady` | `boolean` | The first build is live (core, SPEC §6.3) — the `ready` event has fired. (read-only) |
| `isDestroyed` | `boolean` | `destroy()` ran. (read-only) |
| `form` | `HTMLFormElement \| null` | The owning form (form-associated components). (read-only) |
| `validity` | `ValidityState` | Form validity (SPEC §6.6). (read-only) |
| `validationMessage` | `string` | Form validation message (SPEC §6.6). (read-only) |
| `willValidate` | `boolean` | Whether the element takes part in form validation. (read-only) |

## Display modes

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

Minimal inline display showing file count and total size. Click to open a popover with the full file list
(on a phone-width viewport, ≤ 600px, a full-screen sheet with a Close button — like the indicator drawer).

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

On `<web-dropzone-list>` (same model: the `on*` twin runs first with the same detail; the detail carries the BOUND STORE's `controller` / `element`, no data of its own):

| Event | Twin | Detail | When |
|---|---|---|---|
| `summary-activate` | `onSummaryActivate` | — (store context only) | Popover appearance: the summary line was activated (click / Enter / Space) |
| `queue-open` | `onQueueOpen` | — (store context only) | Rolling appearance: the queue badge was clicked |

 `file-row-update` (`{ file }`) is dispatched on the element a `renderFileItemCallback` returned (structural mode) — listen on that row.

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
| `renderLoadingCallback` | `{ component, context: 'upload', containerElement, element, label }` | fill `containerElement`; optional cleanup function — the indicator chip's upload loader (beats `window.components.renderLoadingCallback`) |
| `saveStateCallback` / `loadStateCallback` | `{ key, state }` (the WHOLE state) / `{ key }` | — / `DropzoneState \| null` (may be async) |

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

## Responsive rules

Tune any input per device class or window width without app-side viewport code — the shared
mechanism of `@keenmate/web-components-core`
([SPEC §6.7](https://github.com/keenmate/web-components-core/blob/main/docs/SPEC.md)). A **map** has
two axes, each keyed `mobile` / `tablet` / `desktop`:

- **`device`** — what the device *is* (touch capability first, then the short side): a phone is
  `mobile`, a touch tablet `tablet`; a mouse / trackpad machine is `desktop` at any width.
- **`breakpoint`** — the window width (the 768 / 1024 px lines): a narrowed desktop window is
  `mobile` below 768 px.

The breakpoint entry applies first, then the device entry over it (device wins on the same key).
Own widths or combinations (device AND width, orientation, …) go in a **callback** (`ctx` → partial
config). Both at three levels:

```js
// page-wide, every Keenmate component (unknown keys are skipped silently)
window.components.responsive = { device: { mobile: { /* … */ } } };
// every <web-dropzone> on the page
window.components['web-dropzone'].responsive = {
    device:     { mobile: { displayMode: 'compact', maxVisibleFileCount: 3 } },
    breakpoint: { mobile: { maxVisibleFileCount: 5 } },
};
window.components['web-dropzone'].responsiveCallback = ({ deviceClass, env }) =>
    deviceClass === 'tablet' && env.orientation === 'portrait' ? { displayMode: 'list' } : undefined;
// one instance (property, or the JSON attribute responsive='{"breakpoint":{"mobile":{…}}}')
el.responsive = { device: { tablet: { selectorAppearance: 'button' } } };
el.responsiveCallback = (ctx) => ({ /* … */ });
```

Precedence, later wins key by key: page map → page callback → per-tag map → per-tag callback →
**attributes / properties set on the instance** → instance map → instance callback. So
`<web-dropzone display-mode="list">` keeps `list` whatever the page rules say. Rules re-run when the
device class / breakpoint / orientation changes (callbacks also on every width change); overrides never reflect to attributes, and a key a
rule stops returning goes back to its base value. Per-tag rules may be set before the script loads
(`window.components = { 'web-dropzone': { responsive: … } }` is adopted). Types:
`DropzoneResponsiveMap`, `DropzoneResponsiveCallback`.

## File state

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
  downloadUrl?: string; // From the upload result
  metadata?: Record<string, unknown>; // What the upload handler stashed (ctx.setMetadata)
  uploadFileCallback?: FileUploadHandler;   // Per-file handler (a picker's upload routing)
  uploadMetadata?: Record<string, unknown>; // Per-file metadata (ctx.uploadMetadata)
}
```

## Form integration

`<web-dropzone>` is form-associated. With a `name`, the selected files are submitted with the
surrounding `<form>` as real `File` entries under that name — the same as `<input type="file" multiple>`:

```html
<form action="/upload" method="post" enctype="multipart/form-data">
  <web-dropzone name="attachments" min-file-count="1"></web-dropzone>
  <button type="submit">Send</button>
</form>
```

```javascript
form.addEventListener('submit', (e) => {
  const files = new FormData(form).getAll('attachments'); // File[]
});
```

- `min-file-count` is reflected into the form validity (`valueMissing`, message from the
  `errorMinFileCount` label) — the form refuses to submit a short selection; `checkValidity()`,
  `reportValidity()`, `validity`, `validationMessage` and `willValidate` are on the element.
- `disabled` (or an ancestor `<fieldset disabled>`) — nothing is submitted; `readonly` — the user
  can't change the selection, the files are still submitted.
- A form reset clears the selection.

## RTL

Full support for right-to-left languages:

```html
<web-dropzone dir="rtl"></web-dropzone>

<!-- Or inherited from parent -->
<div dir="rtl">
  <web-dropzone></web-dropzone>
</div>
```

## Satellites

`<web-dropzone>` is the **store** (files, validation, upload queue). The satellites are separate
renderer elements, each with its own shadow root, each bound to one store with `for="<store-id>"`:

| Element | What |
|---|---|
| `<web-dropzone-picker>` | Drag / click file selector → `store.addFiles` |
| `<web-dropzone-list>` | File list (`list` / `detailed` / `grid` / `badges` / `rolling` / `popover`) |
| `<web-dropzone-indicator>` | Floating status chip + slide-out drawer |
| `<web-dropzone-progress>` | Aggregate progress strip + bulk buttons |

Every satellite has exactly one `for=`; satellites never reference each other (a star around the
store). A store with no display attributes infers `render-mode="headless"` and renders nothing itself.

```html
<web-dropzone id="uploads" name="files" max-file-count="20"></web-dropzone>

<form>  … <web-dropzone-picker for="uploads" selector-appearance="button"></web-dropzone-picker> </form>
<aside> <web-dropzone-list for="uploads" list-appearance="detailed"></web-dropzone-list> </aside>
<web-dropzone-progress for="uploads"></web-dropzone-progress>
<web-dropzone-indicator for="uploads" position="right"></web-dropzone-indicator>
```

Binding:

- `for=` (property `htmlFor`, the platform's name for a `for` attribute) is resolved with
  `document.getElementById` when the satellite connects; the target must be a `<web-dropzone>`. A
  missing store logs a "store not found" warning. Order doesn't matter — a satellite that connects
  before the store builds waits for it. Changing `for` / `htmlFor` later re-binds to the new store.
- Inside another shadow root (where `getElementById` can't reach), bind in code:
  `satellite.bindToStore(storeEl)`.
- `satellite.controller` is the bound store's `DropzoneController` (`null` until bound). Satellites
  follow store rebuilds, and the page theme like the store (`data-context-theme`, `theme-source`).
- Bulk-mode `<web-dropzone>` builds its own UI from these same satellites (marked `managed`, so
  `--dz-*` set on `<web-dropzone>` cascades into them — see [theming.md](./theming.md)). They are
  separate elements with their own shadow roots: the store's `custom-styles` does **not** reach them
  (see [theming.md → Extra CSS](./theming.md#extra-css-for-the-shadow-root)).

Every satellite is a web-components-core `BlissElement`, so it works exactly like the store: one
input table per element (attribute ↔ property, parsed and validated in one place, live), removing an
attribute resets the input to its default, and an invalid value — an unknown enum value such as
`list-appearance="cards"` — is **refused**: a warning plus the core `input-rejected` event, and the
previous value stays (there is no silent fallback). From core every satellite also gets the `ready`
attribute / event / `:state(ready)` / `whenReady()`, `motion`, the theme context (`theme-source`),
`defer` / `release()`, `setAttributes()` / `batch()`, `destroy()`, a per-instance logger (its own level: `el.enableLogging()`)
and a `window.components['web-dropzone-picker']` (etc.) registry entry.

#### Shared inputs (every satellite)

| Attribute | Property | Type | Default | Description |
|---|---|---|---|---|
| `for` | `htmlFor` | `string \| null` |  | Id of the `<web-dropzone>` store to bind to. Changing it re-binds. Not needed when the store mounts the satellite itself. |
| `labels` | `labels` | `Partial<DropzoneLabels>` |  | The satellite's own UI strings (object, or a JSON attribute), merged per key over the bound store's `labels`, then the built-in English. Live. |
| `custom-styles` | `customStyles` | `string \| null` |  | Extra CSS for this satellite's shadow root (raw CSS — NOT sanitized). Comes after the page-wide `window.components[tag].customStyles`, so it overrides it. |
| — | `getCustomStylesCallback` | `(ctx) => string \| null \| undefined` |  | Returns extra CSS for this satellite's shadow root; wins over `customStyles`. |
| `defer`, `theme-source`, `motion`, `responsive` | `shouldDefer`, `themeSource`, `motion`, `responsive` (+ `responsiveCallback`) |  |  | Core inputs, as on `<web-dropzone>` (see [Attributes](#attributes)). |

(The first four rows are missing from the generated Custom Elements Manifest — its analyzer can't read
the imported spread — so IDE completion may not offer them; they work.)

### `<web-dropzone-picker>`

The shared inputs, plus:

| Attribute | Property | Values | Default | What |
|---|---|---|---|---|
| `selector-appearance` | `selectorAppearance` | `card` \| `button` \| `minimal` \| `native` | `card` | Selector appearance |
| `card-size` | `cardSize` | `minimal` \| `compact` \| `big` | `compact` | Card size for the card appearance |
| `accept` | `accept` | MIME types / extensions | the store's | File-dialog filter; the store still validates every file |
| `multiple` | `isMultiple` | `true` / `false` (tristate) | the store's | Single- vs multi-file dialog. Absent = follow the store |
| `icon` | `icon` | raw HTML | the store's | Prompt icon — see the [XSS notice](#html-injection-xss-notice) |
| `disabled` | `isDisabled` | boolean (presence) | `false` | Disable this picker like a native control: no clicks / drops, not focusable. Presence semantics — `disabled="false"` **is** disabled. A disabled store disables it too |
| `readonly` | `isReadonly` | boolean (presence) | `false` | Read-only: adds no files, but the control stays focusable (`aria-disabled="true"`) and never opens the file dialog. A read-only store makes it read-only too |
| `inside` | `isFilesInside` | boolean | `false` | Files-inside layout: the card slots its children — put a `<web-dropzone-list nested>` inside |
| `highlight-on-page-drag` | `shouldHighlightOnPageDrag` | `true` / `false` (tristate) | the store's | Arm while files are dragged over the page (`armed` + `:state(armed)`, `picker.isArmed`) |
| — | `uploadFileCallback` | `FileUploadHandler \| null` |  | Mode B: upload handler stamped onto every file this picker adds (wins over the store's for those files) |
| — | `uploadMetadata` | `Record<string, unknown> \| null` |  | Mode B: metadata stamped onto every file this picker adds (`ctx.uploadMetadata`) |

Picker strings (`labels`): `prompt`, `selectFiles`, `hint`, `noFileChosen`, `filesChosen`,
`dragActive`. Method: `openFileDialog()` (no-op while disabled / read-only / unbound; calls from code
such as `picker.controller.addFiles()` still work). The picker never rejects files itself; it calls
`store.addFiles(files, opts)`.

### `<web-dropzone-list>`

The shared inputs, plus:

| Attribute | Property | Values | Default | What |
|---|---|---|---|---|
| `list-appearance` | `listAppearance` | `list` \| `detailed` \| `grid` \| `badges` \| `rolling` \| `popover` | `list` | List appearance |
| `grid-layout` | `gridLayout` | `uniform` \| `natural` | `uniform` | Tile layout of the grid appearance |
| `grid-status` | `gridStatus` | `badge` \| `overlay` | `badge` | How finished grid tiles are flagged |
| `nested` | `isNested` | boolean | `false` | Files-inside class family (child of a picker with `inside`) |

Reads from the store: `item-controls`, `max-visible-file-count`, `sink-completed`, `show-thumbnails`,
`allow-uploaded-file-removal`, `labels`, `cancel-icon` / `remove-icon`, `fileIcons` /
`getFileIconCallback`. Row buttons call the store's API through its controller and run the same gates.

Events (on the list element; bubble, not composed; each has an `on*` twin called first with the same
detail; the detail carries the store's `controller` / `element`): `summary-activate` / `onSummaryActivate`
(popover appearance — the summary line was activated by click / Enter / Space; the standalone list owns
no popover, open your own UI here) and `queue-open` / `onQueueOpen` (rolling appearance — the queue
button was clicked).

### `<web-dropzone-progress>`

Only the shared inputs. An aggregate bar + counts ("3 of 5 · 1.2 MB / 4.0 MB · 1 paused · 2 failed") +
percent + bulk buttons: **Pause all** / **Resume all** / **Cancel all** (when the store has an
`uploadFileCallback` and something is uploading / paused / queued) and **Retry all** (any file failed).
Hides itself when there is no activity (`data-empty="true"`); host attribute `data-status` =
`uploading` / `paused` / `error` / `complete`; shadow part `::part(root)`.

### `<web-dropzone-indicator>`

The shared inputs, plus:

| Attribute | Property | Values | Default | What |
|---|---|---|---|---|
| `position` | `position` | `right` \| `left` \| `top` \| `bottom` \| `inline` | `right` | Fixed to a viewport edge, or inline in the flow |
| `drawer` | `drawer` | `auto` \| `off` | `auto` | `auto`: the chip is a button toggling a slide-out drawer (`role="dialog"`) with the file list; `off`: a non-interactive `role="status"` chip |
| — | `renderBodyCallback` | `StatusSurfaceCallback \| null` |  | Replace the whole chip body; `false` hides the chip |
| — | `renderFileInfoCallback` | `StatusSurfaceCallback \| null` |  | Replace the chip's file-info slot (default body only) |
| — | `renderProgressCallback` | `StatusSurfaceCallback \| null` |  | Replace the chip's progress slot (default body only) |

Indicator strings (`labels`): `indicatorTitle`, `indicatorIdle`, `indicatorStatus` / `indicatorQueue`
(aria), `close`, `indicatorFailed` / `…Uploading` / `…Paused` / `…Queued` / `…Done`.
Host attributes `data-position`, `data-drawer`, `data-drawer-open`; shadow parts `::part(chip)`,
`::part(drawer)`. The chip hides while a non-inline drawer is open; on a phone-width viewport the
drawer is a full-screen sheet. The drawer embeds a `<web-dropzone-list>` (style it with
`window.components['web-dropzone-list'].customStyles`). The callbacks follow the status-surface
contract below.

### Status-surface contract

The indicator's callbacks and `<web-dropzone>`'s `renderRolling{Body,FileInfo,Progress}Callback`
share one shape: `(args: StatusSurfaceArgs) => string | HTMLElement | false | null | undefined`.
`args`: `currentFile` (first uploading / cancelling, else first pending, else first paused / error /
cancelled, else the last file), `currentFilePercent`, `currentFileStatus`, `aggregate`
(`{ total, uploading, paused, pending, complete, error, cancelled, overallStatus }`),
`overallPercent` (byte-weighted, rounded), `overallStatus`, `files`, plus `controller` / `element`.
Returns: `null` / `undefined` = the library default; `false` = hide; a string = `innerHTML` (skipped
when equal to the last one); an `HTMLElement` = mounted (skipped when already the slot's only child).

## Logging

Every element of the family logs through one categorized bundle, `DROPZONE` (categories `INIT`,
`FILE`, `UI`, `INTERACTION`; web-components-core logging). Like every Keenmate component it prints
**warnings and errors by default** and follows the page-wide switch `window.components.logging`;
nothing is silenced at load. The closest level wins: element → component type → page → `warn`.

```js
const logging = window.components['web-dropzone'].logging;   // the same bundle on every dropzone tag
logging.enableLogging();                    // debug, every category
logging.setCategoryLevel('UI', 'debug');    // one category ('DROPZONE:UI' works too)
logging.disableLogging();                   // silent
logging.resetLogging();                     // follow the page level again
logging.getCategories();                    // ['INIT', 'FILE', 'UI', 'INTERACTION']

window.components.logging.enableLogging('debug');   // every Keenmate component on the page
dropzone.enableLogging('debug');                    // one element only (closest level wins)
```

The same controls are exported for bundlers: `enableLogging`, `disableLogging`, `resetLogging`,
`setLogLevel`, `setCategoryLevel` and `LOGGING_CATEGORIES` (the prefixed names, `'DROPZONE:INIT'` …).

## Lifecycle

- **Ready.** `ready` fires once after the first build (`el.controller` is live) — plus the `ready`
  attribute, `:state(ready)`, `isReady` and `await el.whenReady()`. A rebuild or a DOM move doesn't
  fire it again.
- **Defer.** `defer` (or `shouldDefer`) holds the first build until `release()` (or removing the
  attribute) — set everything first, build once.
- **Batching.** `el.setAttributes({ … })` / `el.batch(() => { … })` apply many inputs as one rebuild;
  property writes are coalesced on a microtask anyway. `await el.whenSettled()` resolves once they
  are applied; methods apply pending writes themselves.
- **Removal vs move.** A DOM move (re-parent / reorder) keeps everything. Removing `<web-dropzone>`
  from the page cancels its uploads gracefully and destroys the store; re-adding it builds a fresh,
  empty store. `keep-alive-when-removed` opts out.
- **Destroy.** `destroy()` is the final teardown: running uploads abort at once, the form value is
  cleared, and the element is inert afterwards.
