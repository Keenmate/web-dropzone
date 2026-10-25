# Test infrastructure notes

Running notes from building the e2e harness. Each entry is something noticed
while writing fixtures + specs that looks like a bug, friction point, or
design question in the component itself — not a problem with the tests.

Entries #1–#5 are the audit's known bugs DZ-1..DZ-5
(`web-components-core/docs/e2e-coverage-plan.md`, WP-DZ). A test pinning the
*correct* behaviour is marked `test.fail(true, 'NOTES.md #N')` until fixed.

---

## 1. `overlay-target="#id"` silently fails (DZ-1) — FIXED

**Where:** `packages/web-dropzone/src/web-component.ts:218-227` documents the
attribute as "Element (or selector string)"; `packages/web-dropzone/src/dropzone.ts:2521-2522`
resolves a string with `document.getElementById(...)`.

**Symptom:** `overlay-target="#target"` → `getElementById('#target')` is `null` →
`initLogger.warn('Overlay target not found')` and no overlay ever mounts. Only the
bare id (`overlay-target="target"`) works. The test fixture used `"#target"`, which is
why the drag-overlay tests were `fixme` (the "Playwright can't synthesize file
drags" explanation was wrong — a constructed `DataTransfer` with a `File` works).

**Suggested fix:** accept both — `getElementById(v) ?? document.querySelector(v)`
(guard the `querySelector` against an invalid selector), or correct the docs to say
"element id".

**Fixed (2026-10-25):** a string resolves as an id first, then as a selector
(`querySelector`, invalid selectors guarded); README documents both forms.

**Test status:** `drag-overlay.html` uses `overlay-target="target"`; the `"#target"` form in
`drag-overlay.spec.ts` is green.

## 2. Unconditional `console.log` in auto-retry (DZ-2) — FIXED

**Where:** `packages/web-dropzone-core/src/dropzone-engine.ts:932,946,955,965,981,988`.

**Symptom:** every retry attempt prints to the console regardless of the
`/logging` level — noise in consumer apps.

**Suggested fix:** route through the core `/logging` category logger like the rest
of the engine.

**Fixed (2026-10-25):** the six messages are `fileLogger.debug` (category `DROPZONE:FILE`)
with structured data.

**Test status:** `upload-edge.spec.ts` › retryPolicy › "auto-retry does not write to
the console outside /logging" — green.

## 3. `value-format` is a no-op (DZ-3)

**Where:** `packages/web-dropzone/src/web-component.ts:233` (input row) and `:425`
(only re-syncs the form value; nothing reads the format).

**Symptom:** `value-format="csv"` / `"array"` / `"json"` produce identical form
submissions (FormData blobs under `name`).

**Suggested fix:** implement the documented hidden-input serialization (see the
cross-repo form-submission convention: light-DOM hidden inputs + value-format) or
remove the attribute.

**Test status:** not pinned yet (needs the intended output shape decided — open
question).

## 4. DOM move destroys the store — files lost, uploads aborted (DZ-4, D1) — FIXED

**Where:** `packages/web-dropzone/src/web-component.ts:446-451` — `disconnect()`
calls `this.#dropzone?.destroy()`; the next `connect()` rebuilds an empty store.

**Symptom:** re-parenting / reordering the element (a DOM move =
`disconnect()`→`connect()`) drops every file and aborts in-flight uploads; `ready`
fires again.

**Decided (D1, 2026-10-24):** a DOM move must **keep** files and in-flight uploads.
Fix = move the store to core's build-once + activate/deactivate model (build in
`reinit()`, start/stop listeners in `connect()`/`disconnect()`), separate WP.

**Fixed (2026-10-25):** the store is built once (`reinit()`); `disconnect()` calls
`WebDropzone.deactivate()` (overlay document/window listeners, popover `autoUpdate` +
outside-click / Escape listeners off) and `connect()` calls `activate()` (re-wires them,
re-anchors an open popover). Files, uploads and the open popover survive. Only `el.destroy()`
tears the store down (the next connect rebuilds it).

**Open (product):** a *permanent* removal now behaves like a move — in-flight uploads keep
running until they finish or `el.destroy()` is called (core can't tell a move from a removal
at disconnect time). See the report question.

**Test status:** `lifecycle.spec.ts` — keep-state tests green, plus popover-across-a-move and
detached-listeners tests.

## 5. Disabled `<fieldset>` does not disable the dropzone (DZ-5) — FIXED

**Where:** `packages/web-dropzone/src/web-component.ts` — `static formAssociated = true`
but no `formDisabledCallback(disabled)`.

**Symptom (verified):** with `<fieldset disabled>` around it, a drop on the card
still adds the file; nothing reacts to the fieldset state.

**Fixed (2026-10-25):** `formDisabledCallback` keeps a private form-disabled flag; the store
gets `isDisabled = disabled input || fieldset`. `el.disabled` / the attribute keep the author's
value. (Core candidate: other form-associated components likely have the same gap — a generic
"form-disabled merged into an input" hook in `BlissElement` would cover them.)

**Test status:** `disabled.spec.ts` › `<fieldset disabled>` — green, plus re-enable and
author-value tests.

**Suggested fix:** implement `formDisabledCallback(d)` to set an internal
"form-disabled" flag merged with `isDisabled` (don't reflect into the `disabled`
attribute — the author's value must survive the fieldset being re-enabled).

## 6. `uploaded-deletable="false"` is ignored by the rendered list (new)

**Where:** `packages/web-dropzone/src/web-component-list.ts:332-350` (`renderRow`) —
builds `RowTemplateOptions` with `parts / useThumbnail / iconOverrides / iconContext`
only. `removable` (and `reorderEligible`, see #7) are computed by the legacy
in-class renderer (`dropzone.ts` `rowOpts()` → `isFileUserRemovable`) which the
convenience form no longer uses — the list is the `<web-dropzone-list>` satellite.

**Symptom:** a completed row keeps a visible, clickable ✕ (`dz__file-item__remove`
without `--hidden`), so the user can delete an uploaded file.

**Suggested fix:** pass `removable: !(file.status === 'complete' && cfg.isUploadedFileDeletable === false)`
from the satellite (and patch it on the status-change row patch).

**Test status:** `upload-edge.spec.ts` › uploaded-deletable="false" › "a completed row
hides its remove button" — `test.fail`.

## 7. `reorder-completed` never reorders the rendered rows (new)

**Where:** same as #6 — the satellite never stamps `data-reorder-bucket="complete"`
(`reorderEligible`), and the delayed reorder (`scheduleReorder`) lives in the
legacy in-class renderer.

**Symptom:** with `reorder-completed reorder-completed-delay="600"`, a completed
first row stays first indefinitely. (The old `upload-edge.spec.ts` reorder test only
checked `status === 'complete'`, so it stayed green.)

**Test status:** `upload-edge.spec.ts` › reorder-completed-delay — `test.fail`.

## 8. A cancelled row offers no Retry (new) — FIXED

**Where:** `packages/web-dropzone-core/src/icons.ts:101` `actionForStatus` returns
`null` for `cancelled`.

**Symptom:** ✕ on an uploading row cancels it and the row stays (by design — "give
the user a chance to recover", `dropzone.ts` `handleUserRemoveClick` doc: "row stays
in the list with the Retry button available"), but the action slot is hidden, so the
only recovery is the strip's "Retry all" (the engine counts cancelled as failed and
`retryAll` / `retryFile` accept it).

**Suggested fix:** `if (status === 'error' || status === 'cancelled') return 'retry';`

**Fixed (2026-10-25):** `actionForStatus('cancelled')` → `'retry'`.

**Test status:** `row-actions.spec.ts` › "a cancelled row offers Retry" — green (also clicks it
and sees the upload restart).

## 9. Worker pool doesn't refill idle workers — Retry all runs serially (new) — FIXED

**Where:** `packages/web-dropzone-core/src/dropzone-engine.ts:679-714` (`uploadAll`).
Workers exit as soon as they find no pending file; a later `uploadAll()` call returns
early while `isDrainingQueue` is true.

**Symptom:** `retryAll()` (and the "Retry all" button) with `concurrency="3"` and two
failed files: `retryFile(e1)` starts a drain whose idle workers exit immediately
(`e2` is still `error` at that point, the loop is synchronous), then `retryFile(e2)`'s
`uploadAll()` is swallowed → `e2` only starts after `e1` finishes. Same for files
added while a drain is running: they wait for the busy worker instead of using a free
slot.

**Suggested fix:** in `uploadAll`, when already draining, spawn extra workers up to
`concurrency - activeWorkers` instead of returning; or have `retryAll` flip all
statuses first and call `uploadAll()` once.

**Fixed (2026-10-25):** `uploadAll()` keeps a live-worker count; a call made mid-drain tops
the pool back up to `concurrency` and resolves with the running drain.

**Test status:** `toolbar.spec.ts` › "Retry all re-runs failed files in parallel up to
`concurrency`" and `upload.spec.ts` › "a file added mid-drain takes a free slot" — green.

## 10. Popover "Add more" does nothing (new) — FIXED

**Where:** `packages/web-dropzone/src/dropzone.ts:1799-1806` calls `this.inputEl?.click()`;
`inputEl` is cached from `this.element.querySelector('.dz__dropzone__input')`
(`cacheElements`), but the file input now lives inside the `<web-dropzone-picker>`
satellite's shadow root → `inputEl` is `null`.

**Symptom:** clicking "Add more" in the popover header opens no file dialog.

**Suggested fix:** ask the picker to open its dialog (e.g. a `picker.open()` method /
event) instead of reaching for a cached input.

**Fixed (2026-10-25):** the picker satellite got `openFileDialog()`; "Add more" calls it on
the mounted picker (falls back to `inputEl` on the in-class/structural path), and the
outside-click handler ignores that synthetic input click so the popover stays open.

**Test status:** `toolbar.spec.ts` › "Add more opens the native file dialog" — green.

## 11. Button/minimal selector + popover list: click opens the dialog, not the popover (new — confirm intent)

**Where:** the toggle logic is in the legacy `dropzone.ts` `handleClick` (~2440:
"for selector=button/minimal + listAppearance=popover, clicks on the selector toggle
the popover when files exist … FluentUI's minimal+popover convention"), wired to
`this.dropzoneEl`, which is `null` since the picker satellite renders the selector.
The picker's own click handler always opens the file dialog.

**Symptom:** with files present, clicking the button opens the file dialog; the
popover is reachable only through the summary line.

**Question for the user:** is the FluentUI toggle still the intended behaviour? If
yes, the picker needs to route the click to the store when `list-appearance="popover"`
and files exist.

**Test status:** `toolbar.spec.ts` › "with files, clicking the button selector toggles
the popover" — `test.fail`.

## 12. `el.addFiles(files)` takes no options (new — minor, API question)

**Where:** `packages/web-dropzone/src/web-component.ts:674-676` — `addFiles(files)`
forwards only `files`; `el.controller.addFiles(files, { uploadMetadata, uploadFileCallback })`
supports the Mode B options.

**Symptom:** `el.addFiles(files, { uploadMetadata })` silently drops the metadata.

**Suggestion:** forward the optional `opts` (cheap, non-breaking). Not pinned as a
failing test — the element-level signature is a design decision.

## 13. The card's keyboard control has no meaningful accessible name (new, a11y) — FIXED

**Where:** `packages/web-dropzone/src/web-component-picker.ts` card branch (~233-260) —
the only focusable element is the visually-hidden `<input type="file">`, rendered
without `aria-label` / `aria-labelledby`.

**Symptom:** a screen reader announces the card as "Choose File" — the prompt text
(`prompt-text`, e.g. "Drop reports") is not part of the name.

**Suggested fix:** `aria-label="${promptText}"` (or `aria-labelledby` pointing at
`.dz__dropzone__text`) on the input.

**Fixed (2026-10-25):** the card's input gets `aria-label` = the prompt (`label` attribute /
`prompt-text`), in the picker satellite and the structural renderer.

**Test status:** `a11y.spec.ts` › "the card control is named after the prompt" — green.

## 14. Button / minimal selectors have two tab stops (new, a11y) — FIXED

**Where:** `web-component-picker.ts` — the hidden file input is rendered (focusable) in
every appearance; button / minimal add their own `<button>` after it.

**Symptom:** Tab lands on an invisible input first (no focus ring — the
`:focus-within` ring is card-only), then on the visible button.

**Suggested fix:** `tabindex="-1"` on the input when the appearance has its own
button (button / minimal / native).

**Fixed (2026-10-25):** button / minimal / native render the input with `tabindex="-1"
aria-hidden="true"` (picker satellite + structural renderer).

**Test status:** `a11y.spec.ts` › "the button selector is a single tab stop" — green.

---

## Observations (not bugs)

- Much of `packages/web-dropzone/src/dropzone.ts` (`renderSelector`, `handleDragOver`
  / `handleDrop` / `handleClick`, `rowOpts`, `bindListRemoveHandlers`, …) looks dead
  since rendering moved to the satellites; #6, #7, #10, #11 are features that stayed
  behind in that code.
- Synthetic file drags work in Chromium: `new DataTransfer()` + `items.add(new File(...))`
  gives `types` containing `"Files"` (`e2e/helpers.ts` `dragFiles`).
