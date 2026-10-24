# Test infrastructure notes

Running notes from building the e2e harness. Each entry is something noticed
while writing fixtures + specs that looks like a bug, friction point, or
design question in the component itself — not a problem with the tests.

Entries #1–#5 are the audit's known bugs DZ-1..DZ-5
(`web-components-core/docs/e2e-coverage-plan.md`, WP-DZ). A test pinning the
*correct* behaviour is marked `test.fail(true, 'NOTES.md #N')` until fixed.

---

## 1. `overlay-target="#id"` silently fails (DZ-1)

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

**Test status:** `drag-overlay.html` now uses `overlay-target="target"`; the
`"#target"` form is pinned as `test.fail` in `drag-overlay.spec.ts`.

## 2. Unconditional `console.log` in auto-retry (DZ-2)

**Where:** `packages/web-dropzone-core/src/dropzone-engine.ts:932,946,955,965,981,988`.

**Symptom:** every retry attempt prints to the console regardless of the
`/logging` level — noise in consumer apps.

**Suggested fix:** route through the core `/logging` category logger like the rest
of the engine.

**Test status:** pinned in `upload-edge.spec.ts` (retryPolicy block): no
`console.log` during a retry cycle — `test.fail`.

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

## 4. DOM move destroys the store — files lost, uploads aborted (DZ-4, D1)

**Where:** `packages/web-dropzone/src/web-component.ts:446-451` — `disconnect()`
calls `this.#dropzone?.destroy()`; the next `connect()` rebuilds an empty store.

**Symptom:** re-parenting / reordering the element (a DOM move =
`disconnect()`→`connect()`) drops every file and aborts in-flight uploads; `ready`
fires again.

**Decided (D1, 2026-10-24):** a DOM move must **keep** files and in-flight uploads.
Fix = move the store to core's build-once + activate/deactivate model (build in
`reinit()`, start/stop listeners in `connect()`/`disconnect()`), separate WP.

**Test status:** `lifecycle.spec.ts` — the keep-state tests are `test.fail`.

## 5. Disabled `<fieldset>` does not disable the dropzone (DZ-5)

**Where:** `packages/web-dropzone/src/web-component.ts` — `static formAssociated = true`
but no `formDisabledCallback(disabled)`.

**Symptom:** see `disabled.spec.ts` — verified there.

**Suggested fix:** implement `formDisabledCallback(d)` to set an internal
"form-disabled" flag merged with `isDisabled` (don't reflect into the `disabled`
attribute — the author's value must survive the fieldset being re-enabled).
