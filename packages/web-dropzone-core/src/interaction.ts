/**
 * The interaction model (web-components-core SPEC §12.5): the public
 * controller facade, every callback `ctx`, and every event detail.
 *
 * - Every callback takes ONE `ctx`; every ctx and every event detail carries
 *   `controller` (the {@link DropzoneController} — `el.controller`) and
 *   `element` (the `<web-dropzone>` host), both non-enumerable, so
 *   destructuring works while `JSON.stringify` / logs see only the data.
 * - Events are kebab-case, present tense, bubble, and are NOT composed. On
 *   `<web-dropzone>` each one also has a camelCase `on*` twin property that
 *   receives the same detail object (`el.onFileAdd = ({ file }) => …`).
 *
 * A standalone {@link DropzoneEngine} (no `<web-dropzone>` host) carries its
 * own controller and its render container as `element`, and dispatches the
 * same events (non-composed) on that container.
 */

import type { ComponentContext } from '@keenmate/web-components-core';
import type { DropzoneController } from './controller';
import type { FileState, RejectedFile, DisplayMode, DropzoneState, FileCancelResult } from './types';

export type { DropzoneController } from './controller';

/** The component context every dropzone ctx / event detail carries. */
export type DropzoneContext = ComponentContext<DropzoneController, HTMLElement>;

// ============================================================================
// CALLBACK CONTEXTS
// ============================================================================

/** `validateCallback(ctx)` — per-file validation, runs after the built-in checks. Sync. */
export interface ValidateContext extends DropzoneContext {
    /** The incoming native file. */
    file: File;
    /** The files already in the dropzone. */
    existingFiles: FileState[];
}

/**
 * `beforeFilesAddCallback(ctx)` — once per add batch, after validation.
 * Return `false` to cancel (the files are reported in `file-reject` with
 * `code: 'rejected'`), a `File[]` to add those instead (validated again,
 * the hook is not re-run), or nothing to continue. May be async.
 */
export interface BeforeFilesAddContext extends DropzoneContext {
    /** The files that passed validation and are about to be added. */
    files: File[];
    /** The files already in the dropzone. */
    existingFiles: FileState[];
}

/**
 * `beforeFilesRemoveCallback(ctx)` — before a user-initiated removal (row ✕,
 * popover "Clear all") or a programmatic one with `{ confirm: true }`.
 * Return `false` to cancel. May be async.
 */
export interface BeforeFilesRemoveContext extends DropzoneContext {
    /** The files about to leave (one for a row ✕, all for Clear all). */
    files: FileState[];
    /** Every file currently in the dropzone. */
    allFiles: FileState[];
}

/**
 * `beforeFilesCancelCallback(ctx)` — before a cancel: `cancelFile(id)` / the
 * row Cancel button (`files` = `[file]`) and `cancelAll()` / "Cancel all"
 * (once, `files` = every file being cancelled). Return `false` to veto (the
 * uploads keep running). May be async. Internal cancels — removing a running
 * file, the element being removed from the page — don't ask.
 */
export interface BeforeFilesCancelContext extends DropzoneContext {
    /** The files about to be cancelled. */
    files: FileState[];
    /** Every file currently in the dropzone. */
    allFiles: FileState[];
}

/** `getFileIconCallback(ctx)` — return icon markup, or `null` to fall through. */
export interface FileIconContext extends DropzoneContext {
    /** The file whose icon is resolved. */
    file: File;
}

/**
 * `uploadFileCallback(ctx)` — the per-file upload handler. Resolve on
 * success (optionally with a {@link FileUploadResult}), reject on failure.
 * Report progress with `ctx.setProgress(percent)`; bail out when
 * `ctx.signal` aborts (pause / cancel / remove).
 *
 * Resume flow: the first call gets `startBytes = 0`. Stash server state with
 * `setMetadata({ uploadUrl })`; after a pause / retry the next call sees it in
 * `metadata`, and `startBytes` reflects the last reported progress.
 */
export interface FileUploadContext extends DropzoneContext {
    /** The native file to upload. */
    file: File;
    /** Fires on pause / cancel / remove — abort the request and reject. */
    signal: AbortSignal;
    /** Report progress (0–100). Ignored after `signal` aborted. */
    setProgress(percent: number): void;
    /** Byte offset to resume from (0 for a fresh upload). */
    startBytes: number;
    /** `startBytes` as a 0–100 percent. */
    startPercent: number;
    /** `FileState.metadata` — stashed by earlier attempts (`setMetadata`) or a prior result. */
    metadata: Readonly<Record<string, unknown>> | undefined;
    /** Shallow-merge into `FileState.metadata` now, so the next attempt sees it. */
    setMetadata(patch: Record<string, unknown>): void;
    /** Per-file metadata stamped at add time by the contributing picker (`upload-metadata`). */
    uploadMetadata: Readonly<Record<string, unknown>> | undefined;
}

/** `renderFileItemCallback(ctx)` — one file row (structural mode). */
export interface FileItemRenderContext extends DropzoneContext {
    /** The file to render. */
    file: FileState;
    /** Index of the file in the rendered list. */
    fileIndex: number;
    /** The display mode (from `display-mode`, or derived from `list-appearance`). */
    displayMode: DisplayMode;
    /** Whether the row renders inside the compact popover. */
    isInPopover: boolean;
}

/** `renderListWrapperCallback(ctx)` — the wrapper around the rows (structural mode). */
export interface ListWrapperRenderContext extends DropzoneContext {
    /** The rendered rows, as one HTML string. */
    rowsHtml: string;
    /** The files those rows show. */
    files: FileState[];
}

/** `renderPromptCallback(ctx)` — the drop-area prompt (structural mode). Context only. */
export type PromptRenderContext = DropzoneContext;

/** `renderSummaryCallback(ctx)` — the compact-mode summary line (structural mode). */
export interface SummaryRenderContext extends DropzoneContext {
    /** Every file in the dropzone. */
    files: FileState[];
}

/** `getCustomStylesCallback(ctx)` — CSS injected into the shadow root. Context only. */
export type CustomStylesContext = DropzoneContext;

// ============================================================================
// EVENT DETAILS
// ============================================================================

/** `file-add` — a file entered the dropzone (one event per file). */
export interface FileAddEventDetail extends DropzoneContext {
    file: FileState;
}

/** `file-remove` — a file left the dropzone (one event per file). */
export interface FileRemoveEventDetail extends DropzoneContext {
    file: FileState;
}

/** `files-change` — rAF-coalesced "queue updated" tick. */
export interface FilesChangeEventDetail extends DropzoneContext {
    /** Ids touched since the previous tick (alive or removed). */
    changedIds: string[];
    /** Snapshot of every file. */
    files: FileState[];
}

/** `change` — the selection changed (add / remove / clear). */
export interface ChangeEventDetail extends DropzoneContext {
    /** Snapshot of every file after the change. */
    files: FileState[];
}

/** `file-reject` — files failed validation or the add was cancelled. */
export interface FileRejectEventDetail extends DropzoneContext {
    rejectedFiles: RejectedFile[];
}

/** `file-retry` — a failed / cancelled file was re-queued (status is already `pending`). */
export interface FileRetryEventDetail extends DropzoneContext {
    file: FileState;
}

/** `file-upload` — `uploadFileCallback` resolved for a file. */
export interface FileUploadEventDetail extends DropzoneContext {
    file: FileState;
}

/**
 * `file-delete` — fires with `file-remove` when the removed file has
 * server-side state (completed, or metadata stashed via `setMetadata`).
 */
export interface FileDeleteEventDetail extends DropzoneContext {
    file: FileState;
}

/**
 * `file-cancel` — a cancel finished. `result`: `cancelled` (the handler
 * settled in time, or nothing was running), `timeout-error` /
 * `timeout-remove` (it didn't — `cancel-timeout-behavior` applied).
 * `uploadedBytes` / `metadata` describe what the server may hold: cleaning a
 * partial upload up server-side is the app's job.
 */
export interface FileCancelEventDetail extends DropzoneContext {
    file: FileState;
    result: FileCancelResult;
    /** Bytes the upload had reported when the cancel finished. */
    uploadedBytes: number;
    /** What the handler stashed via `ctx.setMetadata` (e.g. a tus.io upload URL). */
    metadata: Record<string, unknown> | undefined;
}

/** `file-progress` — a file's progress value changed. */
export interface FileProgressEventDetail extends DropzoneContext {
    id: string;
    /** 0–100, clamped. */
    progress: number;
    status: FileState['status'];
    file: FileState;
}

/** `file-status-change` — a file's status transitioned (`oldStatus !== newStatus`). */
export interface FileStatusChangeEventDetail extends DropzoneContext {
    id: string;
    oldStatus: FileState['status'];
    newStatus: FileState['status'];
    file: FileState;
}

/**
 * `file-update` — a `FileState` field other than progress / status changed
 * (`previewUrl` generated, upload result merged: `metadata`, `downloadUrl`, `name`).
 */
export interface FileUpdateEventDetail extends DropzoneContext {
    file: FileState;
}

/** `overlay-enter` / `overlay-leave` — the drag overlay gained / lost the hover. */
export interface OverlayEventDetail extends DropzoneContext {
    /** The full-viewport overlay element. */
    overlayElement: HTMLElement;
}

/** `ready` — the store was (re)built and is resolvable via `el.controller`. */
export type ReadyEventDetail = DropzoneContext;

/**
 * `file-row-update` — dispatched on the element a `renderFileItemCallback`
 * returned (structural mode) when its file changes; bubbles, not composed —
 * listen on the row element.
 */
export interface FileRowUpdateEventDetail extends DropzoneContext {
    file: FileState;
}

/** `summary-activate` (`<web-dropzone-list>`, popover appearance) — the summary line was activated. */
export type SummaryActivateEventDetail = DropzoneContext;

/** `queue-open` (`<web-dropzone-list>`, rolling appearance) — the queue badge was clicked. */
export type QueueOpenEventDetail = DropzoneContext;

/** Event name → detail type for `<web-dropzone>`. */
export type DropzoneEventMap = {
    'file-add': FileAddEventDetail;
    'file-remove': FileRemoveEventDetail;
    'files-change': FilesChangeEventDetail;
    'change': ChangeEventDetail;
    'file-reject': FileRejectEventDetail;
    'file-retry': FileRetryEventDetail;
    'file-upload': FileUploadEventDetail;
    'file-delete': FileDeleteEventDetail;
    'file-cancel': FileCancelEventDetail;
    'file-progress': FileProgressEventDetail;
    'file-status-change': FileStatusChangeEventDetail;
    'file-update': FileUpdateEventDetail;
    'overlay-enter': OverlayEventDetail;
    'overlay-leave': OverlayEventDetail;
    'ready': ReadyEventDetail;
};

/** Event name → detail type for `<web-dropzone-list>`. */
export type DropzoneListEventMap = {
    'summary-activate': SummaryActivateEventDetail;
    'queue-open': QueueOpenEventDetail;
};

/** The names the engine notifies with (everything but `ready`, which the element owns). */
export type DropzoneEngineEventName = Exclude<keyof DropzoneEventMap, 'ready'>;

/** A detail as the engine passes it — the context is attached when it is emitted. */
export type EngineEventDetail<K extends DropzoneEngineEventName> = Omit<DropzoneEventMap[K], keyof DropzoneContext>;

