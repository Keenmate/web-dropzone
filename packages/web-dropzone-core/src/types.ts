/**
 * Type definitions for the WebDropzone component
 */

// Placement comes from core's /positioning (which re-exports the pinned
// @floating-ui/dom type) — this package no longer imports @floating-ui/dom
// directly (it never declared it; it was resolving through the renderer's
// hoisted copy).
import type { Placement } from '@keenmate/web-components-core/positioning';
import type { LoadStateCallback, SaveStateCallback } from '@keenmate/web-components-core';
import type {
    ValidateContext,
    BeforeFilesAddContext,
    BeforeFilesRemoveContext,
    BeforeFilesCancelContext,
    FileIconContext,
    FileUploadContext,
    FileItemRenderContext,
    ListWrapperRenderContext,
    PromptRenderContext,
    SummaryRenderContext,
    CustomStylesContext
} from './interaction';
import type { StatusSurfaceCallback } from './store-api';
import type { DropzoneLabels } from './labels';

/**
 * Display mode — single-axis legacy shorthand for the orthogonal
 * `selectorAppearance` × `listAppearance` × `cardSize` axes. Each value
 * expands to a preset combination; explicit orthogonal attributes override
 * what the shorthand sets.
 *
 * - 'list'     → selectorAppearance=card, listAppearance=list,     cardSize=compact
 * - 'detailed' → selectorAppearance=card, listAppearance=detailed, cardSize=compact
 * - 'grid'     → selectorAppearance=card, listAppearance=grid,     cardSize=compact
 * - 'compact'  → selectorAppearance=card, listAppearance=popover,  cardSize=compact
 */
export type DisplayMode = 'list' | 'detailed' | 'grid' | 'compact';

/**
 * Render mode (`render-mode` attribute, `renderMode` key) — the top-level
 * switch that decides who renders the file list and how customization is
 * applied. Hard switch: setting `renderMode`
 * authoritatively gates which other config keys apply. See
 * ARCHITECTURE.md and the "three modes" project memory.
 *
 * - 'bulk'       — framework owns everything. Render callbacks
 *                  (`renderFileItemCallback`, `renderPromptCallback`,
 *                  `renderSummaryCallback`, `renderRolling*Callback`) are
 *                  IGNORED even if set. Consumers style via CSS variables.
 * - 'structural' — framework decides when/what to render; consumer
 *                  provides the HTML structure via render callbacks.
 * - 'headless'   — framework renders nothing; emits events + exposes
 *                  state. Consumer brings their own DOM (typically via
 *                  satellites or a reactive framework).
 *
 * When the attribute is absent, the mode is inferred:
 *   - any of `display-mode` / `selector-appearance` / `list-appearance`
 *     present → 'bulk'
 *   - none present → 'headless' (the satellite-store back-compat shortcut)
 *
 * The inferred mode never resolves to 'structural' — opting in to
 * callbacks always requires explicit `render-mode="structural"`.
 */
export type DropzoneRenderMode = 'bulk' | 'structural' | 'headless';

/**
 * Selector appearance — what the user clicks/drops onto.
 * - 'card'    — bordered drop-zone card with icon, prompt, browse button (default)
 * - 'button'  — single accent-styled "Select files" button (no drag-drop)
 * - 'minimal' — compact icon-only button with optional file-count badge
 * - 'native'  — mimics the browser's native <input type="file">: a button
 *               followed by a plain text label ("No file chosen" / filename /
 *               "N files chosen"). Drag-drop still works.
 */
export type SelectorAppearance = 'card' | 'button' | 'minimal' | 'native';

/**
 * List appearance — how picked files are presented.
 * - 'list'     — simple vertical rows (default)
 * - 'detailed' — vertical rows with icon, name, size, type
 * - 'grid'     — image preview thumbnails in a CSS grid
 * - 'badges'   — inline composite badge pills (matches web-multiselect's badge surface)
 * - 'rolling'  — single-row "front file" view + queue button that opens the popover.
 *                The front file rolls out as it finishes and the next one rolls in.
 *                Designed for tight surfaces where the user wants a glance at what's
 *                currently in flight, with a click-through to the full queue.
 * - 'popover'  — list hidden in a popover anchored to the selector / summary
 * - 'none'     — list not rendered at all (caller handles via the .files getter)
 */
export type ListAppearance = 'list' | 'detailed' | 'grid' | 'badges' | 'rolling' | 'popover' | 'none';

/**
 * Top-level surfaces the convenience `<web-dropzone>` form renders — a
 * Plyr-style composition list. When `config.controls` is set it acts as an
 * allowlist: only the named surfaces render; anything omitted is hidden. When
 * unset (the default) every applicable surface renders as before.
 * - 'picker'           — the file selector (card / button / minimal / native)
 * - 'list'             — the inline file list (per `listAppearance`)
 * - 'overall-progress' — the aggregate progress strip below the list
 */
export type DropzoneControl = 'picker' | 'list' | 'overall-progress';

/**
 * Per-row parts a file item can render — the item-level counterpart to
 * {@link DropzoneControl}. When `config.itemControls` is set it acts as an
 * allowlist filtered against whatever the current `listAppearance` actually
 * supports (e.g. grid has no `size`/`type`; badges have no `progress`) — parts
 * the appearance doesn't have are simply ignored. Unset → every part renders.
 * - 'icon'     — leading file-type icon or image thumbnail
 * - 'name'     — file name
 * - 'size'     — human-readable file size (detailed)
 * - 'type'     — MIME type (detailed)
 * - 'progress' — per-row progress bar + percent
 * - 'status'   — status icon (pending / uploading / complete / error)
 * - 'action'   — pause / resume / retry button
 * - 'cancel'   — cancel (⊘) button (uploading / queued / paused files)
 * - 'remove'   — remove (×) button
 */
export type FileItemPart =
    | 'icon'
    | 'name'
    | 'size'
    | 'type'
    | 'progress'
    | 'status'
    | 'action'
    | 'cancel'
    | 'remove';

/**
 * Rotation style for `listAppearance='rolling'`. Controls how the front
 * file transitions when a new one takes the slot.
 * - 'horizontal' — old slides out left, new slides in from right (conveyor)
 * - 'vertical'   — old slides out top, new slides in from bottom (stack)
 * - 'slide-in'   — old is removed instantly, new slides in from right
 *                  (no overlap; cheapest / default)
 */
export type RollingRotation = 'horizontal' | 'vertical' | 'slide-in';

/**
 * Card density (only meaningful when selectorAppearance='card').
 * - 'minimal' — single thin horizontal row
 * - 'compact' — moderate padding, default
 * - 'big'     — full vertical stack with large icon, padding, and hints
 */
export type CardSize = 'minimal' | 'compact' | 'big';

/**
 * Tile layout for `listAppearance='grid'`.
 * - 'uniform' — equal-size tiles on a responsive column grid (default). Each
 *   thumbnail fills its cell per `--dz-preview-item-object-fit` (crop or fit).
 * - 'natural' — a justified photo gallery: rows share one height
 *   (`--dz-preview-row-height`) and every tile keeps its image's own aspect
 *   ratio (mixed portrait/landscape, no crop, ragged right edge).
 */
export type GridLayout = 'uniform' | 'natural';

/**
 * How a finished (complete / error) file is flagged on a grid tile.
 * - 'badge'   — small status glyph in the top-left corner (default).
 * - 'overlay' — a light veil over the whole tile with a big centred glyph
 *   (green check / red error), like a photo-upload confirmation.
 */
export type GridStatus = 'badge' | 'overlay';

/**
 * File upload status.
 * - `pending`   — accepted but no upload attempt yet
 * - `uploading` — `uploadFileCallback` is currently running
 * - `complete`  — handler resolved successfully
 * - `error`     — handler rejected (after exhausting retries)
 * - `paused`    — handler aborted, will resume on `resumeFile` / `resumeAll`
 * - `cancelling` — `cancelFile` aborted the handler and waits (up to
 *   `cancelTimeout`) for it to settle
 * - `cancelled` — cancel finished; will not auto-resume (manual retry needed)
 */
export type FileStatus = 'pending' | 'uploading' | 'complete' | 'error' | 'paused' | 'cancelling' | 'cancelled';

/**
 * What a cancel whose handler did not settle within `cancelTimeout` does:
 * `error` — the file goes to `error` (reason `cancel-timeout`, retryable);
 * `remove` — the file is removed from the list.
 */
export type CancelTimeoutBehavior = 'error' | 'remove';

/**
 * How a cancel finished (`file-cancel` → `detail.result`):
 * `cancelled` — the handler settled in time (or nothing was running);
 * `timeout-error` / `timeout-remove` — it didn't, and `cancelTimeoutBehavior`
 * applied.
 */
export type FileCancelResult = 'cancelled' | 'timeout-error' | 'timeout-remove';

/**
 * Contract between the handler and the component about what
 * `ctx.setProgress(p)` means, and what the component does with it when the
 * upload attempt rejects. The handler always drives the bar — the mode
 * controls whether the bar can go BACKWARDS on failure.
 *
 * - `optimistic` (default) — the handler is free to call
 *   `ctx.setProgress(p)` BEFORE the bytes are confirmed (e.g. as soon as
 *   they're flushed to the socket, or per simulated tick). If the
 *   attempt ultimately rejects, the bar snaps back to the value it had
 *   at the start of the attempt — those unconfirmed bytes never landed
 *   on the server, and the next attempt resumes from the confirmed
 *   offset. Best for most HTTP uploads where progress comes from
 *   `XMLHttpRequest.upload.progress` and "sent" doesn't yet mean
 *   "acknowledged".
 *
 * - `pessimistic` — the handler must only call `ctx.setProgress(p)` AFTER a
 *   chunk has been confirmed by the server (or for whole-file uploads,
 *   it just doesn't tick during the attempt and the bar jumps from the
 *   baseline to 100% on resolve). The component won't snap back on
 *   failure — the bar moves forward only, or stops. Best when the
 *   handler can distinguish sent vs. acknowledged, so apparent
 *   progress is always real.
 */
export type ProgressMode = 'optimistic' | 'pessimistic';

/**
 * Options accepted by `WebDropzone.addFiles(files, opts)`. Pickers use this
 * to stamp Mode B routing info onto each new FileState — the same handler /
 * metadata then survive through pause / resume / retry. Omitting opts (or
 * passing `{}`) is Mode A: files inherit the store's `uploadFileCallback`.
 */
export interface AddFilesOptions {
    /** Per-file upload handler override. Stamped onto every accepted file
     *  in this batch as `FileState.uploadFileCallback`. */
    uploadFileCallback?: FileUploadHandler;
    /** Per-file metadata stamped onto every accepted file in this batch
     *  as `FileState.uploadMetadata`. */
    uploadMetadata?: Record<string, unknown>;
}

/**
 * Aggregate view returned by `getOverallProgress()`. Byte-weighted overall
 * percent + per-status counts + a single roll-up status for surface color.
 * Computed once per call; cheap (O(N)) and shared across the popover footer,
 * the indicator chip, and any `<web-dropzone-progress>` satellite.
 */
export interface OverallProgress {
    uploadedBytes: number;
    totalBytes: number;
    completedCount: number;
    failedCount: number;
    uploadingCount: number;
    pausedCount: number;
    /** Files queued for upload (status `pending`). */
    pendingCount: number;
    /** Files whose cancel is waiting for the handler to settle. */
    cancellingCount: number;
    /** 0–100, byte-weighted across the queue. */
    percent: number;
    /** True when any non-complete activity exists (uploading / paused / queued). */
    hasActivity: boolean;
    aggregateStatus: 'uploading' | 'paused' | 'error' | 'complete';
}

/**
 * Per-file upload handler (`uploadFileCallback`). Called once per attempt by
 * the worker pool with one {@link FileUploadContext}: `file`, `signal`,
 * `setProgress(percent)`, resume state (`startBytes`, `startPercent`,
 * `metadata`, `setMetadata`) and `uploadMetadata`, plus `controller` /
 * `element`. Resolve on success (optionally with a {@link FileUploadResult}),
 * reject on failure; abort when `signal` fires (pause / cancel / remove).
 */
export type FileUploadHandler = (ctx: FileUploadContext) => Promise<void | FileUploadResult>;

/**
 * Retry policy applied when `uploadFileCallback` rejects. Each retry waits
 * `delayMs * (backoff ** attempt)` before the next attempt — defaults give an
 * exponential 1s / 2s / 4s ramp.
 */
export interface RetryPolicy {
    /** Total attempts including the first try (default: 1 — no retries). */
    attempts?: number;
    /** Base delay in ms (default: 1000). */
    delayMs?: number;
    /** Exponential backoff multiplier (default: 2). */
    backoff?: number;
}

/**
 * Value format for form serialization
 */
export type ValueFormat = 'json' | 'csv' | 'array';

/**
 * State of a file in the dropzone
 */
export interface FileState {
    /** Unique identifier for this file */
    id: string;
    /** The native File object */
    file: File;
    /** File name */
    name: string;
    /** File size in bytes */
    size: number;
    /** MIME type */
    type: string;
    /** Current status */
    status: FileStatus;
    /** Upload progress (0-100) */
    progress: number;
    /** Error message if status is 'error' */
    error?: string;
    /** Data URL for image preview (generated on demand) */
    previewUrl?: string;
    /**
     * Server-provided URL for the uploaded file (download link). Populated
     * from `FileUploadResult.downloadUrl` when the handler returns one.
     */
    downloadUrl?: string;
    /**
     * Arbitrary server-side payload merged from `FileUploadResult.metadata`
     * on successful upload. Survives in the item for the entire lifetime of
     * the selection so apps can fire a DELETE against the server using e.g.
     * `metadata.serverGuid` when the user removes a completed file from the
     * list. Mirrors svelte-fluentui's `InputFileItem.metadata`.
     */
    metadata?: Record<string, unknown>;
    /**
     * Per-file upload handler override (Mode B — see ARCHITECTURE.md).
     * Stamped at add-time by the contributing picker so a shared store can
     * route different files to different endpoints. The upload loop calls
     * `file.uploadFileCallback ?? store.config.uploadFileCallback`, so Mode A
     * (single shared handler) is unchanged when this is undefined.
     */
    uploadFileCallback?: FileUploadHandler;
    /**
     * Per-file metadata stamped at add-time (Mode B). Distinct from
     * `metadata`, which the upload handler populates after upload — this
     * field carries inputs handed to the handler (e.g. bucket name,
     * tenant id) and is exposed to the handler as `ctx.uploadMetadata`.
     */
    uploadMetadata?: Record<string, unknown>;
}

/**
 * Restricted partial that the upload handler can return on success. The
 * component merges this into the FileState atomically with the
 * `status: 'complete'` flip. Restricted on purpose — handlers can populate
 * server-side identifiers (`metadata`), download links, alternate
 * thumbnails, or a final filename, but cannot overwrite internal lifecycle
 * fields like `id`, `status`, `progress`, `file`, or `error`.
 */
export interface FileUploadResult {
    metadata?: Record<string, unknown>;
    downloadUrl?: string;
    previewUrl?: string;
    name?: string;
}

/**
 * Validation result for a file
 */
export interface ValidationResult {
    /** Whether the file passed validation */
    valid: boolean;
    /** Error message if validation failed */
    error?: string;
    /** Error code for programmatic handling */
    code?: 'size' | 'type' | 'count' | 'duplicate' | 'custom' | 'rejected';
}

/**
 * Dedupe policy for files added across multiple selections / drops.
 * - 'name'      — reject if filename matches an existing file (default)
 * - 'name-size' — reject if filename AND size both match (safer when two
 *                 distinct files share a name)
 * - 'none'      — never dedupe (native <input type="file"> behavior)
 */
export type DedupeMode = 'name' | 'name-size' | 'none';

/**
 * Rejected file with validation error
 */
export interface RejectedFile {
    /** The rejected file */
    file: File;
    /** Validation result with error details */
    validation: ValidationResult;
}

/**
 * Configuration options for the WebDropzone component
 */
/**
 * Persisted UI state — everything the user can change via direct
 * interaction that should survive a page reload. Currently only popover
 * dimensions; extensible so new toggles can join without breaking the
 * storage shape (loaders should treat unknown keys as default).
 */
export interface DropzoneState {
    /** Width in CSS pixels set by the user's last popover resize. */
    popoverWidth?: number;
    /** Height in CSS pixels set by the user's last popover resize. */
    popoverHeight?: number;
}

export interface DropzoneConfig {
    // ========================================================================
    // CORE OPTIONS
    // ========================================================================

    /** Allow multiple file selection (HTML attr: `multiple`, default: true) */
    isMultiple?: boolean;
    /** Accepted file types (MIME types or extensions, e.g., 'image/*,.pdf') */
    accept?: string;
    /** Maximum size per file in bytes. 0 = no cap. */
    maxFileSize?: number;
    /** Minimum size per file in bytes. 0 = no cap. Useful for rejecting empty
     *  uploads / corrupt zero-byte files. */
    minFileSize?: number;
    /** Aggregate size cap across the entire selection in bytes. The running
     *  total is recomputed on each add, so removing files frees room. 0 = no
     *  cap. Mirrors svelte-fluentui's `InputFile.totalMaxSize`. */
    maxTotalSize?: number;
    /** Maximum number of files (when isMultiple is true). 0 = no cap.
     *  When an incoming batch would exceed this, the first N files that still
     *  fit are accepted and the rest are rejected with `code: 'count'`. */
    maxFileCount?: number;
    /** Minimum number of files required for the surrounding form to be valid.
     *  Does NOT reject files on add — instead, when `files.length < N`, the
     *  custom element calls `ElementInternals.setValidity({ valueMissing })`
     *  so the form's native submit refuses until the user meets the floor.
     *  Mirrors svelte-fluentui's `InputFile.minFiles`. 0 = no minimum. */
    minFileCount?: number;
    /**
     * Visible-row cap. When set and the selection has more files than this,
     * the list renders only the first `maxVisibleFileCount` items with a
     * "Show N more" toggle at the end. Default 7. Set to 0 to disable the
     * cap and render every file. Mirrors svelte-fluentui's
     * `InputFile.maxVisible`.
     */
    maxVisibleFileCount?: number;
    /**
     * Dedupe policy when adding files to an existing selection.
     * Default: `'name'` — repeated drops / "Add more" picks of the same
     * filename are rejected (with `code: 'duplicate'`). Set to `'none'` to
     * match the native `<input type="file">` behavior of always appending.
     */
    dedupeMode?: DedupeMode;
    /** Whether the dropzone is disabled (HTML attr: `disabled`) */
    isDisabled?: boolean;
    /**
     * Read-only (HTML attr: `readonly`): the selection can't be changed by the
     * user — no add (click / drop / overlay / Add more), no row Remove, no
     * Clear all — but it stays visible, focusable and is still submitted with
     * the form. Uploads keep running (pause / resume / retry / cancel stay).
     * The programmatic API is unaffected.
     */
    isReadonly?: boolean;
    /**
     * Render mode — bulk / structural / headless. Hard switch: gates
     * which other config keys apply. See `DropzoneRenderMode` for semantics.
     * Defaults to 'bulk' when any renderer-trigger attribute is set,
     * 'headless' otherwise. The implicit default never resolves to
     * 'structural' — that requires an explicit `render-mode="structural"`.
     */
    renderMode?: DropzoneRenderMode;
    /**
     * Derived from `renderMode === 'headless'`. Kept as a separate flag because
     * lots of internal code paths short-circuit on it; treat it as
     * read-after-resolve, not as a knob you set directly. Set `renderMode`
     * instead.
     */
    isHeadless?: boolean;
    /**
     * Per-file throttle window for `updateFileProgress` (milliseconds).
     * Coalesces the `file-progress` event, the `file-row-update` event,
     * and the in-place row patching so a 20-file upload tick at 50ms
     * intervals isn't doing 400 DOM patches/sec.
     *
     * Default 0 (no throttle). Leading edge fires immediately; subsequent
     * progress within the window is held until the trailing edge. The
     * final value (100% / status flip to 'complete') is guaranteed to
     * arrive — held values aren't dropped.
     *
     * Recommended values: 80–200 ms for tables / framework-bound
     * renderers; leave at 0 for the default UI (its in-place patcher is
     * already cheap).
     */
    progressThrottle?: number;

    // ========================================================================
    // DISPLAY OPTIONS
    // ========================================================================

    /**
     * Single-axis shorthand. Expands to a preset combination of the orthogonal
     * `selectorAppearance` / `listAppearance` / `cardSize` axes. Explicit
     * orthogonal attributes always win over the shorthand.
     */
    displayMode?: DisplayMode;
    /** Selector appearance — card (drop zone) | button | minimal (icon) */
    selectorAppearance?: SelectorAppearance;
    /** List appearance — list | detailed | grid | badges | popover | none */
    listAppearance?: ListAppearance;
    /**
     * Tile layout for `listAppearance='grid'` (HTML attr: `grid-layout`).
     * `uniform` (default) = equal-size responsive tiles; `natural` = a
     * justified gallery of equal-height rows that keep each image's aspect
     * ratio. See {@link GridLayout}.
     */
    gridLayout?: GridLayout;
    /**
     * How finished files are flagged on a grid tile (HTML attr: `grid-status`).
     * `badge` (default) = small corner glyph; `overlay` = full-tile veil with a
     * big centred check/error glyph. See {@link GridStatus}.
     */
    gridStatus?: GridStatus;
    /**
     * Plyr-style allowlist of top-level surfaces to render (HTML attr:
     * `controls`, comma-separated). See {@link DropzoneControl}. Unset → every
     * applicable surface renders (default). Visibility-only: omitting a token
     * hides that surface; it does not reorder the layout.
     */
    controls?: DropzoneControl[];
    /**
     * Plyr-style allowlist of per-row parts to render (HTML attr:
     * `item-controls`, comma-separated). See {@link FileItemPart}. Unset →
     * every part the current `listAppearance` supports renders (default).
     * Tokens the appearance doesn't support are ignored.
     */
    itemControls?: FileItemPart[];
    /**
     * Rotation style for `listAppearance='rolling'` (HTML attr: `rolling-rotation`).
     * Default: `'slide-in'`.
     */
    rollingRotation?: RollingRotation;
    /** Card density when selectorAppearance='card' — minimal | compact | big */
    cardSize?: CardSize;
    /**
     * Show image thumbnails in the file-list placeholder slot.
     * - `undefined` (default) → "auto": on for `listAppearance='grid'`, off elsewhere
     * - `true`  → always render `<img>` for images, fall back to icon for non-images
     * - `false` → always render the file-type icon, never a thumbnail
     *
     * To hide the placeholder slot entirely (no icon AND no thumbnail), set the
     * relevant CSS variable to 0 — e.g. `web-dropzone { --dz-badge-icon-size: 0; }`.
     */
    isThumbnailsShown?: boolean;
    /** Show files inside the dropzone area instead of a separate list below (HTML attr: `files-inside`) */
    isFilesInside?: boolean;
    /** Icon or emoji for the dropzone prompt */
    icon?: string;
    /**
     * UI strings (`labels` input) — a partial {@link DropzoneLabels} object
     * merged per key over the built-in English defaults; `{name}` /
     * `{count}` / `{status}` placeholders. Prompt, hint, drag-active,
     * select-files, no-file-chosen, overlay text, status names, row and
     * bulk-action buttons. Resolved through `resolveLabel`.
     */
    labels?: Partial<DropzoneLabels> | null;

    // ========================================================================
    // COMPACT MODE OPTIONS
    // ========================================================================

    /** Popover placement relative to summary */
    popoverPlacement?: Placement;

    // ========================================================================
    // DRAG OVERLAY OPTIONS
    // ========================================================================

    /** Element or element ID that triggers a drag overlay (ultra-compact form integration) */
    overlayTarget?: HTMLElement | string | null;
    /** Icon for the drag overlay */
    overlayIcon?: string;
    /**
     * Arm the drop target while files are dragged anywhere over the page
     * (`highlight-on-page-drag`): the host gets `armed` + `:state(armed)` and
     * the card takes `--dz-dropzone-bg-armed`. A bound picker satellite
     * inherits it unless it sets its own attribute. Default `false`.
     */
    shouldHighlightOnPageDrag?: boolean;

    // ========================================================================
    // FORM INTEGRATION
    // ========================================================================

    /** HTML form field name for hidden inputs */
    name?: string;
    /** Format for value serialization */
    valueFormat?: ValueFormat;

    // ========================================================================
    // CALLBACKS
    // ========================================================================

    /** Sync technical-validation gate — `validateCallback({ file,
     *  existingFiles })` returns a ValidationResult to accept or reject a
     *  file before it enters the queue. Runs after the built-in size / type
     *  checks. Pure: must return immediately. For user-facing async
     *  confirmation see `beforeFilesAddCallback`. */
    validateCallback?: ((ctx: ValidateContext) => ValidationResult) | null;

    /**
     * Icon overrides layered on top of the built-in category icons, keyed by
     * file EXTENSION (`psd`, `.fig` — leading dot optional, case-insensitive)
     * OR by category name (`image`, `archive`, `default`, …). Extension keys
     * win over category keys, which win over the built-in Lucide icon. Values
     * are raw HTML strings (SVG / `<img>` / emoji).
     *
     * ⚠️ Raw HTML — inserted via `innerHTML`, NOT sanitized. Only pass markup
     * you control; never untrusted / user-supplied strings. See the HTML
     * Injection (XSS) notice in the README.
     */
    fileIcons?: Record<string, string> | null;

    /**
     * Full-control icon resolver — `getFileIconCallback({ file })`,
     * consulted BEFORE `fileIcons` and the built-in categories. Return an
     * HTML string to use it, or `null` / `undefined` to fall through to
     * `fileIcons` → category → default. Runs per rendered row (sync).
     *
     * ⚠️ Raw HTML — same caveat as `fileIcons`: NOT sanitized.
     */
    getFileIconCallback?: ((ctx: FileIconContext) => string | null | undefined) | null;

    /** Gate fired once per add batch AFTER all sync validation passes —
     *  `beforeFilesAddCallback({ files, existingFiles })`; may be async.
     *  Return `false` to cancel — the files are then reported via
     *  `file-reject` with `code: 'rejected'`; return a `File[]` to add
     *  those instead (they are validated again; the hook is not re-run);
     *  return nothing to continue. While a promise is pending the files do
     *  NOT appear in the dropzone (no `file-add`, not in `files`); the
     *  consumer shows any confirmation UI. A throw cancels. */
    beforeFilesAddCallback?:
        ((ctx: BeforeFilesAddContext) => false | File[] | void | Promise<false | File[] | void>) | null;

    /** Gate fired before a user-initiated removal —
     *  `beforeFilesRemoveCallback({ files, allFiles })`; may be async.
     *  `files` is the batch about to leave (row ✕ → `[file]`; Clear all →
     *  every file). Return `false` to cancel (no state change, no events);
     *  anything else proceeds. Programmatic `removeFile(id)` / `clear()`
     *  skip this gate unless called with `{ confirm: true }`. A throw cancels. */
    beforeFilesRemoveCallback?:
        ((ctx: BeforeFilesRemoveContext) => false | void | Promise<false | void>) | null;
    /** Gate fired before a cancel — `beforeFilesCancelCallback({ files,
     *  allFiles })`; may be async. `cancelFile(id)` / the row Cancel button
     *  pass `[file]`; `cancelAll()` / "Cancel all" ask ONCE with every file.
     *  Return `false` to veto (uploads keep running). A throw vetoes.
     *  Internal cancels (removing a running file, element removal) skip it. */
    beforeFilesCancelCallback?:
        ((ctx: BeforeFilesCancelContext) => false | void | Promise<false | void>) | null;
    /**
     * Per-file upload handler. When set, the component takes ownership of the
     * upload lifecycle: a worker pool runs queued files at the configured
     * `concurrency`, awaits each handler, drives `file.status` from the Promise
     * outcome, and exposes Pause / Resume / Cancel via the public API.
     *
     * When unset, the component stays in the "app drives uploads" mode —
     * files are merely added and emit `file-add`; the app is expected to
     * call `updateFileProgress` / `setFileStatus` manually.
     */
    uploadFileCallback?: FileUploadHandler | null;
    /**
     * Max number of concurrent uploads when the component drives the queue.
     * Default 1 — uploads run sequentially. Has no effect when
     * `uploadFileCallback` is unset.
     */
    concurrency?: number;
    /**
     * When `true` (default), accepted files are immediately queued for upload
     * via the worker pool. When `false`, files stay in `pending` until the app
     * calls `uploadAll()` — useful for "stage everything, submit on form
     * submit" patterns. Only relevant when `uploadFileCallback` is set.
     */
    shouldAutoUpload?: boolean;
    /**
     * Controls whether the progress bar reflects the handler's optimistic
     * `ctx.setProgress` ticks (bytes sent) or only confirmed server-acknowledged
     * progress. See {@link ProgressMode}. Defaults to `'optimistic'`.
     */
    progressMode?: ProgressMode;
    /**
     * Retry policy applied when `uploadFileCallback` rejects. Defaults to a
     * single attempt (no retries). See {@link RetryPolicy}.
     */
    retryPolicy?: RetryPolicy;
    /**
     * How long (ms) `cancelFile` waits for an aborted upload handler to
     * settle before giving up. The file shows `cancelling` meanwhile; its
     * concurrency slot frees when the handler settles or the timeout fires,
     * and anything the handler reports after the timeout is ignored.
     * Default 2000.
     */
    cancelTimeout?: number;
    /** What a cancel that timed out does — see {@link CancelTimeoutBehavior}. Default `'error'`. */
    cancelTimeoutBehavior?: CancelTimeoutBehavior;
    /** HTML for the row Cancel (⊘) button glyph. Unset → the built-in icon.
     *  ⚠️ Raw HTML — NOT sanitized. */
    cancelIcon?: string;
    /** HTML for the row Remove (✕) button glyph. Unset → the built-in
     *  (CSS-masked `--dz-icon-remove`) glyph. ⚠️ Raw HTML — NOT sanitized. */
    removeIcon?: string;
    /**
     * Whether the user can remove files that have already finished uploading
     * (`status === 'complete'`). When `false`, the remove button is hidden
     * on completed rows but its layout space is reserved — so adjacent
     * elements don't shift as files transition. Default `true`.
     *
     * Calling `removeFile(id)` programmatically still works regardless of
     * this flag — it only affects the rendered button visibility.
     */
    isUploadedFileRemovalAllowed?: boolean;
    /**
     * Re-order the rendered file list so completed (`status === 'complete'`)
     * files slide to the bottom and unresolved files (pending / uploading /
     * paused / error / cancelled) stay at the top. The underlying
     * `this.files` array order is NOT mutated — the visual reordering is
     * pure CSS (`order: 1` on completed rows) for the inline list
     * appearances and a stable sort in the render path for the popover
     * table. So `file-add` / `file-remove` event order and form
     * submission order remain deterministic. Default `false`.
     *
     * Useful when uploads finish out of order and the user needs to see
     * what still needs attention (errors at the top, not buried beneath
     * a long tail of green checkmarks).
     */
    shouldSinkCompleted?: boolean;
    /**
     * Delay in milliseconds between a file transitioning to `complete`
     * and its row sliding to the completed bucket (when reorder is on).
     * The row stays in place showing 100% / the success state for this
     * long before moving — gives the user a beat to register WHICH file
     * just finished, so subsequent files sliding up into the vacated
     * slot aren't mistaken for the original one regressing.
     *
     * Per-file timer: each completing file counts down independently;
     * the timer is cancelled if the file un-completes (e.g. retry) or
     * is removed before it fires. Default: 1500ms when reorder is on,
     * effectively 0 when it's off (the attribute has no effect).
     */
    sinkCompletedDelay?: number;

    // ========================================================================
    // CUSTOM RENDERING
    // ========================================================================

    // ========================================================================
    // PERSISTENCE — user-driven UI state survives page reloads
    // ========================================================================

    /**
     * Opaque identifier used to scope persisted UI state (HTML attr:
     * `storage-key`; core SPEC §12.17). When set, user actions like resizing
     * the popover are saved — to `localStorage['km-state:web-dropzone:<key>']`
     * by default, or via {@link saveStateCallback} — and restored on next
     * mount. Two dropzones on the same page need distinct keys; unset / the
     * empty string disables persistence entirely.
     */
    storageKey?: string | null;
    /**
     * Custom persistence sink — `saveStateCallback({ key, state })`. Called
     * whenever a piece of state changes (currently: popover dimensions after
     * the user finishes a resize) with the WHOLE {@link DropzoneState}. May be
     * async; a failure is logged and the component keeps working from memory.
     * Set both callbacks; either one alone switches localStorage off.
     */
    saveStateCallback?: SaveStateCallback<DropzoneState> | null;
    /**
     * Custom persistence source — `loadStateCallback({ key })`. Called when
     * the popover first opens, to restore the user's last-known dimensions.
     * Return `null` / `undefined` when no state exists for the key. May be
     * async. Set both callbacks; either one alone switches localStorage off.
     */
    loadStateCallback?: LoadStateCallback<DropzoneState> | null;

    /**
     * Custom renderer for a single file row —
     * `renderFileItemCallback({ file, fileIndex, displayMode, isInPopover })`.
     *
     * Return type drives the framework's update strategy:
     *  - **string** — framework swaps `outerHTML` on every state change.
     *    Simple, but listeners attached via `innerHTML += "<button …>"`
     *    style are lost on every tick.
     *  - **HTMLElement** — framework preserves the element across state
     *    changes and instead dispatches `file-row-update` events on it
     *    (detail: `{ file }` + `controller` / `element`; bubbles, not
     *    composed — listen on the row). Listeners attached during the
     *    initial render survive; the consumer mutates the existing DOM
     *    inside the event handler.
     *
     * Only honored when `renderMode === 'structural'`. See `DropzoneRenderMode`.
     */
    renderFileItemCallback?: ((ctx: FileItemRenderContext) => string | HTMLElement) | null;
    /**
     * Custom renderer for the list wrapper —
     * `renderListWrapperCallback({ rowsHtml, files })`. Returns the wrapper
     * HTML/element that will contain the rows. Useful for table-style layouts:
     *
     *   renderListWrapperCallback = ({ rowsHtml }) => `
     *       <table>
     *         <thead><tr><th>Name</th><th>Size</th></tr></thead>
     *         <tbody>${rowsHtml}</tbody>
     *       </table>`;
     *
     * Only honored when `renderMode === 'structural'`. Note: combining this
     * with an HTMLElement-returning `renderFileItemCallback` falls back
     * to the string path — element identity is not preserved when the
     * wrapper callback is set.
     */
    renderListWrapperCallback?: ((ctx: ListWrapperRenderContext) => string | HTMLElement) | null;
    /** Custom renderer for the drop-area prompt — `renderPromptCallback(ctx)` (context only). */
    renderPromptCallback?: ((ctx: PromptRenderContext) => string | HTMLElement) | null;
    /** Custom renderer for the compact summary — `renderSummaryCallback({ files })`. */
    renderSummaryCallback?: ((ctx: SummaryRenderContext) => string | HTMLElement) | null;
    /**
     * Custom rendering for the rolling list appearance (structural mode).
     * Three callbacks share the `StatusSurfaceCallback` contract of the
     * `<web-dropzone-indicator>`'s `render{Body,FileInfo,Progress}Callback`
     * — one `StatusSurfaceArgs` ctx (+ `controller` / `element`).
     * Each part is replaceable piecemeal; `null` returns yield to the
     * library's polished default. `false` from body hides the rolling
     * block (useful while idle). Memoization rules: string equality
     * skips DOM writes, element identity preserves WAAPI animations.
     */
    renderRollingBodyCallback?: StatusSurfaceCallback | null;
    /** File-info slot inside the rolling current row — name, icon, status. */
    renderRollingFileInfoCallback?: StatusSurfaceCallback | null;
    /** Progress slot inside the rolling current row — bar + percent. */
    renderRollingProgressCallback?: StatusSurfaceCallback | null;
    /** `getCustomStylesCallback(ctx)` — return CSS injected into the shadow root (prepended). */
    getCustomStylesCallback?: ((ctx: CustomStylesContext) => string | null | undefined) | null;

    // ========================================================================
    // OTHER OPTIONS
    // ========================================================================

    /** Container element for popover (for Shadow DOM support) */
    container?: HTMLElement | null;
    /** Host element for appending hidden inputs (for form integration with shadow DOM) */
    hostElement?: HTMLElement;
}

/**
 * File type categories for icon mapping
 */
export type FileTypeCategory =
    | 'image'
    | 'video'
    | 'audio'
    | 'pdf'
    | 'doc'
    | 'spreadsheet'
    | 'archive'
    | 'code'
    | 'text'
    | 'default';

// FILE_TYPE_ICONS moved to `icons.ts` (the Lucide icon home) — re-exported from
// the core barrel so `import { FILE_TYPE_ICONS } from '@keenmate/web-dropzone-core'`
// still resolves. Kept out of this types module to avoid a types → icons cycle.

/**
 * The two consumer icon-override hooks, as a standalone slice so `getFileIcon`
 * can take them without depending on the whole `DropzoneConfig`. A full
 * `DropzoneConfig` is structurally assignable to this, so renderers can just
 * pass `this.config`. See `DropzoneConfig.fileIcons` / `.getFileIconCallback` for
 * the resolution order and the raw-HTML (XSS) caveat.
 */
export interface FileIconOverrides {
    fileIcons?: Record<string, string> | null;
    getFileIconCallback?: ((ctx: FileIconContext) => string | null | undefined) | null;
}
