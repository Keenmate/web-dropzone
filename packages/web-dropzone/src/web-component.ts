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
 * (`WebDropzone` in `dropzone.ts`), the operating-mode resolution, form-value
 * sync (real `File` blobs via `setFormValue`) and custom-style injection. The
 * `ready` event / attribute, `defer` / `release()` and `destroy()` come from core.
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
    toBool,
    toEnum,
    toInt,
    toText,
    toValue,
    toFunction,
    toCustom,
    type InputDef,
    type Converter,
    type EventDef,
} from '@keenmate/web-components-core';
import { WebDropzone } from './dropzone';
import { linkStoreController, linkStoreReorder, STORE_BUILD_EVENT } from './store-link';
import { initLogger, createDropzoneController, isLabelsValue } from '@keenmate/web-dropzone-core';
import type {
    DropzoneController,
    DropzoneEngineHost,
    DropzoneEventMap,
    FileAddEventDetail,
    FileRemoveEventDetail,
    FilesChangeEventDetail,
    ChangeEventDetail,
    FilesRejectEventDetail,
    FileRetryEventDetail,
    FileUploadCompleteEventDetail,
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
    DisplayMode,
    DropzoneMode,
    SelectorAppearance,
    ListAppearance,
    GridLayout,
    GridStatus,
    RollingRotation,
    CardSize,
    ValueFormat,
    FileState,
    DropzoneLabels
} from '@keenmate/web-dropzone-core';

// Import CSS as inline string for Shadow DOM injection
import styles from './css/main.css?inline';

/**
 * Parse a byte count from a string. Accepts plain integers ("5242880") and
 * human-readable forms with case-insensitive unit suffixes and optional
 * whitespace ("5MB", "300 kB", "1.5GB", "1024B"). Returns null if the input
 * doesn't match; the converter falls back to the spec's default in that case.
 *
 * Binary units (1024-based) — matches the display side in formatFileSize().
 * Aliases: K/KB, M/MB, G/GB, T/TB (no SI variants — `5MB` always means
 * 5 × 1024 × 1024). This is intentionally wider than core's `toBytes`, which
 * doesn't accept the single-letter aliases; that's why the size inputs wrap
 * `parseBytes` in `toCustom` rather than using `toBytes` directly.
 */
const BYTE_UNIT_MULTIPLIERS: Record<string, number> = {
    '':   1,
    'b':  1,
    'k':  1024,
    'kb': 1024,
    'm':  1024 ** 2,
    'mb': 1024 ** 2,
    'g':  1024 ** 3,
    'gb': 1024 ** 3,
    't':  1024 ** 4,
    'tb': 1024 ** 4
};

export function parseBytes(raw: string): number | null {
    const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*([a-z]*)$/i);
    if (!m) return null;
    const value = parseFloat(m[1]);
    const mult = BYTE_UNIT_MULTIPLIERS[m[2].toLowerCase()];
    if (mult === undefined) return null;
    return Math.round(value * mult);
}

const PLACEMENTS = [
    'top', 'top-start', 'top-end',
    'bottom', 'bottom-start', 'bottom-end',
    'left', 'left-start', 'left-end',
    'right', 'right-start', 'right-end'
] as const;

/** Byte-size input: preserves dropzone's `parseBytes` (single-letter aliases). */
const bytes = (def: number): Converter<number> =>
    toCustom<number>(
        (raw) => (raw == null ? def : parseBytes(raw) ?? def),
        {
            validate: (v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0,
            toAttribute: (v) => (v == null ? null : String(v)),
        },
    );

/** Optional string: absent / empty → null (normalized to "absent" for the store). */
const text = (): Converter<string | null> => toText({ isNullable: true });

/** Any callback input (property-only). */
const cb = (): ReturnType<typeof toFunction> => toFunction();

/**
 * Comma-separated allowlist input (Plyr-style `controls`). Parses
 * `"a, b ,c"` → `['a','b','c']`, lower-cased, de-duplicated, and filtered to
 * the supplied valid tokens (unknown tokens are dropped). Absent / empty →
 * null, which the store reads as "unset" (render everything). Reflects back as
 * the joined string.
 */
const list = <T extends string>(valid: readonly T[]): Converter<T[] | null> =>
    toCustom<T[] | null>(
        (raw) => {
            if (raw == null) return null;
            const allowed = new Set<string>(valid);
            const seen = new Set<string>();
            const tokens = raw
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .filter((t) => t && allowed.has(t) && !seen.has(t) && seen.add(t)) as T[];
            return tokens.length ? tokens : null;
        },
        {
            validate: (v): v is T[] | null =>
                v == null || (Array.isArray(v) && v.every((x) => typeof x === 'string')),
            toAttribute: (v) => (Array.isArray(v) && v.length ? v.join(',') : null),
        },
    );

/**
 * `labels` input: a partial `DropzoneLabels` object (property), or the same as
 * a JSON attribute (`labels='{"cancelFile":"Zrušit {name}"}'`). Absent → null
 * (built-in English). A malformed attribute is reported and the previous value
 * kept (core's invalid-attribute rule). Merged per key at lookup time.
 */
const labelsConverter: Converter<Partial<DropzoneLabels> | null> = toCustom<Partial<DropzoneLabels> | null>(
    (raw, reportInvalid) => {
        if (raw == null || raw.trim() === '') return null;
        try {
            const parsed: unknown = JSON.parse(raw);
            if (isLabelsValue(parsed)) return parsed;
        } catch { /* reported below */ }
        reportInvalid?.('expected a JSON object of strings');
        return null;
    },
    { validate: (v): v is Partial<DropzoneLabels> | null => v == null || isLabelsValue(v) },
);

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
    { configKey: 'isMultipleEnabled',       attribute: 'multiple',            converter: toBool('default-true'),                                                       on: 'update', type: 'boolean', description: 'Allow selecting multiple files. Public property: `el.multiple`.' },
    { configKey: 'maxFileSize',             attribute: 'max-file-size',       converter: bytes(0),                                                                     shouldReflect: true, on: 'update', description: 'Maximum size per file in bytes (accepts "5MB", "1.5GB", …). 0 = unlimited.' },
    { configKey: 'minFileSize',             attribute: 'min-file-size',       converter: bytes(0),                                                                     shouldReflect: true, on: 'update', description: 'Minimum size per file in bytes. 0 = no minimum.' },
    { configKey: 'maxTotalSize',            attribute: 'max-total-size',      converter: bytes(0),                                                                     shouldReflect: true, on: 'update', description: 'Maximum combined size of all files in bytes. 0 = unlimited.' },
    { configKey: 'maxFileCount',            attribute: 'max-file-count',      converter: toInt({ default: 0 }),                                                        shouldReflect: true, on: 'update', description: 'Maximum number of files. 0 = unlimited.' },
    { configKey: 'minFileCount',            attribute: 'min-file-count',      converter: toInt({ default: 0 }),                                                        shouldReflect: true, on: 'update', description: 'Minimum number of files; reflected into the form validity (valueMissing).' },
    { configKey: 'maxVisibleFiles',         attribute: 'max-visible-files',   converter: toInt({ default: 7 }),                                                        shouldReflect: true, on: 'update', description: 'How many file rows are visible before the list scrolls.' },
    { configKey: 'dedupeMode',              attribute: 'dedupe-mode',         converter: toEnum(['name', 'name-size', 'none'] as const, { default: 'name' }),          shouldReflect: true, on: 'update', description: 'How duplicate files are detected: by name, name+size, or not at all.' },
    { configKey: 'isDisabled',              attribute: 'disabled',            converter: toBool('default-false'),                                                      on: 'update', type: 'boolean', description: 'Disable the dropzone. Public property: `el.disabled`.' },

    // ── Operating mode ────────────────────────────────────────────────────────
    { configKey: 'mode',                    attribute: 'mode',                converter: toEnum(['bulk', 'structural', 'headless'] as const),                          on: 'update', description: 'Operating mode. When absent it is inferred from the presence of renderer-trigger attributes (display-mode / selector-appearance / list-appearance → bulk; none → headless). `structural` is the only way to opt into render callbacks.' },
    { configKey: 'progressThrottle',        attribute: 'progress-throttle',   converter: toInt({ default: 0 }),                                                        shouldReflect: true, on: 'update', description: 'Throttle interval in ms for file-progress events. 0 = every tick.' },

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
    { configKey: 'isShowThumbnailsEnabled', attribute: 'show-thumbnails',     converter: toBool('tristate'),                                                           on: 'update', type: 'boolean', description: 'Force image thumbnails on/off. Property-only tristate: unset (undefined) means auto (on for grid, icons elsewhere). Public property: `el.showThumbnails`.' },
    { configKey: 'isFilesInsideEnabled',    attribute: 'files-inside',        converter: toBool('default-false'),                                                      on: 'update', type: 'boolean', description: 'Render the file list inside the drop area. Public property: `el.filesInside`.' },
    { configKey: 'cancelIcon',              attribute: 'cancel-icon',         converter: text(),                                                                       shouldReflect: true, on: 'update', description: 'HTML for the row Cancel (⊘) button glyph (raw HTML — NOT sanitized). Unset = built-in icon.' },
    { configKey: 'removeIcon',              attribute: 'remove-icon',         converter: text(),                                                                       shouldReflect: true, on: 'update', description: 'HTML for the row Remove (✕) button glyph (raw HTML — NOT sanitized). Unset = built-in icon.' },
    { configKey: 'icon',                    attribute: 'icon',                converter: text(),                                                                       shouldReflect: true, on: 'update', description: 'Prompt icon (emoji or markup).' },
    { configKey: 'labels',                  attribute: 'labels',              converter: labelsConverter,                                                              on: 'update', type: 'Partial<DropzoneLabels>', description: 'UI strings, merged per key over the built-in English (`{name}` / `{count}` / `{status}` placeholders): prompt, hint, dragActive, selectFiles, noFileChosen, overlay, status names, row + bulk buttons. Property (object) or JSON attribute. Live.' },
    { configKey: 'emptyMessage',            attribute: 'empty-message',       converter: text(),                                                                       shouldReflect: true, on: 'update', description: 'Message shown when the file list is empty.' },

    // ── Compact mode ──────────────────────────────────────────────────────────
    { configKey: 'summaryTemplate',         attribute: 'summary-template',    converter: text(),                                                                       shouldReflect: true, on: 'update', description: 'Template string for the compact-mode summary line.' },
    { configKey: 'popoverPlacement',        attribute: 'popover-placement',   converter: toEnum(PLACEMENTS, { default: 'bottom-start' }),                              shouldReflect: true, on: 'update', description: 'Placement of the compact-mode popover relative to the summary (floating-ui placement).' },

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

    // ── Form integration ──────────────────────────────────────────────────────
    { configKey: 'name',                    attribute: 'name',                converter: text(),                                                                       shouldReflect: true, on: 'update', description: 'Form field name. Files submit as real FormData blobs under this name.' },
    { configKey: 'valueFormat',             attribute: 'value-format',        converter: toEnum(['json', 'csv', 'array'] as const, { default: 'json' }),               shouldReflect: true, on: 'update', description: 'Fallback hidden-input serialization format hint (FormData blobs are always submitted for files).' },

    // ── Upload pipeline (meaningful once uploadFileCallback is set) ────────────
    { configKey: 'concurrency',             attribute: 'concurrency',         converter: toInt({ default: 1 }),                                                        shouldReflect: true, on: 'update', description: 'Maximum concurrent uploads through the worker pool.' },
    { configKey: 'cancelTimeout',           attribute: 'cancel-timeout',      converter: toInt({ min: 0, default: 2000 }),                                             shouldReflect: true, on: 'update', description: 'How long (ms) a cancel waits for the aborted upload handler to settle (the row shows "Cancelling…"). Settles in time → `cancelled`; otherwise `cancel-timeout-behavior` applies and later results are ignored.' },
    { configKey: 'cancelTimeoutBehavior',   attribute: 'cancel-timeout-behavior', converter: toEnum(['error', 'remove'] as const, { default: 'error' }),               shouldReflect: true, on: 'update', description: 'What a timed-out cancel does: `error` (status error, reason `cancel-timeout`, retryable) or `remove` (the file is removed from the list).' },
    { configKey: 'isAutoUploadEnabled',     attribute: 'auto-upload',         converter: toBool('default-true'),                                                       on: 'update', type: 'boolean', description: 'Auto-upload newly added files. Public property: `el.autoUpload`.' },
    { configKey: 'isUploadedFileDeletable',  attribute: 'uploaded-deletable',  converter: toBool('default-true'),                                                       on: 'update', type: 'boolean', description: 'Whether already-uploaded files can be removed. Public property: `el.uploadedDeletable`.' },
    { configKey: 'shouldSinkCompleted',     attribute: 'should-sink-completed', converter: toBool('default-false'),                                                  on: 'update', type: 'boolean', description: 'Auto-move completed files to the end of the list (after `reorder-completed-delay`).' },
    { configKey: 'reorderCompletedDelay',   attribute: 'reorder-completed-delay', converter: toInt({ default: 1500 }),                                                 shouldReflect: true, on: 'update', description: 'Delay in ms before a completed file reorders. Only meaningful when should-sink-completed is on.' },
    { configKey: 'progressMode',            attribute: 'progress-mode',       converter: toEnum(['optimistic', 'pessimistic'] as const, { default: 'optimistic' }),   shouldReflect: true, on: 'update', description: 'Progress reporting contract: optimistic (tick before ACK, snap back on failure) or pessimistic (tick only after ACK).' },

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    { configKey: 'shouldKeepAliveWhenRemoved', attribute: 'should-keep-alive-when-removed', converter: toBool('default-false'),                                    on: 'none', type: 'boolean', description: 'Keep the store (files, running uploads) when the element is removed from the page. Default: a removal cancels every upload (handlers get their signal + cancel-timeout) and then destroys the store. A DOM move never tears anything down.' },

    // ── Persistence ───────────────────────────────────────────────────────────
    { configKey: 'storageKey',              attribute: 'storage-key',         converter: text(),                                                                       shouldReflect: true, on: 'update', description: 'Opaque key scoping persisted UI state. Unset disables persistence.' },

    // ── Callbacks (property-only) — each takes ONE ctx carrying `controller` + `element` ──
    { configKey: 'validateCallback',              converter: cb(),      on: 'update', type: '(ctx: ValidateContext) => ValidationResult', description: 'Custom per-file validation, after the built-in size / type checks. `ctx`: `{ file, existingFiles }`. Sync.' },
    { configKey: 'beforeFilesAddCallback',        converter: cb(),      on: 'update', type: '(ctx: BeforeFilesAddContext) => false | File[] | void | Promise<false | File[] | void>', description: 'Gate before a validated batch is added. `ctx`: `{ files, existingFiles }`. `false` cancels (files reported in `files-reject` with code `rejected`); a `File[]` replaces the batch (validated again); may be async.' },
    { configKey: 'beforeFilesRemoveCallback',     converter: cb(),      on: 'update', type: '(ctx: BeforeFilesRemoveContext) => false | void | Promise<false | void>', description: 'Gate before a user-initiated removal (row ✕, Clear all) or `removeFile` / `clear` with `{ confirm: true }`. `ctx`: `{ files, allFiles }`. `false` cancels; may be async.' },
    { configKey: 'beforeFileCancelCallback',      converter: cb(),      on: 'update', type: '(ctx: BeforeFileCancelContext) => false | void | Promise<false | void>', description: 'Gate before a cancel: `cancelFile(id)` / the row Cancel button (`files: [file]`) and `cancelAll()` / "Cancel all" (once, every file). `ctx`: `{ files, allFiles }`. `false` vetoes; may be async. Internal cancels (removing a running file, element removal) skip it.' },
    { configKey: 'uploadFileCallback',            converter: cb(),      on: 'update', type: '(ctx: FileUploadContext) => Promise<void | FileUploadResult>', description: 'Component-driven upload handler; added files run through the worker pool. `ctx`: `{ file, signal, setProgress, startBytes, startPercent, metadata, setMetadata, uploadMetadata }`.' },
    { configKey: 'retryPolicy',                   converter: toValue(), on: 'update', type: 'RetryPolicy', description: 'Retry policy applied when uploadFileCallback rejects. Property-only object.' },
    { configKey: 'fileIcons',                     converter: toValue(), on: 'update', type: 'Record<string, string>', description: 'Icon overrides keyed by extension or category (raw HTML — NOT sanitized). Property-only object.' },
    { configKey: 'getFileIconCallback',           converter: cb(),      on: 'update', type: '(ctx: FileIconContext) => string | null | undefined', description: 'Full-control file-icon resolver (raw HTML — NOT sanitized). `ctx`: `{ file }`. Return null to fall back to fileIcons / category.' },
    { configKey: 'renderFileItemCallback',        converter: cb(),      on: 'update', type: '(ctx: FileItemRenderContext) => string | HTMLElement', description: 'Custom render for a single file row (structural mode). `ctx`: `{ file, index, displayMode, isInPopover }`.' },
    { configKey: 'renderListWrapperCallback',     converter: cb(),      on: 'update', type: '(ctx: ListWrapperRenderContext) => string | HTMLElement', description: 'Custom wrapper around the rendered file rows (structural mode). `ctx`: `{ rowsHtml, files }`.' },
    { configKey: 'renderPromptCallback',          converter: cb(),      on: 'update', type: '(ctx: PromptRenderContext) => string | HTMLElement', description: 'Custom render for the drop-area prompt (structural mode). `ctx`: context only.' },
    { configKey: 'renderSummaryCallback',         converter: cb(),      on: 'update', type: '(ctx: SummaryRenderContext) => string | HTMLElement', description: 'Custom render for the compact-mode summary (structural mode). `ctx`: `{ files }`.' },
    { configKey: 'renderRollingBodyCallback',     converter: cb(),      on: 'update', type: 'StatusSurfaceCallback', description: 'Rolling list appearance (structural mode): replace the whole rolling body. `ctx`: `StatusSurfaceArgs`. `null` → default, `false` → hide.' },
    { configKey: 'renderRollingFileInfoCallback', converter: cb(),      on: 'update', type: 'StatusSurfaceCallback', description: 'Rolling list appearance (structural mode): the file-info slot of the current row. `ctx`: `StatusSurfaceArgs`.' },
    { configKey: 'renderRollingProgressCallback', converter: cb(),      on: 'update', type: 'StatusSurfaceCallback', description: 'Rolling list appearance (structural mode): the progress slot of the current row. `ctx`: `StatusSurfaceArgs`.' },
    { configKey: 'getCustomStylesCallback',       converter: cb(),      on: 'update', type: '(ctx: CustomStylesContext) => string | null | undefined', description: 'Returns a CSS string injected into the shadow root (prepended so @import/@font-face work). `ctx`: context only.' },
    { configKey: 'persistStateCallback',          converter: cb(),      on: 'update', type: '(ctx: PersistStateContext) => void | Promise<void>', description: 'Custom persistence sink (defaults to localStorage). `ctx`: `{ key, state }`.' },
    { configKey: 'loadStateCallback',             converter: cb(),      on: 'update', type: '(ctx: LoadStateContext) => DropzoneState | null | Promise<DropzoneState | null>', description: 'Custom persistence source paired with persistStateCallback. `ctx`: `{ key }`.' },
];

/**
 * Event table (core SPEC §12.5): every happening is one DOM event (bubbles,
 * NOT composed) + a camelCase `on*` twin property called first with the same
 * detail. Every detail carries `controller` + `element` (non-enumerable).
 */
const EVENTS: readonly EventDef[] = [
    { name: 'file-add', description: 'A file entered the dropzone (one event per file). `detail`: `{ file }`. Twin: `onFileAdd(detail)`.' },
    { name: 'file-remove', description: 'A file left the dropzone (one event per file; also on Clear all). `detail`: `{ file }`. Twin: `onFileRemove(detail)`.' },
    { name: 'files-change', description: 'Coalesced "queue updated" tick, at most once per animation frame. `detail`: `{ changedIds, files }`. Twin: `onFilesChange(detail)`.' },
    { name: 'change', description: 'The selection changed (add / remove / clear). `detail`: `{ files }`. Twin: `onChange(detail)`.' },
    { name: 'files-reject', description: 'Files failed validation, or `beforeFilesAddCallback` vetoed the add (code `rejected`). `detail`: `{ rejectedFiles: [{ file, validation: { valid, error, code } }] }`. Twin: `onFilesReject(detail)`.' },
    { name: 'file-retry', description: 'A failed / cancelled file was re-queued (status already `pending`). `detail`: `{ file }`. Twin: `onFileRetry(detail)`.' },
    { name: 'file-upload-complete', description: '`uploadFileCallback` resolved for a file. `detail`: `{ file }`. Twin: `onFileUploadComplete(detail)`.' },
    { name: 'file-delete', description: 'A removed file had server-side state (completed, or metadata stashed via `setMetadata`) — fires with `file-remove`; wire your server DELETE here. `detail`: `{ file }`. Twin: `onFileDelete(detail)`.' },
    { name: 'file-cancel', description: 'A cancel finished. `detail`: `{ file, result: \'cancelled\' | \'timeout-error\' | \'timeout-remove\', uploadedBytes, metadata }`. Server-side cleanup of a partial upload is the app\'s job. Twin: `onFileCancel(detail)`.' },
    { name: 'file-progress', description: 'A file\'s progress changed. `detail`: `{ id, progress, status, file }`. Twin: `onFileProgress(detail)`.' },
    { name: 'file-status-change', description: 'A file\'s status transitioned. `detail`: `{ id, prevStatus, nextStatus, file }`. Twin: `onFileStatusChange(detail)`.' },
    { name: 'file-update', description: 'A file field other than progress / status changed (preview generated, upload result merged). `detail`: `{ file }`. Twin: `onFileUpdate(detail)`.' },
    { name: 'overlay-enter', description: 'A drag entered the drag overlay (`overlay-target`). `detail`: `{ overlayElement }`. Twin: `onOverlayEnter(detail)`.' },
    { name: 'overlay-leave', description: 'A drag left the drag overlay. `detail`: `{ overlayElement }`. Twin: `onOverlayLeave(detail)`.' },
    { name: 'ready', description: 'Core lifecycle event: fired ONCE, after the first build (the store is live, `el.controller` works). A later rebuild (mode flip) or a DOM move does not fire it again. The host gets the `ready` attribute and `:state(ready)`; `await el.whenReady()` is the promise form. Hold the first build with the `defer` attribute and `release()`. `detail`: `controller` / `element`. Twin: `onReady(detail)`.' },
];

// Track instances for the global API (window.components['web-dropzone']).
const instances = new Set<DropzoneElement>();

export function getAllInstances(): DropzoneElement[] {
    return Array.from(instances);
}

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
    declare onFilesReject: ((detail: FilesRejectEventDetail) => void) | null;
    declare onFileRetry: ((detail: FileRetryEventDetail) => void) | null;
    declare onFileUploadComplete: ((detail: FileUploadCompleteEventDetail) => void) | null;
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
    #customStyleSheet?: HTMLStyleElement;

    /**
     * What the engine reports to — built once, so every engine (each rebuild)
     * shares it: `element` / `controller` for every ctx, and `notify` routing
     * engine happenings to `emit()`.
     */
    readonly #engineHost: DropzoneEngineHost = {
        element: this,
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

        // Shadow DOM + base stylesheet
        this.#shadow = this.attachShadow({ mode: 'open' });
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        this.#shadow.appendChild(styleSheet);

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
    }

    // ── core lifecycle hooks ──────────────────────────────────────────────────

    /** Structural change (or first connect): rebuild the store from scratch. */
    protected override reinit(): void {
        this.#rebuildStore();
    }

    /**
     * In-place change: patch the live store via `updateConfig`. A change to any
     * of the four mode-determining inputs can flip the operating mode, which the
     * store can't apply in place — detect that and do a full rebuild instead
     * (matching the pre-core behaviour, where a mode flip reset the selection).
     */
    protected override update(partial: Record<string, unknown>): void {
        if (
            'mode' in partial ||
            'displayMode' in partial ||
            'selectorAppearance' in partial ||
            'listAppearance' in partial
        ) {
            const next = this.#resolveMode();
            if (this.#dropzone && this.#dropzone.getConfig().mode !== next) {
                this.#rebuildStore();
                return;
            }
        }

        // Custom styles are a shadow-root concern, not a store rebuild.
        if ('getCustomStylesCallback' in partial) this.#injectCustomStyles();

        const storePartial: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(partial)) {
            if (key === 'getCustomStylesCallback') continue; // handled above
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
        } else if ('minFileCount' in partial) {
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
        instances.add(this);
        if (this.#dropzone) this.#dropzone.activate();
        else this.#buildStore();

        initLogger.debug('DropzoneElement connected');
    }

    /**
     * Deactivate: stop the store's document / window listeners and popover
     * positioning. The store, its files and uploads are kept — a DOM move
     * reconnects without a rebuild; `destroy()` tears it down.
     */
    protected override disconnect(): void {
        instances.delete(this);
        this.#dropzone?.deactivate();
        initLogger.debug('DropzoneElement disconnected');
    }

    /**
     * Removed from the page (still detached one frame after `disconnect()` —
     * a DOM move never gets here). Unless `should-keep-alive-when-removed`:
     * cancel every upload by the cancel rule (handlers get their signal and
     * up to `cancel-timeout`; no `beforeFileCancelCallback` — there is no UI
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
        instances.delete(this);
        if (this.#dropzone) this.#teardownStore(this.#dropzone);
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
        this.#injectCustomStyles();

        this.#dropzone = new WebDropzone(this.#container, config, this.#engineHost);
        this.#syncFormValue();

        // The store is live: `el.controller` now reaches it. Satellites that
        // are waiting for a store (connected first, or mounted by the store
        // itself during the build) bind on this internal signal; core's public
        // `ready` fires once, after the first build.
        this.dispatchEvent(new Event(STORE_BUILD_EVENT));

        initLogger.debug('Dropzone initialized', { config });
    }

    /**
     * Resolve the effective `mode` from explicit attribute + implicit detection.
     * Explicit `mode="…"` always wins. Otherwise: presence of any
     * renderer-trigger attribute → 'bulk'; absence → 'headless'. The implicit
     * path never lands on 'structural' — that requires an explicit
     * `mode="structural"`.
     */
    #resolveMode(): DropzoneMode {
        const raw = this.getAttribute('mode');
        if (raw === 'bulk' || raw === 'structural' || raw === 'headless') return raw;
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

        cfg.isDisabled = this.isEffectivelyDisabled;

        const mode = this.#resolveMode();
        cfg.mode = mode;
        cfg.isHeadless = mode === 'headless';

        // Shadow DOM container for popover anchoring + form-element host.
        cfg.container = this.#container;
        cfg.hostElement = this;
        return cfg as DropzoneConfig;
    }

    /**
     * Inject styles from `getCustomStylesCallback(ctx)` into the shadow root. The
     * stylesheet is *prepended* (before the base stylesheet) so `@import` /
     * `@font-face` rules — which must appear at the top of a stylesheet — take
     * effect. Replaces the previous custom-styles element if one was injected.
     */
    #injectCustomStyles(): void {
        if (this.#customStyleSheet) {
            this.#customStyleSheet.remove();
            this.#customStyleSheet = undefined;
        }
        const callback = this.config.getCustomStylesCallback as ((ctx: object) => string | null | undefined) | null | undefined;
        if (typeof callback !== 'function') return;

        const css = callback(this.withContext({}));
        if (!css) return;

        const sheet = document.createElement('style');
        sheet.id = 'dz-custom-styles';
        sheet.textContent = css;
        this.#shadow.insertBefore(sheet, this.#shadow.firstChild);
        this.#customStyleSheet = sheet;
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
                `At least ${min} file${min === 1 ? '' : 's'} required`
            );
        } else {
            internals.setValidity({});
        }
    }

    // ── back-compat property aliases ──────────────────────────────────────────
    // Core installs accessors named after each `configKey` (e.g.
    // `el.isMultipleEnabled`). These hand-written camelCase accessors preserve
    // the historical public property names, operating on the attribute (which
    // core observes) so the value still flows through the reactive pipeline.

    get multiple(): boolean {
        return this.config.isMultipleEnabled as boolean;
    }
    set multiple(value: boolean) {
        if (value) this.setAttribute('multiple', '');
        else this.setAttribute('multiple', 'false');
    }

    get disabled(): boolean {
        return this.config.isDisabled as boolean;
    }
    set disabled(value: boolean) {
        if (value) this.setAttribute('disabled', '');
        else this.removeAttribute('disabled');
    }

    /**
     * Three-state: `undefined` (unset → auto), `true`, or `false`. Auto means
     * thumbnails for `list-appearance="grid"`, icons everywhere else.
     */
    get showThumbnails(): boolean | undefined {
        const value = this.config.isShowThumbnailsEnabled as boolean | null;
        return value == null ? undefined : value;
    }
    set showThumbnails(value: boolean | undefined) {
        if (value === undefined) this.removeAttribute('show-thumbnails');
        else this.setAttribute('show-thumbnails', value ? '' : 'false');
    }

    get filesInside(): boolean {
        return this.config.isFilesInsideEnabled as boolean;
    }
    set filesInside(value: boolean) {
        if (value) this.setAttribute('files-inside', '');
        else this.removeAttribute('files-inside');
    }

    get autoUpload(): boolean {
        return this.config.isAutoUploadEnabled as boolean;
    }
    set autoUpload(value: boolean) {
        if (value) this.setAttribute('auto-upload', '');
        else this.setAttribute('auto-upload', 'false');
    }

    get uploadedDeletable(): boolean {
        return this.config.isUploadedFileDeletable as boolean;
    }
    set uploadedDeletable(value: boolean) {
        if (value) this.setAttribute('uploaded-deletable', '');
        else this.setAttribute('uploaded-deletable', 'false');
    }

    // Typed views of the reflected enum inputs (core installs the accessors;
    // these `declare`s only surface the precise TS types to consumers).
    declare displayMode: DisplayMode;
    declare selectorAppearance: SelectorAppearance | null;
    declare listAppearance: ListAppearance | null;
    declare gridLayout: GridLayout | null;
    declare gridStatus: GridStatus | null;
    declare rollingRotation: RollingRotation;
    declare cardSize: CardSize | null;
    declare valueFormat: ValueFormat;
    declare overlayTarget: HTMLElement | string | null;
    declare labels: Partial<DropzoneLabels> | null;

    // ── public API ────────────────────────────────────────────────────────────

    /** Get all current files. */
    get files(): FileState[] {
        this.flush();
        return this.#dropzone?.getFiles() || [];
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

    /** Get a file by ID. */
    getFile(id: string): FileState | undefined {
        this.flush();
        return this.#dropzone?.getFile(id);
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
     * Cancel every uploading / pending / paused file (`beforeFileCancelCallback`
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

// Auto-register the custom element (browser only)
if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
    if (!customElements.get('web-dropzone')) {
        customElements.define('web-dropzone', DropzoneElement);
    }
}

// NOTE: do NOT statically `import './web-component-picker'` etc. from here.
// Satellite registration order is owned by index.ts, which registers
// satellites BEFORE this module so that the synchronous upgrade of
// `<web-dropzone>` elements (triggered by the define call above) can construct
// satellite instances that already have their `bindToStore` method. The reverse
// race (satellites parsed in HTML upgrade before the store) is handled by
// `whenStoreReady` — satellites tolerate an un-upgraded store and wait for
// `ready`.
