/**
 * Status-surface contract types (the rolling list's `renderRolling*Callback`
 * and the `<web-dropzone-indicator>`'s `render*Callback`). They live in the
 * headless package so `types.ts`'s `DropzoneConfig` can reference them; the
 * helpers that build / apply them stay in the renderer's `status-surface.ts`.
 *
 * The public facade these callbacks act through is `DropzoneController`
 * (`./controller.ts`) — every `StatusSurfaceArgs` carries it as `controller`.
 */

import type { FileState, FileStatus } from './types';
import type { DropzoneContext } from './interaction';

/**
 * Aggregate view of a store's file list, recomputed once per refresh cycle.
 * Exposed via every `StatusSurfaceArgs` so consumers can read counts and
 * derive their own labels.
 */
export interface StatusAggregate {
    /** Total number of files in the store's queue. */
    total: number;
    uploading: number;
    paused: number;
    pending: number;
    complete: number;
    error: number;
    cancelled: number;
    /**
     * Worst-case status for surface color. Priority:
     * error > uploading > paused > pending > complete > idle.
     * `idle` only when `total === 0`.
     */
    overallStatus: FileStatus | 'idle';
}

/**
 * Arguments handed to every render callback. Holds both the per-current-file
 * slice (undefined when nothing's uploading) and the queue-wide aggregate
 * (always present), so any callback can pick the slice it needs.
 */
export interface StatusSurfaceArgs extends DropzoneContext {
    // ---- Per-current-file slice -------------------------------------------
    /** The "focal" file — the first uploading file, or the most recent. */
    currentFile: FileState | undefined;
    /** Convenience: `currentFile?.progress`, omitted when there's none. */
    currentFilePercent: number | undefined;
    /** Convenience: `currentFile?.status`, omitted when there's none. */
    currentFileStatus: FileStatus | undefined;

    // ---- Aggregate slice --------------------------------------------------
    aggregate: StatusAggregate;
    /** Byte-weighted overall progress across the entire queue, 0–100. */
    overallPercent: number;
    /** Worst-case status across the queue (same as `aggregate.overallStatus`). */
    overallStatus: FileStatus | 'idle';

    // ---- Escape hatch -----------------------------------------------------
    /** Full file list, read-only. Rarely needed once aggregate is available. */
    files: ReadonlyArray<FileState>;
    // `controller` (act: `controller.pauseAll()`, `controller.removeFile(id)`)
    // and `element` (the `<web-dropzone>` store host) come from DropzoneContext.
}

/**
 * Universal render-part return type. See `renderer/status-surface.ts` for
 * the memoization semantics:
 *   - `null` / `undefined` → library default
 *   - `false`              → hide this part (or, for body, the whole surface)
 *   - `string`             → set as `innerHTML` (memoized: skipped when
 *                            equal to the previous string)
 *   - `HTMLElement`        → replace children (identity-checked: skipped
 *                            when the returned node is already mounted)
 */
export type StatusSurfaceResult = string | HTMLElement | false | null | undefined;

/**
 * One render callback. Three of these (body / fileInfo / progress) are
 * exposed on every status surface.
 */
export type StatusSurfaceCallback = (args: StatusSurfaceArgs) => StatusSurfaceResult;
