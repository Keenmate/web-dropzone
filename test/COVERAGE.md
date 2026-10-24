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
| `no-file-chosen-text` empty-state label                       | ✓      | `display.spec.ts` | `display.html` |
| `select-files-text` button label across variants              | ✓      | `appearance.spec.ts` | `appearance.html` |
| `card-size="minimal" \| "compact" \| "big"`                   | ✓      | `appearance.spec.ts` | `appearance.html` |
| `icon` attribute on minimal selector                          | ✓      | `display.spec.ts` | `display.html` |
| Count badge on button when files exist                        | ✓      | `appearance.spec.ts` | `appearance.html` |
| Count badge on minimal when files exist                       | ✗      |                  |                |

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
| `list-appearance="none"`                                      | ✓      | `list.spec.ts` | `list.html` |
| `max-visible-files` "Show N more" toggle (satellite renderer) | ✓      | `list.spec.ts` | `list.html` |
| `--dz-file-list-max-height` (works through satellite)         | ✓      | `list-extra.spec.ts` | `list-extra.html` |
| `files-inside` layout                                         | ✓      | `list.spec.ts` | `list.html` |
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
| `files-reject` carries grouped rejections                   | △      | `validation.spec.ts` | `validation.html` |
| `file-progress` / `file-status-change` during upload         | ✓      | `upload.spec.ts` | `upload.html`  |
| `file-update` after handler post-merges metadata             | ✓      | `events-extra.spec.ts` | `events-extra.html` |
| `file-row-update` on element-returning row callbacks (initial) | ✓     | `structural.spec.ts` | `structural.html` |
| `file-row-update` on progress ticks (listener survival)       | ✓      | `events-extra.spec.ts` | `events-extra.html` |
| `overlay-enter` / `overlay-leave` during drag (Playwright limit) | △    | `drag-overlay.spec.ts` | `drag-overlay.html` |
| `el.target.files` snapshot in sync at dispatch                | ✓      | `events.spec.ts` | `events.html` |
| Public methods: `addFiles`, `removeFile`, `clear`             | ✓      | `api.spec.ts`    | `api.html`    |
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
| `file-progress` event fires per onProgress() pump             | ✓      | `upload.spec.ts` | `upload.html` |
| `file-status-change` event fires per status transition       | ✓      | `upload.spec.ts` | `upload.html` |
| Resume from `context.startBytes` / `startPercent` after pause | ✓      | `upload-edge.spec.ts` | `upload-edge.html` |
| Retry from error re-invokes the handler                       | ✓      | `upload-edge.spec.ts` | `upload-edge.html` |
| Per-file pause / resume / cancel via X button (UI path)       | ✗      |                  |                |
| `progress-throttle` caps emission rate                        | ✓      | `upload-edge.spec.ts` | `upload-edge.html` |
| `reorder-completed` reflows completed files                   | ✓      | `upload-edge.spec.ts` | `upload-edge.html` |
| `progress-mode="pessimistic"` preserves progress on failure   | ✓      | `upload-edge.spec.ts` | `upload-edge.html` |
| Resume-aware progress on `file-progress`                      | △      | `upload-edge.spec.ts` | `upload-edge.html` |

## 6. Structural mode (`mode="structural"`)

| Feature                                                       | Status | Spec                | Fixture           |
| ------------------------------------------------------------- | :----: | ------------------- | ----------------- |
| `renderPromptCallback` overrides card content                 | ✓      | `structural.spec.ts` | `structural.html` |
| `renderFileItemCallback` (string return)                      | ✓      | `structural.spec.ts` | `structural.html` |
| `renderFileItemCallback` (HTMLElement return + file-row-update) | ✓    | `structural.spec.ts` | `structural.html` |
| `renderListWrapperCallback` (table layout)                    | ✓      | `structural.spec.ts` | `structural.html` |
| `renderSummaryCallback` (popover summary)                     | ✓      | `events-extra.spec.ts` | `events-extra.html` |
| Callbacks ignored when `mode!="structural"` (hard switch)     | ✓      | `structural.spec.ts` | `structural.html` |

## 7. Architecture (satellites + headless)

| Feature                                                       | Status | Spec                   | Fixture             |
| ------------------------------------------------------------- | :----: | ---------------------- | ------------------- |
| `<web-dropzone-picker for=>` binds to store                   | ✓      | `architecture.spec.ts` | `architecture.html` |
| `<web-dropzone-list for=>` binds to store                     | ✓      | `architecture.spec.ts` | `architecture.html` |
| `<web-dropzone-list>` reflects programmatic adds              | ✓      | `architecture.spec.ts` | `architecture.html` |
| `<web-dropzone-indicator for=>` binds + renders chip          | ✓      | `satellites-extra.spec.ts` | `satellites-extra.html` |
| `<web-dropzone-progress for=>` binds + renders surface        | ✓      | `satellites-extra.spec.ts` | `satellites-extra.html` |
| `mode="headless"` skips internal rendering                    | ✓      | `architecture.spec.ts` | `architecture.html` |
| `mode="headless"` still fires every event                     | ✓      | `architecture.spec.ts` | `architecture.html` |
| Multiple pickers contribute to one store (Mode A: shared)     | ✓      | `architecture.spec.ts` | `architecture.html` |
| Multiple independent stores on one page                       | ✓      | `architecture.spec.ts` | `architecture.html` |

## 8. Drag overlay

| Feature                                                       | Status | Spec                  | Fixture            |
| ------------------------------------------------------------- | :----: | --------------------- | ------------------ |
| Overlay NOT mounted at rest                                   | ✓      | `drag-overlay.spec.ts` | `drag-overlay.html` |
| `overlay-target` activates whole-area overlay                 | △      | `drag-overlay.spec.ts` | `drag-overlay.html` |
| Two overlays don't steal each other's drags                   | ✗      |                       |                    |
| Overlay enter / leave events                                  | △      | `drag-overlay.spec.ts` | `drag-overlay.html` |

> **Known limitation:** Browser security blocks JS from synthesizing
> `DragEvent` objects whose `DataTransfer.types` includes `"Files"`.
> Two drag-overlay scenarios are marked `.fixme()` until a CDP-level
> drag-injection helper is wired up. The contract still works in real
> browsers — examples-drag-overlay.html exercises it manually.

## 9. Form integration

| Feature                                                       | Status | Spec           | Fixture     |
| ------------------------------------------------------------- | :----: | -------------- | ----------- |
| `name` attribute submits real `File` blobs in FormData        | ✓      | `form.spec.ts` | `form.html` |
| Zero-files → no FormData entry under the configured name      | ✓      | `form.spec.ts` | `form.html` |
| `form.reset()` clears selection (formResetCallback)           | ✓      | `form.spec.ts` | `form.html` |
| Unnamed dropzone → no FormData entry at all                   | ✓      | `form.spec.ts` | `form.html` |
| `min-file-count` blocks form submit via setValidity           | ✗      |                |             |

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
| `change` detail `{ files }`; `files-reject` / `file-retry` / `file-status-change` context | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |
| `ready` (+ twin) on build; `data-ready`; `controller.isReady`  | ✓      | `interaction-model.spec.ts`   | `interaction-model.html`  |
| `el.controller` stable across a rebuild; no `getStore` / engine | ✓     | `interaction-model.spec.ts`   | `interaction-model.html`  |
| `beforeFilesAddCallback` — `false` cancels, `File[]` replaces, nothing continues | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |
| `beforeFilesRemoveCallback` via row ✕ (`data-dz-action="remove"`) | ✓   | `interaction-model.spec.ts`   | `interaction-model.html`  |
| `validateCallback` / `getFileIconCallback` / `getCustomStylesCallback` ctx | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |
| `uploadFileCallback(ctx)` + `file-upload-complete` twin       | ✓      | `interaction-model.spec.ts`   | `interaction-model.html`  |
| Structural render callbacks ctx; `file-row-update` not composed | ✓     | `interaction-model.spec.ts`   | `interaction-model.html`  |
| `renderRollingBodyCallback` settable as an element input      | ✓      | `interaction-model.spec.ts`   | `interaction-model.html`  |
| `renderSummaryCallback` + `loadStateCallback` ctx             | ✓      | `interaction-model.spec.ts`   | `interaction-model.html`  |
| Picker `uploadFileCallback`; list `summary-activate` / `queue-open` carry store context | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |
| Element unit: controller defaults, `ready` twin, add / change twins | ✓  | `packages/web-dropzone/test/unit/interaction.test.ts` | — |
