/**
 * `<web-dropzone>` — the custom element, now built on
 * `@keenmate/web-components-core` (`BlissElement`).
 *
 * All the custom-element plumbing that used to live here by hand — the
 * `ATTRIBUTE_TABLE`, `parseAttrValue`, `observedAttributes`,
 * `attributeChangedCallback`, the pre-upgrade `upgradeProperties` rescue, and
 * the ~40 property/callback getters/setters — is now declared ONCE as a core
 * input table (`static inputs`). Core owns parsing, validation, reactivity
 * coalescing, reflection, pre-upgrade property lifting, and form association
 * (`this.internals` / `el.form`). This file keeps only what is genuinely
 * dropzone-specific: the bridge from the merged `config` to the headless store
 * (`WebDropzone` in `dropzone.ts`), the operating-mode resolution and form-value
 * sync (real `File` blobs via `setFormValue`). Custom CSS is core's
 * `createCustomStyles()`; the `ready` event / attribute, `defer` / `release()`,
 * `destroy()` and the tag definition (`registerComponent()` in `index.ts`) come
 * from core.
 *
 * Interaction model (web-components-core SPEC §12.5): the engine notifies,
 * the element emits. Every engine happening arrives through the host's
 * `notify` and goes out via `this.emit()` — the camelCase `on*` twin gets the
 * detail, then a bubbling, non-composed DOM event fires on the host; every
 * detail carries `controller` (`el.controller`, a `DropzoneController`) and
 * `element`. The engine itself is never exposed.
 *
 * Reactivity: the store applies EVERY config change in place (`updateConfig`
 * always returns true), so almost every input is `on: 'update'`. The single
 * exception is a change to the operating mode — toggling `mode` /
 * `display-mode` / `selector-appearance` / `list-appearance` can flip which
 * render path the store uses, which `updateConfig` can't express; `update()`
 * detects that flip and does a full rebuild (a fresh `WebDropzone`, matching the
 * pre-core behaviour). First connect is always a rebuild via `reinit()`.
 */

import {
    BlissElement,
    adoptStyles,
    createCustomStyles,
    createStateStore,
    toBool,
    toBytes,
    toEnum,
    toInt,
    toText,
    toValue,
    toFunction,
    toCustom,
    type CustomStylesHandle,
    type InputDef,
    type Converter,
    type EventDef,
    type RenderLoaderCallback,
    type LoadStateCallback,
    type SaveStateCallback,
} from '@keenmate/web-components-core';
import { WebDropzone } from './dropzone';
import { linkStoreController, linkStoreReorder, announceStoreBuild } from './store-link';
import { subscribePageFileDrag, isPageFileDragActive, applyArmedState } from './page-file-drag';
import { initLogger, createDropzoneController, countLabel, defaultLabel } from '@keenmate/web-dropzone-core';
import { labelsConverter } from './inputs';
import type {
    DropzoneController,
    DropzoneEngineHost,
    DropzoneEventMap,
    FileAddEventDetail,
    FileRemoveEventDetail,
    FilesChangeEventDetail,
    ChangeEventDetail,
    FileRejectEventDetail,
    FileRetryEventDetail,
    FileUploadEventDetail,
    FileDeleteEventDetail,
    FileCancelEventDetail,
    FileProgressEventDetail,
    FileStatusChangeEventDetail,
    FileUpdateEventDetail,
    OverlayEventDetail,
    ReadyEventDetail
} from '@keenmate/web-dropzone-core';
import type {
    DropzoneConfig,
    DropzoneRenderMode,
    SelectorAppearance,
    ListAppearance,
    CardSize,
    DropzoneControl,
    FileItemPart,
    FileState,
    DropzoneLabels,
    DropzoneState
} from '@keenmate/web-dropzone-core';

// Import CSS as inline string for Shadow DOM injection
import styles from './css/main.css?inline';

const PLACEMENTS = [
    'top', 'top-start', 'top-end',
    'bottom', 'bottom-start', 'bottom-end',
    'left', 'left-start', 'left-end',
    'right', 'right-start', 'right-end'
] as const;

/** Optional string: absent / empty → null (normalized to "absent" for the store). */
const text = (): Converter<string | null> => toText({ isNullable: true });

/** Any callback input (property-only). */
const cb = (): ReturnType<typeof toFunction> => toFunction();

/**
 * Comma-separated allowlist input (Plyr-style `controls`). Parses
 * `"a, b ,c"` → `['a','b','c']`, lower-cased and de-duplicated. Absent / empty
 * → null, which the store reads as "unset" (render everything). An unknown
 * token makes the whole value invalid (core's rule: warn, `input-rejected`,
 * keep the previous value) — on the attribute and the property path alike.
 * Reflects back as the joined string. (Core's `toList` can't check items
 * against an allowed set, hence `toCustom`.)
 */
const list = <T extends string>(valid: readonly T[]): Converter<T[] | null> => {
    const allowed = new Set<string>(valid);
    return toCustom<T[] | null>(
        (raw, reportInvalid) => {
            if (raw == null || raw.trim() === '') return null;
            const tokens = [...new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))];
            const unknown = tokens.filter((t) => !allowed.has(t));
            if (unknown.length) {
                reportInvalid?.(`unknown item(s) ${unknown.map((t) => `"${t}"`).join(', ')}; expected a comma-separated list of ${valid.join(', ')}`);
                return null;
            }
            return tokens.length ? (tokens as T[]) : null;
        },
        {
            validate: (v): v is T[] | null =>
                v == null || (Array.isArray(v) && v.every((x) => typeof x === 'string' && allowed.has(x))),
            toAttribute: (v) => (Array.isArray(v) && v.length ? v.join(',') : null),
        },
    );
};

const CONTROL_TOKENS = ['picker', 'list', 'overall-progress'] as const;
const ITEM_PART_TOKENS = ['icon', 'name', 'size', 'type', 'progress', 'status', 'action', 'cancel', 'remove'] as const;

// ============================================================================
// INPUT TABLE — the whole <web-dropzone> public surface, one row each.
// `configKey` is the DropzoneConfig key, so the merged `config` bridges to the
// store almost verbatim (see #assembleConfig). Everything is `on: 'update'`;
// the store applies changes in place, and #update handles the mode-flip rebuild.
// ============================================================================
const INPUTS: readonly InputDef[] = [
    // ── Core ──────────────────────────────────────────────────────────────────
    { configKey: 'accept',                  attribute: 'accept',              converter: text(),                                                                       shouldReflect: true, on: 'update', description: 'Accepted file types (MIME types / extensions), comma-separated.' },
    { configKey: 'isMultiple',       attribute: 'multiple',            converter: toBool('default-true'),                                                       on: 'update', type: 'boolean', description: 'Allow selecting multiple files.' },
    { configKey: 'maxFileSize',             attribute: 'max-file-size',       converter: toBytes({ default: 0 }),                                                                     shouldReflect: true, on: 'update', description: 'Maximum size per file in bytes (the attribute takes a size: "5MB", "1.5GB", "300 kB", "2MiB" — binary units). 0 = unlimited.' },
    { configKey: 'minFileSize',             attribute: 'min-file-size',       converter: toBytes({ default: 0 }),                                                                     shouldReflect: true, on: 'update', description: 'Minimum size per file in bytes. 0 = no minimum.' },
    { configKey: 'maxTotalSize',            attribute: 'max-total-size',      converter: toBytes({ default: 0 }),                                                                     shouldReflect: true, on: 'update', description: 'Maximum combined size of all files in bytes. 0 = unlimited.' },
    { configKey: 'maxFileCount',            attribute: 'max-file-count',      converter: toInt({ min: 0, default: 0 }),                                                        shouldReflect: true, on: 'update', description: 'Maximum number of files. 0 = unlimited.' },
    { configKey: 'minFileCount',            attribute: 'min-file-count',      converter: toInt({ min: 0, default: 0 }),                                                        shouldReflect: true, on: 'update', description: 'Minimum number of files; reflected into the form validity (valueMissing).' },
    { configKey: 'maxVisibleFileCount',         attribute: 'max-visible-file-count',   converter: toInt({ min: 0, default: 7 }),                                                        shouldReflect: true, on: 'update', description: 'How many file rows are visible before the list scrolls.' },
    { configKey: 'dedupeMode',              attribute: 'dedupe-mode',         converter: toEnum(['name', 'name-size', 'none'] as const, { default: 'name' }),          shouldReflect: true, on: 'update', description: 'How duplicate files are detected: by name, name+size, or not at all.' },
    { configKey: 'isDisabled',              attribute: 'disabled',            converter: toBool('presence'),                                                           shouldReflect: true, on: 'update', type: 'boolean', description: 'Disable the dropzone (like a native control: no clicks / drops, every button — selector, rows, bulk actions, satellites — disabled and out of the tab order; boolean attribute — present = on). An ancestor `<fieldset disabled>` disables it too (core `isEffectivelyDisabled`); `el.isDisabled` keeps the authored value.' },
    { configKey: 'isReadonly',              attribute: 'readonly',            converter: toBool('presence'),                                                           shouldReflect: true, on: 'update', type: 'boolean', description: 'Read-only (like a native control): the user cannot change the selection — no add (click / drop / overlay / Add more), no row Remove, no Clear all — but the files stay visible and ARE submitted with the form. Uploads keep running; the programmatic API is unaffected.' },

    // ── Operating mode ────────────────────────────────────────────────────────
    { configKey: 'renderMode',              attribute: 'render-mode',         converter: toEnum(['bulk', 'structural', 'headless'] as const),                          on: 'update', description: 'Render mode — who renders the file list. When absent it is inferred from the presence of renderer-trigger attributes (display-mode / selector-appearance / list-appearance → bulk; none → headless). `structural` is the only way to opt into render callbacks.' },
    { configKey: 'progressThrottle',        attribute: 'progress-throttle',   converter: toInt({ min: 0, default: 0 }),                                                        shouldReflect: true, on: 'update', description: 'Throttle interval in ms for file-progress events. 0 = every tick.' },

    // ── Display ───────────────────────────────────────────────────────────────
    { configKey: 'displayMode',             attribute: 'display-mode',        converter: toEnum(['list', 'detailed', 'grid', 'compact'] as const, { default: 'list' }), shouldReflect: true, on: 'update', description: 'Single-axis display shorthand.' },
    { configKey: 'selectorAppearance',      attribute: 'selector-appearance', converter: toEnum(['card', 'button', 'minimal', 'native'] as const),                    shouldReflect: true, on: 'update', description: 'File-selector appearance (overrides the display shorthand when set).' },
    { configKey: 'listAppearance',          attribute: 'list-appearance',     converter: toEnum(['list', 'detailed', 'grid', 'badges', 'rolling', 'popover', 'none'] as const), shouldReflect: true, on: 'update', description: 'File-list appearance (overrides the display shorthand when set).' },
    { configKey: 'gridLayout',              attribute: 'grid-layout',         converter: toEnum(['uniform', 'natural'] as const, { default: 'uniform' }),               shouldReflect: true, on: 'update', description: 'Tile layout for list-appearance="grid": uniform equal-size tiles, or natural (equal-height rows that keep each image aspect ratio).' },
    { configKey: 'gridStatus',              attribute: 'grid-status',         converter: toEnum(['badge', 'overlay'] as const, { default: 'badge' }),                   shouldReflect: true, on: 'update', description: 'How finished grid files are flagged: badge (corner glyph) or overlay (full-tile veil + big centred check/error glyph).' },
    { configKey: 'controls',                attribute: 'controls',            converter: list(CONTROL_TOKENS),                                                         shouldReflect: true, on: 'update', type: 'DropzoneControl[]', description: 'Plyr-style allowlist of top-level surfaces (comma-separated): picker, list, overall-progress. Unset = render all.' },
    { configKey: 'itemControls',            attribute: 'item-controls',       converter: list(ITEM_PART_TOKENS),                                                       shouldReflect: true, on: 'update', type: 'FileItemPart[]', description: 'Plyr-style allowlist of per-row parts (comma-separated): icon, name, size, type, progress, status, action, cancel, remove. Unset = render all.' },
    { configKey: 'rollingRotation',         attribute: 'rolling-rotation',    converter: toEnum(['horizontal', 'vertical', 'slide-in'] as const, { default: 'slide-in' }), shouldReflect: true, on: 'update', description: 'Rotation style for the rolling list appearance.' },
    { configKey: 'cardSize',                attribute: 'card-size',           converter: toEnum(['minimal', 'compact', 'big'] as const),                               shouldReflect: true, on: 'update', description: 'Card size for the card selector appearance.' },
    { configKey: 'isThumbnailsShown', attribute: 'show-thumbnails',     converter: toBool('tristate'),                                                           on: 'update', type: 'boolean', description: 'Force image thumbnails on/off. Property-only tristate: unset (undefined) means auto (on for grid, icons elsewhere).' },
    { configKey: 'isFilesInside',    attribute: 'files-inside',        converter: toBool('default-false'),                                                      on: 'update', type: 'boolean', description: 'Render the file list inside the drop area.' },
    { configKey: 'cancelIcon',              attribute: 'cancel-icon',         converter: text(),                                                                       shouldReflect: true, on: 'update', description: 'HTML for the row Cancel (⊘) button glyph (raw HTML — NOT sanitized). Unset = built-in icon.' },
    { configKey: 'removeIcon',              attribute: 'remove-icon',         converter: text(),                                                                       shouldReflect: true, on: 'update', description: 'HTML for the row Remove (✕) button glyph (raw HTML — NOT sanitized). Unset = built-in icon.' },
    { configKey: 'icon',                    attribute: 'icon',                converter: text(),                                                                       shouldReflect: true, on: 'update', description: 'Prompt icon (emoji or markup).' },
    { configKey: 'labels',                  attribute: 'labels',              converter: labelsConverter,                                                              on: 'update', type: 'Partial<DropzoneLabels>', description: 'Every UI string (see `DropzoneLabels` / `DEFAULT_LABELS`), merged per key over the built-in English; `{name}` / `{count}` / `{size}` / … placeholders: prompt, hint, empty, summary, status names, row + bulk buttons, popover, limits line, progress strip, validation messages. Satellites inherit them (and take their own `labels` on top). Property (object) or JSON attribute. Live.' },

    // ── Compact mode ──────────────────────────────────────────────────────────
    { configKey: 'popoverPlacement',        attribute: 'popover-placement',   converter: toEnum(PLACEMENTS, { default: 'bottom-start' }),                              shouldReflect: true, on: 'update', description: 'Placement of the compact-mode popover relative to its trigger (a core /positioning placement; flips when there is no room).' },

    // ── Drag overlay ──────────────────────────────────────────────────────────
    { configKey: 'overlayTarget',           attribute: 'overlay-target',      converter: toCustom<HTMLElement | string | null>(
        (raw) => raw,
        {
            validate: (v): v is HTMLElement | string | null =>
                v == null || typeof v === 'string' || (typeof HTMLElement !== 'undefined' && v instanceof HTMLElement),
            // An HTMLElement can't live in an attribute — reflecting one removes
            // the (now stale) string attribute so the store resolves the element.
            toAttribute: (v) => (typeof v === 'string' && v !== '' ? v : null),
        },
    ), shouldReflect: true, on: 'update', type: 'HTMLElement | string', description: 'Element (or selector string) that acts as the full-viewport drag-overlay target. Assign an HTMLElement via the property; a selector string via the `overlay-target` attribute.' },
    { configKey: 'overlayIcon',             attribute: 'overlay-icon',        converter: text(),                                                                       shouldReflect: true, on: 'update', description: 'Icon shown in the drag overlay.' },
    { configKey: 'shouldHighlightOnPageDrag', attribute: 'highlight-on-page-drag', converter: toBool('default-false'),                                         on: 'update', type: 'boolean', description: 'Arm the drop target while FILES are dragged anywhere over the page: the host gets the `armed` attribute + `:state(armed)` and the card takes `--dz-dropzone-bg-armed` (the card under the pointer keeps `--dz-dropzone-bg-active`). Cleared on drop anywhere, when the drag leaves the window, on Escape / `dragend`, and on disconnect. Never armed while disabled / read-only; text and other non-file drags never arm. One shared page listener for all instances.' },

    // ── Form integration ──────────────────────────────────────────────────────
    { configKey: 'name',                    attribute: 'name',                converter: text(),                                                                       shouldReflect: true, on: 'update', description: 'Form field name. Files submit as real FormData blobs under this name.' },
    { configKey: 'valueFormat',             attribute: 'value-format',        converter: toEnum(['json', 'csv', 'array'] as const, { default: 'json' }),               shouldReflect: true, on: 'update', description: 'Fallback hidden-input serialization format hint (FormData blobs are always submitted for files).' },

    // ── Upload pipeline (meaningful once uploadFileCallback is set) ────────────
    { configKey: 'concurrency',             attribute: 'concurrency',         converter: toInt({ min: 1, default: 1 }),                                                        shouldReflect: true, on: 'update', description: 'Maximum concurrent uploads through the worker pool.' },
    { configKey: 'cancelTimeout',           attribute: 'cancel-timeout',      converter: toInt({ min: 0, default: 2000 }),                                             shouldReflect: true, on: 'update', description: 'How long (ms) a cancel waits for the aborted upload handler to settle (the row shows "Cancelling…"). Settles in time → `cancelled`; otherwise `cancel-timeout-behavior` applies and later results are ignored.' },
    { configKey: 'cancelTimeoutBehavior',   attribute: 'cancel-timeout-behavior', converter: toEnum(['error', 'remove'] as const, { default: 'error' }),               shouldReflect: true, on: 'update', description: 'What a timed-out cancel does: `error` (status error, reason `cancel-timeout`, retryable) or `remove` (the file is removed from the list).' },
    { configKey: 'shouldAutoUpload',     attribute: 'auto-upload',         converter: toBool('default-true'),                                                       on: 'update', type: 'boolean', description: 'Auto-upload newly added files.' },
    { configKey: 'isUploadedFileRemovalAllowed',  attribute: 'allow-uploaded-file-removal',  converter: toBool('default-true'),                                                       on: 'update', type: 'boolean', description: 'Whether already-uploaded files can be removed.' },
    { configKey: 'shouldSinkCompleted',     attribute: 'sink-completed', converter: toBool('default-false'),                                                  on: 'update', type: 'boolean', description: 'Auto-move completed files to the end of the list (after `sink-completed-delay`).' },
    { configKey: 'sinkCompletedDelay',   attribute: 'sink-completed-delay', converter: toInt({ min: 0, default: 1500 }),                                                 shouldReflect: true, on: 'update', description: 'Delay in ms before a completed file reorders. Only meaningful when sink-completed is on.' },
    { configKey: 'progressMode',            attribute: 'progress-mode',       converter: toEnum(['optimistic', 'pessimistic'] as const, { default: 'optimistic' }),   shouldReflect: true, on: 'update', description: 'Progress reporting contract: optimistic (tick before ACK, snap back on failure) or pessimistic (tick only after ACK).' },

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    { configKey: 'shouldKeepAliveWhenRemoved', attribute: 'keep-alive-when-removed', converter: toBool('default-false'),                                    on: 'none', type: 'boolean', description: 'Keep the store (files, running uploads) when the element is removed from the page. Default: a removal cancels every upload (handlers get their signal + cancel-timeout) and then destroys the store. A DOM move never tears anything down.' },


    // ── Persistence ───────────────────────────────────────────────────────────
    { configKey: 'storageKey',              attribute: 'storage-key',         converter: text(),                                                                       shouldReflect: true, on: 'update', description: 'Key of the persisted UI state (popover size; core SPEC §12.17). Unset / empty = off; set = localStorage `km-state:web-dropzone:<key>`, or `loadStateCallback` / `saveStateCallback`.' },

    // ── Callbacks (property-only) — each takes ONE ctx carrying `controller` + `element` ──
    { configKey: 'validateCallback',              converter: cb(),      on: 'update', type: '(ctx: ValidateContext) => ValidationResult', description: 'Custom per-file validation, after the built-in size / type checks. `ctx`: `{ file, existingFiles }`. Sync.' },
    { configKey: 'beforeFilesAddCallback',        converter: cb(),      on: 'update', type: '(ctx: BeforeFilesAddContext) => false | File[] | void | Promise<false | File[] | void>', description: 'Gate before a validated batch is added. `ctx`: `{ files, existingFiles }`. `false` cancels (files reported in `file-reject` with code `rejected`); a `File[]` replaces the batch (validated again); may be async.' },
    { configKey: 'beforeFilesRemoveCallback',     converter: cb(),      on: 'update', type: '(ctx: BeforeFilesRemoveContext) => false | void | Promise<false | void>', description: 'Gate before a user-initiated removal (row ✕, Clear all) or `removeFile` / `clear` with `{ confirm: true }`. `ctx`: `{ files, allFiles }`. `false` cancels; may be async.' },
    { configKey: 'beforeFilesCancelCallback',      converter: cb(),      on: 'update', type: '(ctx: BeforeFilesCancelContext) => false | void | Promise<false | void>', description: 'Gate before a cancel: `cancelFile(id)` / the row Cancel button (`files: [file]`) and `cancelAll()` / "Cancel all" (once, every file). `ctx`: `{ files, allFiles }`. `false` vetoes; may be async. Internal cancels (removing a running file, element removal) skip it.' },
    { configKey: 'uploadFileCallback',            converter: cb(),      on: 'update', type: '(ctx: FileUploadContext) => Promise<void | FileUploadResult>', description: 'Component-driven upload handler; added files run through the worker pool. `ctx`: `{ file, signal, setProgress, startBytes, startPercent, metadata, setMetadata, uploadMetadata }`.' },
    { configKey: 'retryPolicy',                   converter: toValue(), on: 'update', type: 'RetryPolicy', description: 'Retry policy applied when uploadFileCallback rejects. Property-only object.' },
    { configKey: 'fileIcons',                     converter: toValue(), on: 'update', type: 'Record<string, string>', description: 'Icon overrides keyed by extension or category (raw HTML — NOT sanitized). Property-only object.' },
    { configKey: 'getFileIconCallback',           converter: cb(),      on: 'update', type: '(ctx: FileIconContext) => string | null | undefined', description: 'Full-control file-icon resolver (raw HTML — NOT sanitized). `ctx`: `{ file }`. Return null to fall back to fileIcons / category.' },
    { configKey: 'renderFileItemCallback',        converter: cb(),      on: 'update', type: '(ctx: FileItemRenderContext) => string | HTMLElement', description: 'Custom render for a single file row (structural mode). `ctx`: `{ file, fileIndex, displayMode, isInPopover }`.' },
    { configKey: 'renderListWrapperCallback',     converter: cb(),      on: 'update', type: '(ctx: ListWrapperRenderContext) => string | HTMLElement', description: 'Custom wrapper around the rendered file rows (structural mode). `ctx`: `{ rowsHtml, files }`.' },
    { configKey: 'renderPromptCallback',          converter: cb(),      on: 'update', type: '(ctx: PromptRenderContext) => string | HTMLElement', description: 'Custom render for the drop-area prompt (structural mode). `ctx`: context only.' },
    { configKey: 'renderSummaryCallback',         converter: cb(),      on: 'update', type: '(ctx: SummaryRenderContext) => string | HTMLElement', description: 'Custom render for the compact-mode summary (structural mode). `ctx`: `{ files }`.' },
    { configKey: 'renderRollingBodyCallback',     converter: cb(),      on: 'update', type: 'StatusSurfaceCallback', description: 'Rolling list appearance (structural mode): replace the whole rolling body. `ctx`: `StatusSurfaceArgs`. `null` → default, `false` → hide.' },
    { configKey: 'renderRollingFileInfoCallback', converter: cb(),      on: 'update', type: 'StatusSurfaceCallback', description: 'Rolling list appearance (structural mode): the file-info slot of the current row. `ctx`: `StatusSurfaceArgs`.' },
    { configKey: 'renderRollingProgressCallback', converter: cb(),      on: 'update', type: 'StatusSurfaceCallback', description: 'Rolling list appearance (structural mode): the progress slot of the current row. `ctx`: `StatusSurfaceArgs`.' },
    { configKey: 'renderLoadingCallback',         converter: cb(),      on: 'update', type: '(ctx: LoaderRenderContext) => void | (() => void)', description: 'Draw the upload loader of the bound `<web-dropzone-indicator>` chip (`ctx.context` = `upload`): fill `ctx.containerElement`, optionally return a cleanup. Beats the page-wide `window.components.renderLoadingCallback`; unset = that, else the default `.dz__loader` (the shared `--base-loader-*` contract). The tiny per-row / summary loaders are CSS-only (`--dz-loader-*` tokens). Read when a loader is drawn.' },
    { configKey: 'customStyles',            attribute: 'custom-styles',       converter: toText({ isNullable: true }),                                                 on: 'update', type: 'string | null', description: 'Extra CSS for the shadow root (raw CSS — NOT sanitized). Comes after the page-wide `window.components[\'web-dropzone\'].customStyles`, so it overrides it; `getCustomStylesCallback` wins over it. An `@import` (an icon font) is also linked once in the document head (core).' },
    { configKey: 'getCustomStylesCallback',       converter: cb(),      on: 'update', type: '(ctx: CustomStylesContext) => string | null | undefined', description: 'Returns extra CSS for the shadow root (raw CSS — NOT sanitized); wins over `customStyles`. Re-run on every build and when `customStyles` / this callback change. `ctx`: context only (`controller`, `element`).' },
    { configKey: 'loadStateCallback',             converter: cb(),      on: 'update', type: 'LoadStateCallback<DropzoneState>', description: 'Persisted UI state source (core SPEC §12.17): `(ctx) => DropzoneState | null | Promise<…>`, `ctx`: `{ key }` + context. Set both callbacks; either one alone switches `localStorage` off. Read when the popover first opens.' },
    { configKey: 'saveStateCallback',             converter: cb(),      on: 'update', type: 'SaveStateCallback<DropzoneState>', description: 'Persisted UI state sink (core SPEC §12.17): `ctx`: `{ key, state }` + context, `state` = the WHOLE `DropzoneState` (`{ popoverWidth?, popoverHeight? }`). Set both callbacks; either one alone switches `localStorage` off. Called after the user resizes the popover.' },
];

/**
 * Event table (core SPEC §12.5): every happening is one DOM event (bubbles,
 * NOT composed) + a camelCase `on*` twin property called first with the same
 * detail. Every detail carries `controller` + `element` (non-enumerable).
 */
const EVENTS: readonly EventDef[] = [
    { name: 'file-add', description: 'A file entered the dropzone (one event per file). `detail`: `{ file }`. Twin: `onFileAdd(detail)`.' },
    { name: 'file-remove', description: 'A file left the list — LOCAL, client-side (row ✕, `removeFile(s)`, Clear all, a single-file replace, a mode-flip rebuild); one event per file. A running upload is cancelled first. Compare `file-delete`. `detail`: `{ file }`. Twin: `onFileRemove(detail)`.' },
    { name: 'files-change', description: 'Coalesced "queue updated" tick, at most once per animation frame. `detail`: `{ changedIds, files }`. Twin: `onFilesChange(detail)`.' },
    { name: 'change', description: 'The selection changed (add / remove / clear). `detail`: `{ files }`. Twin: `onChange(detail)`.' },
    { name: 'file-reject', description: 'Files failed validation, or `beforeFilesAddCallback` vetoed the add (code `rejected`). `detail`: `{ rejectedFiles: [{ file, validation: { valid, error, code } }] }`. Twin: `onFileReject(detail)`.' },
    { name: 'file-retry', description: 'A failed / cancelled file was re-queued (status already `pending`). `detail`: `{ file }`. Twin: `onFileRetry(detail)`.' },
    { name: 'file-upload', description: '`uploadFileCallback` resolved for a file. `detail`: `{ file }`. Twin: `onFileUpload(detail)`.' },
    { name: 'file-delete', description: 'SERVER state: a removed file had server-side state (upload completed, or metadata stashed via `setMetadata`) — fires right after its `file-remove`; wire your server DELETE here. `detail`: `{ file }`. Twin: `onFileDelete(detail)`.' },
    { name: 'file-cancel', description: 'A cancel finished. `detail`: `{ file, result: \'cancelled\' | \'timeout-error\' | \'timeout-remove\', uploadedBytes, metadata }`. Server-side cleanup of a partial upload is the app\'s job. Twin: `onFileCancel(detail)`.' },
    { name: 'file-progress', description: 'A file\'s progress changed. `detail`: `{ id, progress, status, file }`. Twin: `onFileProgress(detail)`.' },
    { name: 'file-status-change', description: 'A file\'s status transitioned. `detail`: `{ id, oldStatus, newStatus, file }`. Twin: `onFileStatusChange(detail)`.' },
    { name: 'file-update', description: 'A file field other than progress / status changed (preview generated, upload result merged). `detail`: `{ file }`. Twin: `onFileUpdate(detail)`.' },
    { name: 'overlay-enter', description: 'A drag entered the drag overlay (`overlay-target`). `detail`: `{ overlayElement }`. Twin: `onOverlayEnter(detail)`.' },
    { name: 'overlay-leave', description: 'A drag left the drag overlay. `detail`: `{ overlayElement }`. Twin: `onOverlayLeave(detail)`.' },
    { name: 'ready', description: 'Core lifecycle event: fired ONCE, after the first build (the store is live, `el.controller` works). A later rebuild (mode flip) or a DOM move does not fire it again. The host gets the `ready` attribute and `:state(ready)`; `await el.whenReady()` is the promise form. Hold the first build with the `defer` attribute and `release()`. `detail`: `controller` / `element`. Twin: `onReady(detail)`.' },
];

/**
 * Every `<web-dropzone>` input, keyed by `configKey` — exactly the input rows:
 * the store's `DropzoneConfig` without its engine wiring (`isHeadless`,
 * `container`, `hostElement`), plus the element-only inputs. The element's
 * typed properties (`el.maxFileSize`, `el.isReadonly`, …) and the responsive
 * rules' partials use it. Inputs that are unset by default (`null` = not set,
 * the store decides) are typed `| null`.
 */
export type DropzoneElementConfig = Omit<
    DropzoneConfig,
    | 'isHeadless' | 'container' | 'hostElement'
    | 'accept' | 'icon' | 'cancelIcon' | 'removeIcon' | 'overlayIcon' | 'name' | 'storageKey'
    | 'renderMode' | 'selectorAppearance' | 'listAppearance' | 'cardSize' | 'isThumbnailsShown'
    | 'controls' | 'itemControls' | 'labels'
> & {
    /** Partial UI strings; `undefined` = the built-in English (`null` is refused). */
    labels?: Partial<DropzoneLabels>;
    accept?: string | null;
    icon?: string | null;
    cancelIcon?: string | null;
    removeIcon?: string | null;
    overlayIcon?: string | null;
    name?: string | null;
    storageKey?: string | null;
    renderMode?: DropzoneRenderMode | null;
    selectorAppearance?: SelectorAppearance | null;
    listAppearance?: ListAppearance | null;
    cardSize?: CardSize | null;
    /** Tristate: `null` = auto (thumbnails for grid, icons elsewhere). */
    isThumbnailsShown?: boolean | null;
    controls?: DropzoneControl[] | null;
    itemControls?: FileItemPart[] | null;
    /** Extra shadow-root CSS (raw); the instance layer over the page-wide one. */
    customStyles?: string | null;
    shouldKeepAliveWhenRemoved?: boolean;
    renderLoadingCallback?: RenderLoaderCallback | null;
};

/**
 * DropzoneElement - <web-dropzone> custom element
 */
export class DropzoneElement extends BlissElement<DropzoneEventMap, DropzoneController> {
    // Opt into the form-associated custom element lifecycle so the surrounding
    // <form> sees this element in form.elements, form.reset(), and FormData
    // submissions. Core owns the single attachInternals() (exposed lazily via
    // the protected `internals` getter and the public `el.form`).
    static formAssociated = true;

    protected static override inputs = INPUTS;
    protected static override events = EVENTS;

    // `on*` twins — called with the event detail (core installs the accessors).
    declare onFileAdd: ((detail: FileAddEventDetail) => void) | null;
    declare onFileRemove: ((detail: FileRemoveEventDetail) => void) | null;
    declare onFilesChange: ((detail: FilesChangeEventDetail) => void) | null;
    declare onChange: ((detail: ChangeEventDetail) => void) | null;
    declare onFileReject: ((detail: FileRejectEventDetail) => void) | null;
    declare onFileRetry: ((detail: FileRetryEventDetail) => void) | null;
    declare onFileUpload: ((detail: FileUploadEventDetail) => void) | null;
    declare onFileDelete: ((detail: FileDeleteEventDetail) => void) | null;
    declare onFileCancel: ((detail: FileCancelEventDetail) => void) | null;
    declare onFileProgress: ((detail: FileProgressEventDetail) => void) | null;
    declare onFileStatusChange: ((detail: FileStatusChangeEventDetail) => void) | null;
    declare onFileUpdate: ((detail: FileUpdateEventDetail) => void) | null;
    declare onOverlayEnter: ((detail: OverlayEventDetail) => void) | null;
    declare onOverlayLeave: ((detail: OverlayEventDetail) => void) | null;
    declare onReady: ((detail: ReadyEventDetail) => void) | null;

    #shadow: ShadowRoot;
    #dropzone?: WebDropzone;
    #container: HTMLElement;
    /** Core's custom-CSS handle (page layer + instance layer), made on the first build. */
    #customStyles: CustomStylesHandle | null = null;
    /** Unsubscribe from the shared page-drag tracker (set while `highlight-on-page-drag` is live). */
    #unsubscribePageDrag?: () => void;
    #isArmed = false;

    /**
     * What the engine reports to — built once, so every engine (each rebuild)
     * shares it: `element` / `controller` for every ctx, and `notify` routing
     * engine happenings to `emit()`.
     */
    /**
     * Persisted UI state (core SPEC §12.17, rulebook C-CA-17): one handle on
     * the host — `storage-key` + `loadStateCallback` / `saveStateCallback`,
     * default localStorage `km-state:web-dropzone:<key>`. Made here (not in
     * the store) so it outlives a rebuild; injected through the engine host.
     */
    readonly #stateStore = createStateStore<DropzoneState>(this, {
        getKey: () => this.config.storageKey as string | null,
        getLoadCallback: () => this.config.loadStateCallback as LoadStateCallback<DropzoneState> | null,
        getSaveCallback: () => this.config.saveStateCallback as SaveStateCallback<DropzoneState> | null,
        toContext: (data) => this.withContext(data),
    });

    readonly #engineHost: DropzoneEngineHost = {
        element: this,
        stateStore: this.#stateStore,
        getController: () => this.controller,
        notify: (name, detail) => {
            // Re-stamp the form value before listeners run, so a `change`
            // handler reading the form sees the new selection.
            if (name === 'change') this.#syncFormValue();
            this.emit(name, detail as never);
        }
    };

    constructor() {
        super();

        // Shadow DOM + the shared base stylesheet (one constructed sheet for every instance).
        this.#shadow = this.attachShadow({ mode: 'open' });
        adoptStyles(this.#shadow, styles);

        // Container the core store renders into.
        this.#container = document.createElement('div');
        this.#container.className = 'dz__host';
        this.#shadow.appendChild(this.#container);

        // Satellites bind through a NON-flushing twin of `el.controller`
        // (see store-link.ts): they read the store while it is emitting.
        linkStoreController(this, createDropzoneController(() => this.#dropzone));
        linkStoreReorder(this, (file) => this.#dropzone?.isReorderEligible(file) ?? false);
    }

    /**
     * The public facade (`el.controller`): built once, delegates to the live
     * store (flushing pending input writes first), so it survives rebuilds.
     * Satellites bind through it too.
     */
    protected override createController(): DropzoneController {
        return createDropzoneController(() => {
            this.flush();
            return this.#dropzone;
        });
    }

    /**
     * Called by the browser when the surrounding <form> is reset. Clears the
     * dropzone selection so the component participates in the standard reset.
     */
    formResetCallback(): void {
        this.#dropzone?.clear();
    }

    /**
     * Core reports a flip of the effective disabled state — the `disabled`
     * input OR an ancestor `<fieldset disabled>` (`isEffectivelyDisabled`).
     * `el.isDisabled` keeps the author's value, like a native control.
     */
    protected override disabledChanged(isDisabled: boolean): void {
        this.#dropzone?.updateConfig({ isDisabled });
        this.#syncArmed();
    }

    /**
     * True while the dropzone is armed (`highlight-on-page-drag` + files are
     * dragged over the page + it accepts drops). Mirrors the `armed` attribute
     * / `:state(armed)`.
     */
    get isArmed(): boolean {
        return this.#isArmed;
    }

    // ── core lifecycle hooks ──────────────────────────────────────────────────

    /** Structural change (or first connect): rebuild the store from scratch. */
    protected override reinit(): void {
        this.#rebuildStore();
        this.#syncPageDrag();
    }

    /**
     * Custom CSS (core usage "Style injection", rulebook C-CA-15): the page
     * layer `window.components['web-dropzone'].customStyles` /
     * `.getCustomStylesCallback(ctx)`, then this instance's `customStyles` /
     * `getCustomStylesCallback`. One handle, made on the first build, refreshed
     * per build.
     */
    #applyCustomStyles(): void {
        if (this.#customStyles) return this.#customStyles.refresh();
        this.#customStyles = createCustomStyles(this, this.#shadow, {
            cssClass: 'dz-custom-styles',
            getContext: () => this.withContext({}),
            getInstanceStyles: () => ({
                css: this.config.customStyles as string | null,
                callback: this.config.getCustomStylesCallback as ((ctx: object) => string | null | undefined) | null,
            }),
        });
    }

    /**
     * In-place change: patch the live store via `updateConfig`. A change to any
     * of the four mode-determining inputs can flip the operating mode, which the
     * store can't apply in place — detect that and do a full rebuild instead
     * (matching the pre-core behaviour, where a mode flip reset the selection).
     */
    protected override update(partial: Record<string, unknown>): void {
        if ('shouldHighlightOnPageDrag' in partial || 'isReadonly' in partial) this.#syncPageDrag();
        if (
            'renderMode' in partial ||
            'displayMode' in partial ||
            'selectorAppearance' in partial ||
            'listAppearance' in partial
        ) {
            const next = this.#resolveMode();
            if (this.#dropzone && this.#dropzone.getConfig().renderMode !== next) {
                this.#rebuildStore();
                return;
            }
        }

        // Custom styles are a shadow-root concern, not a store change.
        if ('customStyles' in partial || 'getCustomStylesCallback' in partial) this.#customStyles?.refresh();

        const storePartial: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(partial)) {
            if (key === 'customStyles' || key === 'getCustomStylesCallback') continue; // handled above
            if (key === 'renderLoadingCallback') continue;   // read by the loaders when they draw
            storePartial[key] = value === null ? undefined : value;
        }
        delete storePartial.isDisabled; // applied by disabledChanged() (input OR fieldset)
        if (this.#dropzone && Object.keys(storePartial).length > 0) {
            this.#dropzone.updateConfig(storePartial as Partial<DropzoneConfig>);
        }

        // Form-relevant changes re-stamp the FormData; minFileCount alone only
        // affects validity.
        if ('name' in partial || 'valueFormat' in partial) {
            this.#syncFormValue();
        } else if ('minFileCount' in partial || 'labels' in partial) {
            this.#syncValidity(this.#dropzone?.getFiles().length ?? 0);
        }
    }

    /**
     * Activate: (re)start the store's page-level wiring. The store itself is
     * built once by `reinit()` and survives a DOM move — files, in-flight
     * uploads and popover state are kept (decision D1). Only a store torn down
     * by a removal (`removedCallback`) is rebuilt here, fresh and empty. The
     * FOUC hook is core's `ready` attribute / `:state(ready)`.
     */
    protected override connect(): void {
        if (this.#dropzone) this.#dropzone.activate();
        else this.#buildStore();
        this.#syncPageDrag();

        initLogger.debug('DropzoneElement connected');
    }

    /**
     * Deactivate: stop the store's document / window listeners and popover
     * positioning. The store, its files and uploads are kept — a DOM move
     * reconnects without a rebuild; `destroy()` tears it down.
     */
    protected override disconnect(): void {
        this.#dropzone?.deactivate();
        this.#syncPageDrag();
        initLogger.debug('DropzoneElement disconnected');
    }

    /**
     * Removed from the page (still detached one frame after `disconnect()` —
     * a DOM move never gets here). Unless `keep-alive-when-removed`:
     * cancel every upload by the cancel rule (handlers get their signal and
     * up to `cancel-timeout`; no `beforeFilesCancelCallback` — there is no UI
     * to veto from) and then destroy the store. Re-adding the element after
     * that builds a fresh, empty store (`connect()`; `ready` does not fire
     * again — it is a once-per-element core event); re-adding it while the
     * cancels are still settling keeps the store (its uploads cancelled).
     */
    protected override removedCallback(): void {
        if (this.config.shouldKeepAliveWhenRemoved) return;
        const engine = this.#dropzone;
        if (!engine) return;
        void engine.cancelAllNow().finally(() => {
            if (this.#dropzone !== engine || this.isConnected) return; // re-added meanwhile
            this.#teardownStore(engine);
            initLogger.debug('DropzoneElement removed — uploads cancelled, store destroyed');
        });
    }

    /**
     * `el.destroy()` (core) — final teardown, immediate: every running upload
     * handler gets its AbortSignal at once (no `cancel-timeout` grace, no
     * events after — the app asked for it; contrast `removedCallback`, which
     * cancels by the cancel rule first). Destroys the store and clears the
     * form value; the element is inert afterwards.
     */
    protected override destroyCallback(): void {
        if (this.#dropzone) this.#teardownStore(this.#dropzone);
        this.#customStyles?.destroy();
        this.#customStyles = null;
    }

    // ── armed (highlight-on-page-drag) ───────────────────────────────────────

    /**
     * Join / leave the shared page-drag tracker per `highlight-on-page-drag`
     * and the connection state (one page listener set for every instance),
     * then re-derive the armed state.
     */
    #syncPageDrag(): void {
        const shouldTrack = this.isConnected && !!this.config.shouldHighlightOnPageDrag;
        if (shouldTrack && !this.#unsubscribePageDrag) {
            this.#unsubscribePageDrag = subscribePageFileDrag(() => this.#syncArmed());
        } else if (!shouldTrack && this.#unsubscribePageDrag) {
            this.#unsubscribePageDrag();
            this.#unsubscribePageDrag = undefined;
        }
        this.#syncArmed();
    }

    /** Armed = tracking + a file drag over the page + the dropzone accepts drops. */
    #syncArmed(): void {
        const isArmed = !!this.#unsubscribePageDrag
            && isPageFileDragActive()
            && !this.isEffectivelyDisabled
            && !this.config.isReadonly;
        if (isArmed === this.#isArmed) return;
        this.#isArmed = isArmed;
        applyArmedState(this, this.internals, isArmed);
    }

    /** Destroy `engine` (if it is still the live store) and clear the form value. */
    #teardownStore(engine: WebDropzone): void {
        if (this.#dropzone !== engine) return;
        engine.destroy();
        this.#dropzone = undefined;
        this.#syncFormValue();
    }

    // ── store lifecycle ───────────────────────────────────────────────────────

    /**
     * Replace the store (a mode flip). The old store's files can't move to
     * the new one (in-flight handlers are bound to it), so they are removed
     * and REPORTED — `file-remove` per file + one `change` — before the old
     * store is destroyed; their uploads get the abort signal.
     */
    #rebuildStore(): void {
        const old = this.#dropzone;
        if (old) {
            old.dropAllFiles();
            old.destroy();
        }
        this.#dropzone = undefined;
        this.#buildStore();
    }

    #buildStore(): void {
        const config = this.#assembleConfig();
        this.#applyCustomStyles();

        this.#dropzone = new WebDropzone(this.#container, config, this.#engineHost);
        this.#syncFormValue();

        // The store is live: `el.controller` now reaches it. Satellites that
        // are waiting for a store (connected first, or mounted by the store
        // itself during the build) bind on this internal signal; core's public
        // `ready` fires once, after the first build.
        announceStoreBuild(this);

        initLogger.debug('Dropzone initialized', { config });
    }

    /**
     * Resolve the effective `renderMode` from the explicit input + implicit
     * detection. An explicit `render-mode="…"` / `el.renderMode` always wins.
     * Otherwise: presence of any renderer-trigger attribute → 'bulk'; absence
     * → 'headless'. The implicit path never lands on 'structural' — that
     * requires an explicit `render-mode="structural"`.
     */
    #resolveMode(): DropzoneRenderMode {
        const explicit = this.config.renderMode as DropzoneRenderMode | null;
        if (explicit) return explicit;
        const hasRendererAttr = this.hasAttribute('display-mode')
            || this.hasAttribute('selector-appearance')
            || this.hasAttribute('list-appearance');
        return hasRendererAttr ? 'bulk' : 'headless';
    }

    /**
     * Build the store config from the merged `this.config`: strip "unset" (null)
     * keys so the store sees them as absent (it applies its own defaults), then
     * add the runtime wiring (resolved mode, container, host element).
     */
    #assembleConfig(): DropzoneConfig {
        const cfg: Record<string, unknown> = { ...this.config };
        for (const key of Object.keys(cfg)) {
            if (cfg[key] === null) delete cfg[key];
        }

        // Element-only inputs: the store never reads them.
        delete cfg.customStyles;
        delete cfg.shouldKeepAliveWhenRemoved;

        cfg.isDisabled = this.isEffectivelyDisabled;

        const renderMode = this.#resolveMode();
        cfg.renderMode = renderMode;
        cfg.isHeadless = renderMode === 'headless';

        // Shadow DOM container for popover anchoring + form-element host.
        cfg.container = this.#container;
        cfg.hostElement = this;
        return cfg as DropzoneConfig;
    }

    // ── form value ────────────────────────────────────────────────────────────

    /**
     * Build a FormData containing every selected File under the configured
     * `name`, and hand it to `internals.setFormValue()`. This is what makes the
     * surrounding <form> submit real file blobs the same way `<input type="file">`
     * would. If `internals` is unavailable (older browser, jsdom), this is a
     * no-op and consumers can still read `this.files` programmatically.
     */
    #syncFormValue(): void {
        const internals = this.internals;
        if (!internals) return;
        const files = this.#dropzone?.getFiles() ?? [];
        const name = this.getAttribute('name');

        if (!name || files.length === 0) {
            internals.setFormValue(null);
        } else {
            const formData = new FormData();
            for (const f of files) {
                formData.append(name, f.file, f.name);
            }
            internals.setFormValue(formData);
        }

        this.#syncValidity(files.length);
    }

    /**
     * Reflect `minFileCount` into the form's native validity. When the selection
     * is short, the surrounding form's submit refuses with the native validation
     * message instead of silently submitting an incomplete payload.
     */
    #syncValidity(fileCount: number): void {
        const internals = this.internals;
        if (!internals) return;
        const min = this.#dropzone?.getConfig().minFileCount ?? 0;
        if (min > 0 && fileCount < min) {
            internals.setValidity(
                { valueMissing: true },
                countLabel(this.#dropzone?.label ?? defaultLabel, 'errorMinFileCount', min)
            );
        } else {
            internals.setValidity({});
        }
    }

    // ── public API ────────────────────────────────────────────────────────────

    /** Get all current files. */
    get files(): FileState[] {
        this.flush();
        return this.#dropzone?.getFiles() || [];
    }

    /**
     * `true` while any file is pending / uploading / paused / cancelling —
     * work that leaving the page (or removing the element) would lose.
     * Graceful exit: `await el.cancelAll(); el.destroy()`.
     */
    get hasActiveUploads(): boolean {
        this.flush();
        return !!this.#dropzone?.hasActiveUploads;
    }

    /** Add files programmatically. */
    addFiles(files: FileList | File[]): Promise<void> {
        this.flush();
        return this.#dropzone?.addFiles(files) ?? Promise.resolve();
    }

    /** Remove a file by ID. Skips the removal gate unless `opts.confirm` is set. */
    removeFile(id: string, opts?: { confirm?: boolean }): Promise<void> {
        this.flush();
        return this.#dropzone?.removeFile(id, opts) ?? Promise.resolve();
    }

    /** Remove files by ID (the pair of `addFiles`). Same gate semantics as `removeFile`; the gate runs once for the batch. */
    removeFiles(ids: readonly string[], opts?: { confirm?: boolean }): Promise<void> {
        this.flush();
        return this.#dropzone?.removeFiles(ids, opts) ?? Promise.resolve();
    }

    /** Clear all files. Same gate semantics as `removeFile`. */
    clear(opts?: { confirm?: boolean }): Promise<void> {
        this.flush();
        return this.#dropzone?.clear(opts) ?? Promise.resolve();
    }

    /** Update file progress (for upload tracking). */
    updateFileProgress(id: string, progress: number): void {
        this.flush();
        this.#dropzone?.updateFileProgress(id, progress);
    }

    /** Set file status (pending, uploading, complete, error). */
    setFileStatus(id: string, status: FileState['status'], error?: string): void {
        this.flush();
        this.#dropzone?.setFileStatus(id, status, error);
    }

    /** The file with this id, or `null`. */
    getFileById(id: string): FileState | null {
        this.flush();
        return this.#dropzone?.getFileById(id) ?? null;
    }

    // ── upload pipeline — only meaningful when uploadFileCallback is set ───────

    /** Drain the queue of pending files through the worker pool. */
    uploadAll(): Promise<void> {
        this.flush();
        return this.#dropzone?.uploadAll() ?? Promise.resolve();
    }

    /** Upload a single file immediately, bypassing the queue. */
    uploadFile(id: string): Promise<void> {
        this.flush();
        return this.#dropzone?.uploadFile(id) ?? Promise.resolve();
    }

    /** Pause an in-flight upload. */
    pauseFile(id: string): void { this.flush(); this.#dropzone?.pauseFile(id); }

    /** Resume a paused file and re-queue it. */
    resumeFile(id: string): Promise<void> {
        this.flush();
        return this.#dropzone?.resumeFile(id) ?? Promise.resolve();
    }

    /**
     * Cancel a file's upload (uploading / pending / paused). Resolves when the
     * cancel finished — at once when nothing runs, else when the handler
     * settles or `cancel-timeout` fires.
     */
    cancelFile(id: string): Promise<void> {
        this.flush();
        return this.#dropzone?.cancelFile(id) ?? Promise.resolve();
    }

    /** Pause every uploading / pending file. */
    pauseAll(): void { this.flush(); this.#dropzone?.pauseAll(); }

    /**
     * Cancel every uploading / pending / paused file (`beforeFilesCancelCallback`
     * asked once). Resolves when every cancel finished.
     */
    cancelAll(): Promise<void> {
        this.flush();
        return this.#dropzone?.cancelAll() ?? Promise.resolve();
    }

    /** Resume every paused file. */
    resumeAll(): Promise<void> {
        this.flush();
        return this.#dropzone?.resumeAll() ?? Promise.resolve();
    }

    /** Retry every errored / cancelled file. */
    retryAll(): void { this.flush(); this.#dropzone?.retryAll(); }

    /** Retry a single file. */
    retryFile(id: string): void { this.flush(); this.#dropzone?.retryFile(id); }
}

/** Every input as a typed property (core usage "Typing the properties", rulebook C-CA-16). */
export interface DropzoneElement extends DropzoneElementConfig {}
