/**
 * `DropzoneController` — the public facade (`el.controller`, and the
 * `controller` on every callback ctx / event detail).
 *
 * Built once per host from a method-name list; every call delegates to the
 * CURRENT engine (`getTarget()`), so a controller captured in a closure keeps
 * working across store rebuilds (a mode flip, a DOM move). Reads before the
 * first build return empty defaults; mutators are no-ops.
 */

import type { DropzoneEngine } from './dropzone-engine';
import type { AddFilesOptions, DropzoneConfig, FileState, OverallProgress } from './types';
import { DEFAULT_CONFIG } from './dropzone-shared';

export interface DropzoneController {
    /** `true` once the store is built (the `ready` event fired) and until it is torn down. */
    readonly isReady: boolean;

    // ---- add / remove -------------------------------------------------------
    /** Add files programmatically (validation + `beforeFilesAddCallback` apply). */
    addFiles(files: FileList | File[], opts?: AddFilesOptions): Promise<void>;
    /** Remove a file by id. Skips `beforeFilesRemoveCallback` unless `opts.confirm`. */
    removeFile(id: string, opts?: { confirm?: boolean }): Promise<void>;
    /** Remove files by id (the pair of `addFiles`); with `opts.confirm` the gate runs once for the batch. */
    removeFiles(ids: readonly string[], opts?: { confirm?: boolean }): Promise<void>;
    /** Remove every file (aborts uploads). Same gate semantics as `removeFile`. */
    clear(opts?: { confirm?: boolean }): Promise<void>;

    // ---- reads --------------------------------------------------------------
    /** A copy of the file list (mutating it does not change the dropzone). */
    getFiles(): FileState[];
    getFile(id: string): FileState | undefined;
    /** The merged config (defaults + inputs). */
    getConfig(): Readonly<DropzoneConfig>;
    /** Byte-weighted aggregate progress + per-status counts. */
    getOverallProgress(): OverallProgress;

    // ---- app-driven uploads -------------------------------------------------
    /** Set a file's progress (0–100) — for apps that drive uploads themselves. */
    updateFileProgress(id: string, progress: number): void;
    /** Set a file's status (+ optional error message). */
    setFileStatus(id: string, status: FileState['status'], error?: string): void;

    // ---- component-driven uploads (`uploadFileCallback`) --------------------
    /** Drain the queue of pending files through the worker pool. */
    uploadAll(): Promise<void>;
    /** Upload one file now, bypassing the queue. */
    uploadFile(id: string): Promise<void>;
    pauseFile(id: string): void;
    resumeFile(id: string): Promise<void>;
    /** Cancel a file's upload (uploading / pending / paused); resolves when the cancel finished. */
    cancelFile(id: string): Promise<void>;
    retryFile(id: string): void;
    pauseAll(): void;
    /** Cancel every uploading / pending / paused file (gate asked once); resolves when all cancels finished. */
    cancelAll(): Promise<void>;
    resumeAll(): Promise<void>;
    retryAll(): void;
}

const EMPTY_PROGRESS: OverallProgress = Object.freeze({
    uploadedBytes: 0,
    totalBytes: 0,
    completedCount: 0,
    failedCount: 0,
    uploadingCount: 0,
    pausedCount: 0,
    pendingCount: 0,
    cancellingCount: 0,
    percent: 0,
    hasActivity: false,
    aggregateStatus: 'complete'
}) satisfies OverallProgress;

/** Methods forwarded verbatim; the value is the result when there is no engine yet. */
const METHODS = {
    addFiles: () => Promise.resolve(),
    removeFile: () => Promise.resolve(),
    removeFiles: () => Promise.resolve(),
    clear: () => Promise.resolve(),
    getFiles: () => [],
    getFile: () => undefined,
    getConfig: () => DEFAULT_CONFIG,
    getOverallProgress: () => EMPTY_PROGRESS,
    updateFileProgress: () => undefined,
    setFileStatus: () => undefined,
    uploadAll: () => Promise.resolve(),
    uploadFile: () => Promise.resolve(),
    pauseFile: () => undefined,
    resumeFile: () => Promise.resolve(),
    cancelFile: () => Promise.resolve(),
    retryFile: () => undefined,
    pauseAll: () => undefined,
    cancelAll: () => Promise.resolve(),
    resumeAll: () => Promise.resolve(),
    retryAll: () => undefined
} satisfies Record<Exclude<keyof DropzoneController, 'isReady'>, () => unknown>;

/**
 * Build a controller that delegates to `getTarget()` on every call. The
 * element passes `() => { this.flush(); return this.#engine }`; a standalone
 * engine passes `() => this`.
 */
export function createDropzoneController(getTarget: () => DropzoneEngine | undefined): DropzoneController {
    const controller = {} as Record<string, unknown>;
    for (const [name, fallback] of Object.entries(METHODS)) {
        controller[name] = (...args: unknown[]) => {
            const target = getTarget() as unknown as Record<string, (...a: unknown[]) => unknown> | undefined;
            return target ? target[name](...args) : (fallback as () => unknown)();
        };
    }
    Object.defineProperty(controller, 'isReady', {
        enumerable: true,
        get: () => !!getTarget()
    });
    return controller as unknown as DropzoneController;
}
