# E2E Test Coverage Checklist

Tracks which features of `@keenmate/web-dropzone` have end-to-end test coverage
in `e2e/`. Each row is one user-observable feature. Status legend:

- `✗` — no coverage
- `△` — partial coverage (some paths)
- `✓` — covered

When a row is marked `✓`/`△`, the **Spec** column points at the file under
`e2e/` that exercises it, and **Fixture** at the dedicated HTML page under
`test/` (specs hit no example pages, only fixtures).

---

## 1. Selector appearance

| Feature                                                       | Status | Spec             | Fixture       |
| ------------------------------------------------------------- | :----: | ---------------- | ------------- |
| `selector-appearance="card"` (default)                        | ✓      | `display.spec.ts` | `display.html` |
| `selector-appearance="button"`                                | ✓      | `display.spec.ts` | `display.html` |
| `selector-appearance="minimal"`                               | ✓      | `display.spec.ts` | `display.html` |
| `selector-appearance="native"`                                | ✓      | `display.spec.ts` | `display.html` |
| `labels.noFileChosen` empty-state label                       | ✓      | `display.spec.ts` | `display.html` |
| `labels.selectFiles` button label across variants             | ✓      | `appearance.spec.ts` | `appearance.html` |
| `card-size="minimal" \| "compact" \| "big"`                   | ✓      | `appearance.spec.ts` | `appearance.html` |
| `icon` attribute on minimal selector                          | ✓      | `display.spec.ts` | `display.html` |
| Count badge on button when files exist                        | ✓      | `appearance.spec.ts` | `appearance.html` |
| Count badge on minimal when files exist (follows remove / clear) | ✓   | `appearance.spec.ts` | `appearance.html` |
| `labels.prompt` / `labels.hint` / `labels.noData` + live update | ✓      | `display.spec.ts` | `display.html` |
| `labels.overlay` / `overlay-icon` + live update               | ✓      | `display.spec.ts` | `display.html` |
| `multiple` default / `multiple="false"` / `el.isMultiple` live on the native input + dialog | ✓ | `display.spec.ts` | `display.html` |

## 2. List appearance

| Feature                                                       | Status | Spec           | Fixture     |
| ------------------------------------------------------------- | :----: | -------------- | ----------- |
| `list-appearance="list"` (default)                            | ✓      | `list.spec.ts` | `list.html` |
| `list-appearance="detailed"`                                  | ✓      | `list.spec.ts` | `list.html` |
| `list-appearance="grid"` (image thumbnails)                   | ✓      | `list.spec.ts` | `list.html` |
| `list-appearance="badges"`                                    | ✓      | `list.spec.ts` | `list.html` |
| `list-appearance="badges"` + `show-thumbnails`                | ✓      | `list-extra.spec.ts` | `list-extra.html` |
| `list-appearance="popover"` summary + popover open + rows     | ✓      | `list-extra.spec.ts` | `list-extra.html` |
| `list-appearance="rolling"`                                   | ✓      | `list-extra.spec.ts` | `list-extra.html` |
| `rolling-rotation` slide-in / vertical (leaving row) / live change | ✓   | `list-extra.spec.ts` | `list-extra.html` |
| Rolling render callbacks (body: markup / false / null; file-info + progress slots) | ✓ | `list-extra.spec.ts` | `list-extra.html` |
| `list-appearance="none"`                                      | ✓      | `list.spec.ts` | `list.html` |
| `max-visible-file-count` "Show N more" toggle (satellite renderer) | ✓      | `list.spec.ts` | `list.html` |
| `--dz-file-list-max-height` (works through satellite)         | ✓      | `list-extra.spec.ts` | `list-extra.html` |
| `files-inside` layout                                         | ✓      | `list.spec.ts` | `list.html` |
| `grid-layout="natural"` (equal-height justified rows)         | ✓      | `list-extra.spec.ts` | `list-extra.html` |
| `grid-status="overlay"` (finished-tile veil + glyph)          | ✓      | `list-extra.spec.ts` | `list-extra.html` |
| Legacy `display-mode` shorthand → orthogonal axes             | ✓      | `appearance.spec.ts` | `appearance.html`  |
| Orthogonal attr overrides `display-mode` shorthand            | ✓      | `appearance.spec.ts` | `appearance.html`  |


## 3. Validation

| Feature                                                       | Status | Spec                 | Fixture            |
| ------------------------------------------------------------- | :----: | -------------------- | ------------------ |
| `max-file-size` rejects with code="size"                      | ✓      | `validation.spec.ts` | `validation.html`  |
| `min-file-size` rejects sub-threshold files                   | ✓      | `validation-rules.spec.ts` | `validation-rules.html` |
| `max-total-size` aggregate cap                                | ✓      | `validation-rules.spec.ts` | `validation-rules.html` |
| `max-file-count` rejects with code="count"                    | ✓      | `validation.spec.ts` | `validation.html`  |
| `min-file-count` form-validity gate (setValidity)             | ✓      | `validation-rules.spec.ts` | `validation-rules.html` |
| `accept` MIME / extension filter (code="type")                | ✓      | `validation.spec.ts` | `validation.html`  |
| `validateCallback` (custom sync rule)                         | ✓      | `validation.spec.ts` | `validation.html`  |
| Duplicate detection — `dedupe-mode="name"` (default)          | ✓      | `validation-rules.spec.ts` | `validation-rules.html` |
| `dedupe-mode="none"` allows duplicates                        | ✓      | `validation-rules.spec.ts` | `validation-rules.html` |
| `dedupe-mode="name-size"` (across adds and within one batch)  | ✓      | `validation-rules.spec.ts` | `validation-rules.html` |
| `accept=".pdf,.docx"` extension list, case-insensitive        | ✓      | `validation-rules.spec.ts` | `validation-rules.html` |
| One batch → one `file-reject` with mixed codes (type/size/count) | ✓  | `validation-rules.spec.ts` | `validation-rules.html` |
| `beforeFilesAddCallback` async gate (accept)                | ✓      | `gates.spec.ts`      | `gates.html`       |
| `beforeFilesAddCallback` async gate (cancel, code='cancelled') | ✓   | `gates.spec.ts`      | `gates.html`       |
| `beforeFilesAddCallback` receives ctx `{ files, existingFiles }` | ✓      | `gates.spec.ts`      | `gates.html`       |
| `beforeFilesRemoveCallback` accepts removal via `{ confirm: true }` | ✓ | `gates.spec.ts`     | `gates.html`       |
| `beforeFilesRemoveCallback` rejects removal — file stays     | ✓      | `gates.spec.ts`      | `gates.html`       |
| Programmatic `removeFile()` skips the gate by default          | ✓      | `gates.spec.ts`      | `gates.html`       |

## 4. Events & API

| Feature                                                       | Status | Spec             | Fixture       |
| ------------------------------------------------------------- | :----: | ---------------- | ------------- |
| `file-add` fires with `{ file }`-only detail                | ✓      | `events.spec.ts` | `events.html` |
| `file-remove` fires with `{ file }`-only detail              | ✓      | `events.spec.ts` | `events.html` |
| `change` fires with empty detail (native input convention)    | ✓      | `events.spec.ts` | `events.html` |
| `files-change` rAF-coalesces a multi-file batch              | ✓      | `events.spec.ts` | `events.html` |
| `file-reject` carries grouped rejections                   | ✓      | `validation.spec.ts`, `validation-rules.spec.ts` | `validation.html`, `validation-rules.html` |
| `file-progress` / `file-status-change` during upload         | ✓      | `upload.spec.ts` | `upload.html`  |
| `file-update` after handler post-merges metadata             | ✓      | `events-extra.spec.ts` | `events-extra.html` |
| `file-delete` only for files with server state (with `file-remove`; `clear()` too) | ✓ | `events-extra.spec.ts` | `events-extra.html` |
| `setMetadata` → server state + `ctx.metadata` on resume        | ✓      | `events-extra.spec.ts` | `events-extra.html` |
| `controller.addFiles(files, { uploadMetadata })` → `ctx.uploadMetadata` | ✓ | `events-extra.spec.ts` | `events-extra.html` |
| `file-row-update` on element-returning row callbacks (initial) | ✓     | `structural.spec.ts` | `structural.html` |
| `file-row-update` on progress ticks (listener survival)       | ✓      | `events-extra.spec.ts` | `events-extra.html` |
| `overlay-enter` / `overlay-leave` during drag (Playwright limit) | △    | `drag-overlay.spec.ts` | `drag-overlay.html` |
| `el.target.files` snapshot in sync at dispatch                | ✓      | `events.spec.ts` | `events.html` |
| Public methods: `addFiles`, `removeFile`, `removeFiles` (batch, gate once), `clear` | ✓      | `api.spec.ts`    | `api.html`    |
| Public method: `getFile(id)` / `getFile(missing)`             | ✓      | `api.spec.ts`    | `api.html`    |
| Public methods: `pauseFile` / `cancelFile`                    | ✓      | `api.spec.ts`    | `api.html`    |
| Public methods: `resumeFile`, `retryFile`                     | ✓      | `upload-edge.spec.ts` | `upload-edge.html` |
| Public methods: `pauseAll`, `resumeAll`, `retryAll`           | ✓      | `upload-edge.spec.ts` | `upload-edge.html` |
| `uploadAll` returns + drives worker pool                      | ✓      | `api.spec.ts`    | `api.html`    |
| `controller.getFiles()` returns mutable copy                  | ✓      | `api.spec.ts`    | `api.html`    |
| `controller.getConfig()` returns merged config                | ✓      | `api.spec.ts`    | `api.html`    |
| `controller.getOverallProgress()` aggregate                   | ✓      | `api.spec.ts`    | `api.html`    |
| `el.controller` is a DropzoneController (method signatures)  | ✓      | `api.spec.ts`    | `api.html`    |
| `.files` getter on host element                               | ✓      | `api.spec.ts`    | `api.html`    |
| `uploadFile(id)` bypasses the concurrency cap; no duplicate run | ✓     | `api.spec.ts`    | `api.html`    |
| `destroy()` aborts in-flight uploads, tears the UI down        | ✓     | `api.spec.ts`    | `api.html`    |

## 5. Upload pipeline

| Feature                                                       | Status | Spec             | Fixture       |
| ------------------------------------------------------------- | :----: | ---------------- | ------------- |
| `uploadFileCallback` runs on auto-upload                      | ✓      | `upload.spec.ts` | `upload.html` |
| `auto-upload="false"` keeps files pending                     | ✓      | `upload.spec.ts` | `upload.html` |
| `uploadAll()` starts queued files after auto-upload=false     | ✓      | `upload.spec.ts` | `upload.html` |
| Handler resolves → status flips to `complete`                 | ✓      | `upload.spec.ts` | `upload.html` |
| Handler rejects → status flips to `error`                     | ✓      | `upload.spec.ts` | `upload.html` |
| `concurrency` cap holds N workers active                      | ✓      | `upload.spec.ts` | `upload.html` |
| Worker slot rotates on completion                             | ✓      | `upload.spec.ts` | `upload.html` |
| A file added mid-drain takes a free slot                      | ✓      | `upload.spec.ts` | `upload.html` |
| `file-progress` event fires per onProgress() pump             | ✓      | `upload.spec.ts` | `upload.html` |
| `file-status-change` event fires per status transition       | ✓      | `upload.spec.ts` | `upload.html` |
| Resume from `context.startBytes` / `startPercent` after pause | ✓      | `upload-edge.spec.ts` | `upload-edge.html` |
| Retry from error re-invokes the handler                       | ✓      | `upload-edge.spec.ts` | `upload-edge.html` |
| Per-row Pause / Resume / Retry buttons cycle status (UI path) | ✓      | `row-actions.spec.ts` | `row-actions.html` |
| ⊘ Cancel (uploading / queued / paused; row stays) vs ✕ Remove (always; running → cancel, then remove) | ✓ | `row-actions.spec.ts` | `row-actions.html` |
| ⊘ asks `beforeFilesCancelCallback`; ✕ asks `beforeFilesRemoveCallback` | ✓ | `row-actions.spec.ts` | `row-actions.html` |
| ⊘ / ✕ aria-labels "Cancel / Remove <file>"; ⊘ hidden when nothing to cancel (plain picker too); keyboard Tab + Enter | ✓ | `row-actions.spec.ts` | `row-actions.html` |
| `cancel-icon` / `remove-icon` HTML glyphs (+ live change)      | ✓      | `row-actions.spec.ts` | `row-actions.html` |
| ⊘ / ✕ in the list satellite and popover rows                   | ✓      | `row-actions.spec.ts` | `row-actions.html` |
| Cancelled row offers Retry                                    | ✓      | `row-actions.spec.ts` (NOTES #8 fixed) | `row-actions.html` |
| `retryPolicy` attempts / delayMs / backoff → complete or error | ✓     | `upload-edge.spec.ts` | `upload-edge.html` |
| `retryPolicy` retry aborted when paused during the backoff     | ✓     | `upload-edge.spec.ts` | `upload-edge.html` |
| Auto-retry silent outside `/logging`                          | ✓      | `upload-edge.spec.ts` (NOTES #2 fixed) | `upload-edge.html` |
| `allow-uploaded-file-removal="false"` hides ✕ on completed rows        | ✓      | `upload-edge.spec.ts` (NOTES #6 fixed) | `upload-edge.html` |
| `sink-completed-delay` — row moves only after the delay    | ✓      | `upload-edge.spec.ts` (NOTES #7 fixed) | `upload-edge.html` |
| `progress-throttle` caps emission rate                        | ✓      | `upload-edge.spec.ts` | `upload-edge.html` |
| `sink-completed` reflows completed files               | ✓      | `upload-edge.spec.ts` (DOM order: the sink-completed-delay test) | `upload-edge.html` |
| `progress-mode="pessimistic"` preserves progress on failure   | ✓      | `upload-edge.spec.ts` | `upload-edge.html` |
| Resume-aware progress on `file-progress`                      | △      | `upload-edge.spec.ts` | `upload-edge.html` |

## 6. Structural mode (`render-mode="structural"`)

| Feature                                                       | Status | Spec                | Fixture           |
| ------------------------------------------------------------- | :----: | ------------------- | ----------------- |
| `renderPromptCallback` overrides card content                 | ✓      | `structural.spec.ts` | `structural.html` |
| `renderFileItemCallback` (string return)                      | ✓      | `structural.spec.ts` | `structural.html` |
| `renderFileItemCallback` (HTMLElement return + file-row-update) | ✓    | `structural.spec.ts` | `structural.html` |
| `renderListWrapperCallback` (table layout)                    | ✓      | `structural.spec.ts` | `structural.html` |
| `renderSummaryCallback` (popover summary)                     | ✓      | `events-extra.spec.ts` | `events-extra.html` |
| Callbacks ignored when `mode!="structural"` (hard switch)     | ✓      | `structural.spec.ts` | `structural.html` |
| A `"` in `accept` / `labels.prompt` is escaped (structural + picker) | ✓ | `structural.spec.ts` (NOTES #15) | dynamic |

## 7. Architecture (satellites + headless)

| Feature                                                       | Status | Spec                   | Fixture             |
| ------------------------------------------------------------- | :----: | ---------------------- | ------------------- |
| `<web-dropzone-picker for=>` binds to store                   | ✓      | `architecture.spec.ts` | `architecture.html` |
| `<web-dropzone-list for=>` binds to store                     | ✓      | `architecture.spec.ts` | `architecture.html` |
| `<web-dropzone-list>` reflects programmatic adds              | ✓      | `architecture.spec.ts` | `architecture.html` |
| `<web-dropzone-indicator for=>` binds + renders chip          | ✓      | `satellites-extra.spec.ts` | `satellites-extra.html` |
| `<web-dropzone-progress for=>` binds + renders surface        | ✓      | `satellites-extra.spec.ts` | `satellites-extra.html` |
| `render-mode="headless"` skips internal rendering                    | ✓      | `architecture.spec.ts` | `architecture.html` |
| `render-mode="headless"` still fires every event                     | ✓      | `architecture.spec.ts` | `architecture.html` |
| Multiple pickers contribute to one store (Mode A: shared)     | ✓      | `architecture.spec.ts` | `architecture.html` |
| Multiple independent stores on one page                       | ✓      | `architecture.spec.ts` | `architecture.html` |
| Picker `label` / `hint` / `selector-appearance` / `disabled` (per picker) | ✓ | `satellites-extra.spec.ts` | `satellites-extra.html` |
| Picker `inside="true"` + nested list (files-inside layout)    | ✓      | `satellites-extra.spec.ts` | `satellites-extra.html` |
| List own `labels.noData`, `list-appearance` (+ live change)     | ✓      | `satellites-extra.spec.ts` | `satellites-extra.html` |
| Indicator `position` / `drawer` (auto toggles, off = status chip) / `label` | ✓ | `satellites-extra.spec.ts` | `satellites-extra.html` |
| Progress `data-empty` / `data-status` (uploading → paused → error → complete) | ✓ | `satellites-extra.spec.ts` | `satellites-extra.html` |

## 8. Drag overlay

| Feature                                                       | Status | Spec                  | Fixture            |
| ------------------------------------------------------------- | :----: | --------------------- | ------------------ |
| Overlay NOT mounted at rest                                   | ✓      | `drag-overlay.spec.ts` | `drag-overlay.html` |
| `overlay-target` (id) mounts the overlay over the target on a file dragenter | ✓ | `drag-overlay.spec.ts` | `drag-overlay.html` |
| Non-file drag does not mount the overlay                      | ✓      | `drag-overlay.spec.ts` | `drag-overlay.html` |
| `overlay-enter` / `overlay-leave` + hover class               | ✓      | `drag-overlay.spec.ts` | `drag-overlay.html` |
| Drop on the overlay adds the files, overlay removed           | ✓      | `drag-overlay.spec.ts` | `drag-overlay.html` |
| Escape / dragover-heartbeat timeout close the overlay         | ✓      | `drag-overlay.spec.ts` | `drag-overlay.html` |
| Two overlays don't steal each other's drags (both close on drop) | ✓   | `drag-overlay.spec.ts` | `drag-overlay.html` |
| `overlayTarget` property as an HTMLElement                    | ✓      | `drag-overlay.spec.ts` | `drag-overlay.html` |
| `overlay-target="#id"` (documented selector form)             | ✓      | `drag-overlay.spec.ts` (NOTES #1 fixed) | `drag-overlay.html` |

> Drags are synthetic: a constructed `DataTransfer` carrying real `File`
> objects reports `types` including `"Files"` in Chromium, so
> `page.evaluate` → `dispatchEvent(new DragEvent(...))` exercises the real
> overlay code path (fixture helper `window.__drag`).

## 9. Form integration

| Feature                                                       | Status | Spec           | Fixture     |
| ------------------------------------------------------------- | :----: | -------------- | ----------- |
| `name` attribute submits real `File` blobs in FormData        | ✓      | `form.spec.ts` | `form.html` |
| Zero-files → no FormData entry under the configured name      | ✓      | `form.spec.ts` | `form.html` |
| `form.reset()` clears selection (formResetCallback)           | ✓      | `form.spec.ts` | `form.html` |
| Unnamed dropzone → no FormData entry at all                   | ✓      | `form.spec.ts` | `form.html` |
| `min-file-count` blocks form submit via setValidity           | ✓      | `validation-rules.spec.ts` | `validation-rules.html` |
| `el.form` resolves the owning `<form>` (even unnamed)         | ✓      | `form-delegation.spec.ts` | `form.html` |
| Delegated `change` listener resolves `event.target.form`      | ✓      | `form-delegation.spec.ts` | `form.html` |
| Dropzone outside any `<form>` → `el.form === null`            | ✓      | `form-delegation.spec.ts` | `form.html` |
| `value-format` changes the submitted shape                    | ✗      | — NOTES.md #3 (no-op)  |             |

## 10. Theming

| Feature                                                       | Status | Spec              | Fixture        |
| ------------------------------------------------------------- | :----: | ----------------- | -------------- |
| `--dz-rem` value lands on the host element                    | ✓      | `theming.spec.ts` | `theming.html` |
| `--dz-rem` propagates through satellite shadow (icon scales)  | ✓      | `theming.spec.ts` | `theming.html` |
| Individual `--dz-*` override on the host                      | ✓      | `theming.spec.ts` | `theming.html` |
| `--base-*` integration variables readable on the host         | ✓      | `theming.spec.ts` | `theming.html` |
| Disabled host carries `dz__dropzone--disabled` modifier       | ✓      | `theming.spec.ts` | `theming.html` |
| Disabled host still accepts programmatic addFiles             | ✓      | `theming.spec.ts` | `theming.html` |
| RTL (`dir="rtl"`) on parent inherits to the host              | ✓      | `theming.spec.ts` | `theming.html` |
| Theme context: no page signal → inherits page, no `data-context-theme` | ✓ | `theme-context.spec.ts` | `theme-context.html` |
| Theme context: `<html data-theme / data-bs-theme / .dark>` → dark (host + satellites) | ✓ | `theme-context.spec.ts` | `theme-context.html` |
| Theme context: light page signal beats OS dark; per-instance `data-theme` wins; live switch | ✓ | `theme-context.spec.ts` | `theme-context.html` |


## 11. Logging

| Feature                                                       | Status | Spec              | Fixture        |
| ------------------------------------------------------------- | :----: | ----------------- | -------------- |
| Global API `window.components['web-dropzone']` exists         | ✓      | `logging.spec.ts` | `logging.html` |
| `config.name` / `config.version` from package.json            | ✓      | `logging.spec.ts` | `logging.html` |
| `config.core.{name, version}` exposes both packages           | ✓      | `logging.spec.ts` | `logging.html` |
| `version()` matches `config.version`                          | ✓      | `logging.spec.ts` | `logging.html` |
| `getInstances()` returns mounted host elements                | ✓      | `logging.spec.ts` | `logging.html` |
| `logging.setLogLevel / setCategoryLevel / getCategories`      | ✓      | `logging.spec.ts` | `logging.html` |

## 12. Interaction model (events, twins, controller, ctx)

| Feature                                                       | Status | Spec                          | Fixture                   |
| ------------------------------------------------------------- | :----: | ----------------------------- | ------------------------- |
| Present-tense events; `on*` twin runs first with the same detail | ✓   | `interaction-model.spec.ts`   | `interaction-model.html`  |
| Events not composed, still bubble to `document`; old names never fire | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |
| Details / ctx carry `controller` + `element`, non-enumerable  | ✓      | `interaction-model.spec.ts`   | `interaction-model.html`  |
| `change` detail `{ files }`; `file-reject` / `file-retry` / `file-status-change` context | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |
| core `ready` (+ twin) once on build; `ready` attr + `:state(ready)`; `controller.isReady` | ✓      | `interaction-model.spec.ts`   | `interaction-model.html`  |
| `el.controller` stable across a rebuild; no `getStore` / engine | ✓     | `interaction-model.spec.ts`   | `interaction-model.html`  |
| `beforeFilesAddCallback` — `false` cancels, `File[]` replaces, nothing continues | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |
| `beforeFilesRemoveCallback` via row ✕ (`data-dz-action="remove"`) | ✓   | `interaction-model.spec.ts`   | `interaction-model.html`  |
| `validateCallback` / `getFileIconCallback` / `getCustomStylesCallback` ctx | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |
| `uploadFileCallback(ctx)` + `file-upload` twin       | ✓      | `interaction-model.spec.ts`   | `interaction-model.html`  |
| Structural render callbacks ctx; `file-row-update` not composed | ✓     | `interaction-model.spec.ts`   | `interaction-model.html`  |
| `renderRollingBodyCallback` settable as an element input      | ✓      | `interaction-model.spec.ts`   | `interaction-model.html`  |
| `renderSummaryCallback` + `loadStateCallback` ctx             | ✓      | `interaction-model.spec.ts`   | `interaction-model.html`  |
| Picker `uploadFileCallback`; list `summary-activate` / `queue-open` carry store context | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |
| Element unit: controller defaults, `ready` twin, add / change twins | ✓  | `packages/web-dropzone/test/unit/interaction.test.ts` | — |

## 13. Drop onto the dropzone

| Feature                                                       | Status | Spec          | Fixture     |
| ------------------------------------------------------------- | :----: | ------------- | ----------- |
| dragenter → `dz__dropzone--active`; dragover accepted; dragleave clears | ✓ | `drop.spec.ts` | `drop.html` |
| `labels.dragActive` replaces the prompt during a drag         | ✓      | `drop.spec.ts` | `drop.html` |
| Drop adds files (`file-add` per file, one `change`)           | ✓      | `drop.spec.ts` | `drop.html` |
| Dropped files run validation (type + count rejects)           | ✓      | `drop.spec.ts` | `drop.html` |
| Button appearance is a drop target                            | ✓      | `drop.spec.ts` | `drop.html` |

## 14. Disabled

| Feature                                                       | Status | Spec              | Fixture         |
| ------------------------------------------------------------- | :----: | ----------------- | --------------- |
| `disabled`: modifier class, native input + button disabled    | ✓      | `disabled.spec.ts` | `disabled.html` |
| Disabled: click opens no dialog; drop adds nothing; no overlay | ✓     | `disabled.spec.ts` | `disabled.html` |
| `el.isDisabled` (reflected) / attribute toggle is reactive (both directions) | ✓     | `disabled.spec.ts` | `disabled.html` |
| `<fieldset disabled>` disables the dropzone                   | ✓      | `disabled.spec.ts` (NOTES #5 fixed) | `disabled.html` |
| Fieldset re-enabled → usable; author `disabled` survives it   | ✓      | `disabled.spec.ts` | `disabled.html` |

## 15. Reactivity after build

| Feature                                                       | Status | Spec                | Fixture           |
| ------------------------------------------------------------- | :----: | ------------------- | ----------------- |
| `max-file-count` set after build applies; removal → unlimited | ✓      | `reactivity.spec.ts` | `reactivity.html` |
| `maxFileCount` property reactive + reflects                   | ✓      | `reactivity.spec.ts` | `reactivity.html` |
| `accept` changed after build (validation + native input)      | ✓      | `reactivity.spec.ts` | `reactivity.html` |
| `list-appearance` change re-renders, keeps files              | ✓      | `reactivity.spec.ts` | `reactivity.html` |
| Mode flip (headless → bulk) rebuilds, `ready` NOT re-fired; `render-mode="headless"` drops the UI | ✓ | `reactivity.spec.ts` | `reactivity.html` |
| `overlay-target` set after build                              | ✓      | `reactivity.spec.ts` | `reactivity.html` |

## 16. Bulk actions (overall-progress strip + popover header)

| Feature                                                       | Status | Spec             | Fixture        |
| ------------------------------------------------------------- | :----: | ---------------- | -------------- |
| Pause all / Resume all / Retry all visibility follows state   | ✓      | `toolbar.spec.ts` | `toolbar.html` |
| Pause all → all paused; Resume all → handler re-invoked       | ✓      | `toolbar.spec.ts` | `toolbar.html` |
| Retry all (failed + cancelled) re-runs to completion          | ✓      | `toolbar.spec.ts` | `toolbar.html` |
| Retry all runs in parallel up to `concurrency`                | ✓      | `toolbar.spec.ts` (NOTES #9 fixed) | `toolbar.html` |
| No pipeline → no Pause / Resume all                           | ✓      | `toolbar.spec.ts` | `toolbar.html` |
| Popover Clear all (gate honoured, popover closes)             | ✓      | `toolbar.spec.ts` | `toolbar.html` |
| Popover Add more opens the file dialog                        | ✓      | `toolbar.spec.ts` (NOTES #10 fixed) | `toolbar.html` |
| Disabled: Add more hidden, Clear all kept                     | ✓      | `toolbar.spec.ts` | `toolbar.html` |
| Button/minimal + popover: click toggles the popover           | ✗      | `toolbar.spec.ts` (test.fail NOTES #11) | `toolbar.html` |

## 17. Lifecycle (DOM move — decision D1: keep state)

| Feature                                                       | Status | Spec               | Fixture          |
| ------------------------------------------------------------- | :----: | ------------------ | ---------------- |
| Re-parent keeps queued files                                  | ✓      | `lifecycle.spec.ts` (NOTES #4 fixed) | `lifecycle.html` |
| Re-parent keeps an in-flight upload (completes after the move) | ✓     | `lifecycle.spec.ts` (NOTES #4 fixed) | `lifecycle.html` |
| A move doesn't rebuild (`ready` once)                         | ✓      | `lifecycle.spec.ts` (NOTES #4 fixed) | `lifecycle.html` |
| Re-parent keeps an open popover; Escape / outside click still close it | ✓ | `lifecycle.spec.ts` | `lifecycle.html` |
| Detached: popover's document listeners are off                | ✓      | `lifecycle.spec.ts` | `lifecycle.html` |
| After a move: drops work, controller live                     | ✓      | `lifecycle.spec.ts` | `lifecycle.html` |
| Moved overlay dropzone: one overlay; removed one: none        | ✓      | `lifecycle.spec.ts` | `lifecycle.html` |

## 18. Allowlists (`controls` / `item-controls`)

| Feature                                                       | Status | Spec              | Fixture         |
| ------------------------------------------------------------- | :----: | ----------------- | --------------- |
| `controls` unset / subset / unknown tokens ignored            | ✓      | `controls.spec.ts` | `controls.html` |
| `controls` change after build remounts surfaces               | ✓      | `controls.spec.ts` | `controls.html` |
| `item-controls` renders only the listed row parts (+ live)    | ✓      | `controls.spec.ts` | `controls.html` |

## 19. Persistence (`storage-key`)

| Feature                                                       | Status | Spec                 | Fixture            |
| ------------------------------------------------------------- | :----: | -------------------- | ------------------ |
| Popover resize writes `dz-state:<key>` to localStorage        | ✓      | `persistence.spec.ts` | `persistence.html` |
| Reload restores the popover size                              | ✓      | `persistence.spec.ts` | `persistence.html` |
| No `storage-key` → nothing written                            | ✓      | `persistence.spec.ts` | `persistence.html` |
| `persistStateCallback({ key, state })` / `loadStateCallback({ key })` | ✓ | `persistence.spec.ts` | `persistence.html` |

## 20. Popover (compact)

| Feature                                                       | Status | Spec             | Fixture        |
| ------------------------------------------------------------- | :----: | ---------------- | -------------- |
| Default placement bottom-start; `popover-placement="top-end"` | ✓      | `popover.spec.ts` | `popover.html` |
| Escape / outside click close; inside click stays; summary toggles; Enter opens | ✓ | `popover.spec.ts` | `popover.html` |
| `labels.summary` `{count}` / `{size}` (+ default, live change)   | ✓   | `popover.spec.ts` | `popover.html` |

## 21. File icons

| Feature                                                       | Status | Spec           | Fixture      |
| ------------------------------------------------------------- | :----: | -------------- | ------------ |
| Built-in category icon + modifier class                       | ✓      | `icons.spec.ts` | `icons.html` |
| `fileIcons` by extension (case/dot-insensitive) and category  | ✓      | `icons.spec.ts` | `icons.html` |
| `getFileIconCallback` wins; `null` falls back; ctx shape      | ✓      | `icons.spec.ts` | `icons.html` |
| `fileIcons` assigned after rows exist re-renders              | ✓      | `icons.spec.ts` | `icons.html` |

## 22. Keyboard + accessibility

| Feature                                                       | Status | Spec          | Fixture     |
| ------------------------------------------------------------- | :----: | ------------- | ----------- |
| Card: one tab stop, `:focus-within` ring, Enter / Space open the dialog | ✓ | `a11y.spec.ts` | `a11y.html` |
| Card control named after the prompt                           | ✓      | `a11y.spec.ts` (NOTES #13 fixed) | `a11y.html` |
| Button: Enter opens the dialog; button / minimal accessible names | ✓  | `a11y.spec.ts` | `a11y.html` |
| Button / minimal: single tab stop                             | ✓      | `a11y.spec.ts` (NOTES #14 fixed) | `a11y.html` |
| Disabled dropzone skipped by Tab                              | ✓      | `a11y.spec.ts` | `a11y.html` |
| Row ✕ named "Remove <file>"; Enter removes; status pill labelled | ✓   | `a11y.spec.ts` | `a11y.html` |

## 23. Cancel / remove / teardown

| Feature                                                       | Status | Spec              | Fixture       |
| ------------------------------------------------------------- | :----: | ----------------- | ------------- |
| Cancel during the auto-retry backoff → `cancelled`, no further attempt | ✓ | `cancel.spec.ts` | `cancel.html` |
| `destroy()` stops the queue (queued files never start, no events after) | ✓ | `cancel.spec.ts` | `cancel.html` |
| Late handler result after `destroy()` / after removal → no events | ✓  | `cancel.spec.ts` | `cancel.html` |
| Mode-flip rebuild reports dropped files (`file-remove` + `change`) | ✓ | `cancel.spec.ts` | `cancel.html` |
| No `file-progress` after a cancel (held throttle tick dropped) | ✓     | `cancel.spec.ts` | `cancel.html` |
| `retryFile` / `resumeFile` on a cancelled file restart from 0  | ✓      | `cancel.spec.ts` | `cancel.html` |
| Cancel a queued (pending) / paused file → `cancelled` at once  | ✓      | `cancel.spec.ts` | `cancel.html` |
| Cancel the running file → slot handed to the next queued file  | ✓      | `cancel.spec.ts` | `cancel.html` |
| Handler ignores the signal: `cancelling` + "Cancelling…" + disabled buttons; timeout → `error` (`cancel-timeout`), slot freed, late result ignored | ✓ | `cancel.spec.ts` | `cancel.html` |
| `cancel-timeout-behavior="remove"` removes a timed-out file    | ✓      | `cancel.spec.ts` | `cancel.html` |
| Handler resolving while `cancelling` → `cancelled`             | ✓      | `cancel.spec.ts` | `cancel.html` |
| `cancel-timeout` / `cancel-timeout-behavior` reactive          | ✓      | `cancel.spec.ts` | `cancel.html` |
| `file-cancel` detail `{ file, result, uploadedBytes, metadata }` + `onFileCancel` twin | ✓ | `cancel.spec.ts` | `cancel.html` |
| `file-cancel` results `timeout-error` / `timeout-remove`       | ✓      | `cancel.spec.ts` | `cancel.html` |
| `beforeFilesCancelCallback({ files, allFiles })` veto keeps the upload running | ✓ | `cancel.spec.ts` | `cancel.html` |
| Removing a running file cancels without the cancel gate (`file-cancel` → `file-remove`) | ✓ | `cancel.spec.ts` | `cancel.html` |
| `cancelAll()` — uploading / pending / paused cancelled, complete untouched, gate once, resolves after all | ✓ | `cancel.spec.ts` | `cancel.html` |
| `cancelAll()` veto keeps everything running                    | ✓      | `cancel.spec.ts` | `cancel.html` |
| "Cancel all" in `<web-dropzone-progress>` (next to Pause all; only while active) + in-element strip | ✓ | `cancel.spec.ts` | `cancel.html` |

## 24. UI strings (`labels`)

| Feature                                                       | Status | Spec              | Fixture       |
| ------------------------------------------------------------- | :----: | ----------------- | ------------- |
| Built-in English defaults (prompt, row buttons, status, bulk) | ✓      | `labels.spec.ts` | `cancel.html` |
| Property: per-key merge, `{name}` / `{status}` placeholders, live re-render, `null` resets | ✓ | `labels.spec.ts` | `cancel.html` |
| JSON attribute; malformed JSON warns + keeps the previous value | ✓    | `labels.spec.ts` | `cancel.html` |
| `cancelling` / `cancelTimeout` strings                         | ✓      | `labels.spec.ts` | `cancel.html` |
| List + progress satellites follow the store labels (live)      | ✓      | `labels.spec.ts` | `cancel.html` |
| Element removed → every upload cancelled (signal + `file-cancel`), queued never start, store destroyed | ✓ | `cancel.spec.ts` | `cancel.html` |
| DOM move → uploads continue and complete (no removal teardown) | ✓     | `cancel.spec.ts` | `cancel.html` |
| Re-adding a removed element → fresh empty store, `ready` not re-fired | ✓ | `cancel.spec.ts` | `cancel.html` |
| `keep-alive-when-removed` keeps uploads running          | ✓     | `cancel.spec.ts` | `cancel.html` |
| `form.reset()` during an upload → cancel, then remove           | ✓     | `cancel.spec.ts` | `cancel.html` |
| `multiple="false"` replace: running upload cancelled (`file-cancel` → `file-remove`); idle → sync remove before add; batch keeps first | ✓ | `cancel.spec.ts` | `cancel.html` |
| New label keys: validation messages (`errorMaxFileCountOne`, …) | ✓     | `display.spec.ts` | (inline element) |
| Satellite own `labels` over the store's (per key, live property); malformed attribute keeps previous | ✓ | `satellites-extra.spec.ts` | `satellites-extra.html` |

## 25. Core lifecycle (defer / release / destroy) + readonly

| Feature                                                       | Status | Spec              | Fixture       |
| ------------------------------------------------------------- | :----: | ----------------- | ------------- |
| `defer` holds the first build; `release()` builds, `ready` once, `whenReady()` | ✓ | `lifecycle.spec.ts` | `lifecycle.html` |
| `destroy()` → element inert, re-insert builds nothing           | ✓     | `lifecycle.spec.ts` | `lifecycle.html` |
| `readonly`: no click / drop add, `--readonly` not `--disabled`  | ✓     | `disabled.spec.ts` | `disabled.html` |
| `readonly`: programmatic files, Remove hidden, files submitted with the form | ✓ | `disabled.spec.ts` | `disabled.html` |
| `el.isReadonly = false` unlocks; attribute reflected            | ✓     | `disabled.spec.ts` | `disabled.html` |
