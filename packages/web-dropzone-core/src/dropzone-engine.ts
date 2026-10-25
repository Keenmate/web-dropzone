/**
 * DropzoneEngine — the non-rendering store behind `<web-dropzone>`.
 *
 * File state, the validation / add pipeline, the upload worker pool, the
 * status / progress mutator, reorder timers, persisted-state load / save and
 * the overall-progress aggregate. No DOM. `WebDropzone` (the renderer)
 * extends it and overrides the protected lifecycle hooks.
 *
 * Interaction model (web-components-core SPEC §12.5): the engine NOTIFIES,
 * the element EMITS. Every happening goes through `notify(name, detail)`:
 * the renderer's `onEngineEvent` hook reacts first (DOM patches), then the
 * host's `notify` (`<web-dropzone>` → `this.emit()`: the `on*` twin + a
 * non-composed DOM event on the host). A standalone engine (no host) attaches
 * its own context and dispatches the same non-composed events on its
 * `element`. Every callback gets ONE ctx built by `ctx()` / `contextBase`,
 * carrying `controller` + `element` non-enumerably.
 *
 * The class stays exported for standalone / headless use; `<web-dropzone>`
 * never exposes it — the public API is `el.controller` (`DropzoneController`).
 */

import { fileLogger, initLogger, uiLogger } from './logger';
import { dispatch, runBeforeCallback, withComponentContext } from '@keenmate/web-components-core';
import { createDropzoneController, type DropzoneController } from './controller';
import type {
    DropzoneContext,
    DropzoneEngineEventName,
    EngineEventDetail,
    FileUploadContext
} from './interaction';
import {
    validateFile as validateFilePure,
    dedupeKeyFor,
    createFileState
} from './file-pipeline';
import type {
    DropzoneConfig,
    DedupeMode,
    FileState,
    RejectedFile,
    AddFilesOptions,
    DropzoneState,
    OverallProgress
} from './types';
// Module-level pure helpers + DEFAULT_CONFIG live in `./dropzone-shared`
// so both core and renderer can import them without circular dependencies.
import {
    formatFileSize,
    isImageFile,
    createImagePreview,
    generateFileId,
    DEFAULT_CONFIG
} from './dropzone-shared';

/**
 * The host an engine reports to — `<web-dropzone>` passes itself, its
 * controller getter and a `notify` that routes to `emit()`.
 */
export interface DropzoneEngineHost {
    /** The host element — `element` on every ctx / event detail. */
    element: HTMLElement;
    /** The public facade — `controller` on every ctx / event detail. */
    getController(): DropzoneController;
    /** Emit a public event (the element attaches the context). */
    notify<K extends DropzoneEngineEventName>(name: K, detail: EngineEventDetail<K>): void;
}

/**
 * Non-rendering store. `WebDropzone` extends this and adds DOM rendering.
 *
 * The class is left non-abstract because users can construct it directly
 * for headless / mode-3 scenarios where they own all rendering. In that
 * case the protected hooks below stay as their no-op defaults, the engine
 * is its own controller (`engine.controller`), and events dispatch on
 * `element`.
 */
export class DropzoneEngine {
    // ========================================================================
    // CORE STATE (data + pipelines, no DOM)
    // ========================================================================
    protected element: HTMLElement;
    protected config: DropzoneConfig;
    protected files: FileState[] = [];

    // ---- Upload pipeline state — only relevant when `uploadFileCallback`
    //      (Mode A store-level) or `FileState.uploadFileCallback` (Mode B
    //      per-file) is set. ------------------------------------------------
    /** AbortController per in-flight upload, used by pause/cancel/remove. */
    protected controllers = new Map<string, AbortController>();
    /** File IDs the user paused. A paused file aborts its handler and stays
     *  out of the worker pool's pending pickup. resumeFile() removes the
     *  entry and re-queues. */
    protected pausedIds = new Set<string>();
    /** Set of file IDs currently claimed by a worker. Prevents two workers
     *  from racing onto the same file when the queue is mid-drain. */
    protected activeIds = new Set<string>();
    /** True while the worker pool is draining (at least one worker alive). */
    protected isDrainingQueue = false;
    /** Number of live upload workers. uploadAll() tops this up to
     *  `config.concurrency` so a re-entrant call (retryAll's loop, files added
     *  mid-drain) refills idle slots instead of waiting for a busy worker. */
    protected activeWorkerCount = 0;
    /** Settles when the current drain's last worker exits — what every
     *  uploadAll() call made during that drain resolves with. */
    private drainPromise: Promise<void> | null = null;
    private settleDrain: ((error?: unknown) => void) | null = null;
    private drainError: unknown = undefined;
    /** Pending reorder timers per file id, used to delay the visual move of
     *  a row from the "unresolved" bucket to the "complete" bucket (see
     *  `reorderCompletedDelay`). A file with a pending timer is NOT yet
     *  reorder-eligible — the timer firing IS the eligibility signal.
     *  Cancelled if the file un-completes (retry) or is removed before
     *  the timer fires. */
    protected reorderTimers = new Map<string, number>();

    // ---- Progress throttling ---------------------------------------------
    /**
     * Per-file progress throttling. `lastFireAt` holds the last
     * `performance.now()` we ran the tick for each file. When a new
     * progress call lands within the throttle window, the latest value is
     * stashed in `pendingProgress` and a trailing-edge timer
     * (`pendingTimer`) fires it after the window elapses. The final value
     * (e.g. 100%) is never dropped — held values flush as a single trailing
     * tick. See `progressThrottle` config.
     */
    protected throttleLastFireAt: Map<string, number> = new Map();
    protected throttlePendingTimer: Map<string, ReturnType<typeof setTimeout>> = new Map();
    protected throttlePendingProgress: Map<string, number> = new Map();

    // ---- Coalesced files-change event state ------------------------------
    /**
     * Any granular emit (`file-add` / `file-remove` / `file-progress` /
     * `file-status-change`) marks the file id dirty and schedules an rAF;
     * the rAF dispatches a single `files-change` with the current snapshot.
     * Mode-3 / reactive consumers subscribe to this one event instead of the
     * four granular ones to get one diff per frame.
     */
    protected dirtyFileIds: Set<string> = new Set();
    protected filesChangedRafHandle: number | null = null;

    // ---- Interaction model -----------------------------------------------
    /** The host this engine reports to (`<web-dropzone>`); null when standalone. */
    protected readonly host: DropzoneEngineHost | null;
    /** Standalone only: the engine's own facade (`createDropzoneController(() => this)`). */
    private ownController: DropzoneController | null = null;
    /**
     * Prototype for hot-path ctx objects (per-row icon / per-file validation):
     * `controller` / `element` as getters, so a ctx built with
     * `Object.create(contextBase)` inherits them (non-enumerable, one
     * allocation per ctx).
     */
    readonly contextBase: DropzoneContext;

    constructor(element: HTMLElement, config: DropzoneConfig = {}, host?: DropzoneEngineHost) {
        this.element = element;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.host = host ?? null;
        const engine = this;
        this.contextBase = Object.create(Object.prototype, {
            controller: { get: () => engine.controller },
            element: { get: () => engine.contextElement }
        }) as DropzoneContext;
        initLogger.debug('DropzoneEngine initialized', { config: this.config });
    }

    /** The public facade every ctx / event detail carries. */
    get controller(): DropzoneController {
        if (this.host) return this.host.getController();
        return (this.ownController ??= createDropzoneController(() => this));
    }

    /** `element` on every ctx / event detail — the host, or `element` when standalone. */
    protected get contextElement(): HTMLElement {
        return this.host?.element ?? this.element;
    }

    /** Attach `controller` + `element` (non-enumerable) to a callback ctx, in place. */
    ctx<T extends object>(fields: T): T & DropzoneContext {
        return withComponentContext(fields, this.controller, this.contextElement);
    }

    /**
     * Report a happening: the renderer's {@link onEngineEvent} reacts first,
     * then the host emits it (or, standalone, a non-composed `CustomEvent`
     * with the context attached is dispatched on `element`).
     */
    protected notify<K extends DropzoneEngineEventName>(name: K, detail: EngineEventDetail<K>): void {
        this.onEngineEvent(name, detail);
        if (this.host) this.host.notify(name, detail);
        else dispatch(this.element, name, this.ctx(detail as object));
    }

    /** Renderer hook — react to an engine happening before it is emitted. */
    protected onEngineEvent<K extends DropzoneEngineEventName>(_name: K, _detail: EngineEventDetail<K>): void { /* renderer override */ }

    /** Renderer hook — `updateConfig` re-rendered; refresh aggregate surfaces. */
    protected onConfigApplied(): void { /* renderer override */ }

    // ========================================================================
    // PROTECTED RENDERER LIFECYCLE HOOKS
    //
    // Only structural / lifecycle hooks live here. State-driven updates
    // (per-file patches, popover refresh, summary / selector badge / overall
    // progress) flow through `notify()` → the renderer's `onEngineEvent`
    // hook (`file-progress`, `file-status-change`, `file-update`,
    // `file-add`, `file-remove`, `change`) and `onConfigApplied`.
    //
    // Empty defaults so `DropzoneEngine` is usable on its own (headless / mode-3
    // scenarios); `WebDropzone` overrides each lifecycle hook with the
    // matching DOM logic.
    // ========================================================================

    /** Initial render. Called from `updateConfig`'s rebuild path. */
    protected render(): void { /* renderer override */ }

    /** Rebuild the inline file list area (or files-inside container).
     *  Called after add / remove / clear so the row set is recreated
     *  fresh — per-tick updates fly through `file-progress` /
     *  `file-status-change` instead. */
    protected renderFileList(): void { /* renderer override */ }

    /** Apply a reorder-timer payload to the renderer (move the row's
     *  bucket dataset, re-sort popover, re-render capped list). Called
     *  from `scheduleReorder`'s `apply()` callback. Kept as a hook (rather
     *  than an event) because it's purely internal coordination — no
     *  consumer-facing reason to surface it. */
    protected applyReorderToRenderer(
        _id: string,
        _becomingComplete: boolean
    ): void { /* renderer override */ }

    /** Subscribe / re-subscribe to drag events on the (configurable)
     *  overlay target. */
    protected setupOverlayTarget(): void { /* renderer override */ }

    /** Tear down the overlay listeners + remove any live overlay node. */
    protected cleanupOverlay(): void { /* renderer override */ }

    /** Detach drag / drop / click / input listeners. */
    protected detachEventListeners(): void { /* renderer override */ }

    /** Attach drag / drop / click / input listeners. The renderer also
     *  switches its `onEngineEvent` reactions on here so the in-class DOM
     *  stays in sync with state mutations. */
    protected attachEventListeners(): void { /* renderer override */ }

    // ========================================================================
    // PUBLIC READ API
    // ========================================================================

    /**
     * Get all current files
     */
    getFiles(): FileState[] {
        return [...this.files];
    }

    /**
     * Read-only view of the merged config. Useful for callers (e.g. the
     * web-component shell) that need to query a config value after
     * resolution against defaults.
     */
    getConfig(): Readonly<DropzoneConfig> {
        return this.config;
    }

    /**
     * Get a file by ID
     */
    getFile(id: string): FileState | undefined {
        return this.files.find(f => f.id === id);
    }

    /**
     * Add files programmatically. The optional `opts` (Mode B — see
     * ARCHITECTURE.md) carries per-file routing the contributing picker
     * wants stamped onto each new FileState: `uploadFileCallback` overrides
     * the store-level handler for these specific files, `uploadMetadata`
     * is handed to the handler via `FileUploadContext.uploadMetadata`.
     * Omit `opts` for Mode A — files inherit the store's handler.
     */
    addFiles(fileList: FileList | File[], opts?: AddFilesOptions): Promise<void> {
        const files = Array.from(fileList);
        return this.processFiles(files, opts);
    }

    /**
     * Remove a file by ID. Pass `{ confirm: true }` to run the
     * `beforeFilesRemoveCallback` async gate before proceeding —
     * the call returns a Promise that resolves either way; cancellation
     * is a silent no-op. Default (no opts) skips the gate, matching the
     * "programmatic calls are intentional" stance.
     */
    async removeFile(id: string, opts?: { confirm?: boolean }): Promise<void> {
        const index = this.files.findIndex(f => f.id === id);
        if (index === -1) return;

        if (opts?.confirm && this.config.beforeFilesRemoveCallback) {
            const gate = await runBeforeCallback(
                this.config.beforeFilesRemoveCallback,
                this.ctx({ files: [this.files[index]], allFiles: this.getFiles() }),
                'beforeFilesRemoveCallback'
            );
            if (gate.isCancelled) return;
            // Re-resolve index — the file might have been removed during the
            // user's confirmation by another code path.
            const recheckIndex = this.files.findIndex(f => f.id === id);
            if (recheckIndex === -1) return;
        }

        // Abort any in-flight upload for this file before dropping it from
        // state. Clearing pausedIds first prevents runUpload's catch branch
        // from flipping the (already-removed) file to 'paused'.
        this.pausedIds.delete(id);
        this.controllers.get(id)?.abort();
        // Cancel any pending reorder timer — the row is going away, no
        // point firing the deferred move after the row is gone.
        const pendingReorder = this.reorderTimers.get(id);
        if (pendingReorder !== undefined) {
            clearTimeout(pendingReorder);
            this.reorderTimers.delete(id);
        }

        // Re-resolve index because the async gate may have run between the
        // initial find and now (other code paths can mutate `this.files`).
        const liveIndex = this.files.findIndex(f => f.id === id);
        if (liveIndex === -1) return;
        const file = this.files[liveIndex];
        const hasServerState = this.hasServerSideState(file);
        this.files.splice(liveIndex, 1);
        this.throttleLastFireAt.delete(id);
        this.clearThrottlePending(id);

        fileLogger.debug('File removed', { id, name: file.name, hasServerState });

        // Emit events. file-delete fires on top of file-remove whenever
        // the file has server-side state worth cleaning up — completed
        // files (server has the full blob) OR any file whose handler
        // stashed metadata via setMetadata (e.g. tus.io session URL from a
        // partial upload that the user paused-then-removed). The renderer
        // reacts to file-remove (drops cached row element) and to change
        // (refreshes summary / selector badge / overall progress).
        this.emitRemoveEvent(file);
        if (hasServerState) this.emitDeleteEvent(file);
        this.emitChangeEvent();

        // Re-render the row set — per-tick updates flow through events,
        // but add / remove / clear still rebuild the inline list.
        this.renderFileList();
    }

    /**
     * Decide whether this file has server-side state that the app should
     * clean up on removal. Either:
     *   - the upload finished (server holds the full blob), OR
     *   - the handler stashed metadata via ctx.setMetadata — implying it
     *     learned a session URL / upload-id during a partial attempt, even
     *     if the upload itself never completed (pause-then-remove flow).
     */
    protected hasServerSideState(file: FileState): boolean {
        if (file.status === 'complete') return true;
        return !!file.metadata && Object.keys(file.metadata).length > 0;
    }

    /**
     * Clear all files. Pass `{ confirm: true }` to run the
     * `beforeFilesRemoveCallback` async gate with the full file list
     * before wiping — gate returning false cancels the clear silently.
     * Default (no opts) skips the gate.
     */
    async clear(opts?: { confirm?: boolean }): Promise<void> {
        if (opts?.confirm && this.config.beforeFilesRemoveCallback && this.files.length > 0) {
            const gate = await runBeforeCallback(
                this.config.beforeFilesRemoveCallback,
                this.ctx({ files: [...this.files], allFiles: this.getFiles() }),
                'beforeFilesRemoveCallback'
            );
            if (gate.isCancelled) return;
        }

        // Abort every in-flight upload before the FileState array is wiped —
        // the run paths key off `this.files.find(...)` so an empty array would
        // already be enough, but explicitly aborting also frees XHRs etc.
        for (const ctrl of this.controllers.values()) ctrl.abort();
        this.controllers.clear();
        this.pausedIds.clear();
        this.activeIds.clear();

        const removedFiles = [...this.files];
        this.files = [];
        this.clearAllReorderTimers();

        fileLogger.debug('All files cleared', { count: removedFiles.length });

        // Emit events for each removed file — also fire file-delete for
        // any file that had server-side state stashed (completed OR paused
        // with metadata, etc.) so server cleanup hooks fire on Clear all.
        // The renderer reacts to file-remove + change to keep its DOM
        // cache (`fileRowElements`) and summary surfaces in sync.
        removedFiles.forEach(file => {
            this.emitRemoveEvent(file);
            if (this.hasServerSideState(file)) this.emitDeleteEvent(file);
        });
        this.emitChangeEvent();

        // Re-render the row set.
        this.renderFileList();
    }

    /**
     * Update configuration in place. Re-renders the component, re-binds event
     * listeners, and re-applies file list / summary / hidden inputs against
     * the new config. Returns `true` so callers can use the same surface as
     * other KM web-components (where `false` signals a structural change that
     * needs a full reinit; this component can apply every config change
     * in-place, so the return value is informational).
     */
    updateConfig(config: Partial<DropzoneConfig>): boolean {
        const prevOverlayTarget = this.config.overlayTarget;
        this.config = { ...this.config, ...config };
        initLogger.debug('Config updated', { config: this.config });

        // Tear down and rebuild the in-element DOM. The dropzone's DOM is
        // small and rebuilding is cheaper than diffing — but we keep state
        // (this.files, this.dragActive, this.isPopoverOpen) intact so the
        // user-visible selection survives. `attachEventListeners` also
        // re-enables the renderer's `onEngineEvent` reactions; we fire the
        // internal `dz-config-changed` after re-render (`onConfigApplied` for
        // the renderer, a DOM signal for satellites) so the summary / overall
        // progress / selector badge / rows refresh against the new DOM.
        //
        // IMPORTANT: this dispatches `dz-config-changed`, NOT the public
        // `change`. `change` means "the file selection changed" — emitting it
        // on a config update conflated the two and, worse, let a consumer that
        // mutates config inside a `change` handler feed back into `updateConfig`
        // forever (infinite loop / frozen tab). Renderers + satellites listen
        // to BOTH events; external `change` listeners only hear real selection
        // changes.
        this.detachEventListeners();
        this.render();
        this.attachEventListeners();
        this.renderFileList();
        this.emitConfigChangedEvent();

        // Overlay target replumb only if the target actually changed —
        // listeners on document are cheap but the cleanup is observable
        // (other dropzones on the page could be relying on document-level
        // dragenter, so we don't want to thrash this unnecessarily).
        if ('overlayTarget' in config && config.overlayTarget !== prevOverlayTarget) {
            this.cleanupOverlay();
            this.setupOverlayTarget();
        }

        return true;
    }

    /**
     * Destroy the component
     */
    destroy(): void {
        // Abort any in-flight uploads — handlers should bail out via AbortError
        // so the calling app's underlying XHR / fetch is also cancelled.
        for (const ctrl of this.controllers.values()) ctrl.abort();
        this.controllers.clear();
        this.pausedIds.clear();
        this.activeIds.clear();

        // Cancel coalesced rAF; clear all per-file throttle timers.
        if (this.filesChangedRafHandle !== null) {
            cancelAnimationFrame(this.filesChangedRafHandle);
            this.filesChangedRafHandle = null;
        }
        for (const handle of this.throttlePendingTimer.values()) clearTimeout(handle);
        this.throttlePendingTimer.clear();

        this.detachEventListeners();
        this.cleanupOverlay();
        // `onDestroy` is the renderer's catch-all teardown — it wipes the
        // element's innerHTML, closes the popover (if open), and drops any
        // other renderer-only references. Core stays oblivious to the
        // popover surface.
        this.onDestroy();
        initLogger.debug('DropzoneEngine destroyed');
    }

    /** Final destroy hook — renderer override clears the element's DOM
     *  (`element.innerHTML = ''`) and drops any other renderer-only
     *  references. */
    protected onDestroy(): void { /* renderer override */ }

    // ========================================================================
    // PROGRESS + STATUS MUTATORS
    // ========================================================================

    /**
     * Update file progress (for upload tracking). Patches the affected row in
     * place rather than rebuilding the entire file list — important for upload
     * pipelines that emit progress events at 50ms intervals across many files.
     */
    updateFileProgress(id: string, progress: number): void {
        const throttleMs = this.config.progressThrottle ?? 0;
        if (throttleMs <= 0) {
            this.flushProgressTick(id, progress);
            return;
        }

        const now = performance.now();
        const lastFire = this.throttleLastFireAt.get(id) ?? 0;
        const elapsed = now - lastFire;

        if (elapsed >= throttleMs) {
            // Cooldown elapsed — fire immediately, mark timestamp.
            this.flushProgressTick(id, progress);
            this.throttleLastFireAt.set(id, performance.now());
            this.clearThrottlePending(id);
            return;
        }

        // Within cooldown — overwrite pending value; schedule a
        // trailing-edge fire if one isn't already queued.
        this.throttlePendingProgress.set(id, progress);
        if (!this.throttlePendingTimer.has(id)) {
            const wait = throttleMs - elapsed;
            const handle = setTimeout(() => {
                this.throttlePendingTimer.delete(id);
                const pending = this.throttlePendingProgress.get(id);
                this.throttlePendingProgress.delete(id);
                if (pending !== undefined) {
                    this.flushProgressTick(id, pending);
                    this.throttleLastFireAt.set(id, performance.now());
                }
            }, wait);
            this.throttlePendingTimer.set(id, handle);
        }
    }

    /**
     * Apply a single progress tick — clamp value, auto-flip status, run
     * the centralized mutator so events fire atomically, then patch the
     * row. Hot-path helper for `updateFileProgress`; also used by the
     * throttle's trailing-edge timer with the latest stashed progress
     * value.
     */
    protected flushProgressTick(id: string, progress: number): void {
        const file = this.files.find(f => f.id === id);
        if (!file) return;
        const clamped = Math.max(0, Math.min(100, progress));
        let nextStatus = file.status;
        if (clamped > 0 && clamped < 100 && file.status === 'pending') {
            nextStatus = 'uploading';
        } else if (clamped === 100 && file.status === 'uploading') {
            nextStatus = 'complete';
        }
        // Row patch is event-driven now — `mutateFileState` emits
        // `file-progress` (and `file-status-change` when status flips);
        // the renderer's listener on the host element does the DOM write.
        this.mutateFileState(file, { progress: clamped, status: nextStatus });
        fileLogger.debug('File progress updated', { id, progress: file.progress, status: file.status });
    }

    protected clearThrottlePending(id: string): void {
        const handle = this.throttlePendingTimer.get(id);
        if (handle !== undefined) clearTimeout(handle);
        this.throttlePendingTimer.delete(id);
        this.throttlePendingProgress.delete(id);
    }

    /**
     * Set file status (pending, uploading, complete, error). Patches the
     * affected row in place — see updateFileProgress.
     */
    setFileStatus(id: string, status: FileState['status'], error?: string): void {
        const file = this.files.find(f => f.id === id);
        if (!file) return;

        if (error) file.error = error;
        // 'complete' implies progress=100 — bundle into one mutator call so
        // the status-changed and progress events fire atomically. The
        // renderer's `file-status-change` listener patches the row.
        this.mutateFileState(
            file,
            status === 'complete' ? { status, progress: 100 } : { status }
        );

        fileLogger.debug('File status updated', { id, status, error });
    }

    /**
     * Centralized status/progress mutator. **All** status and progress
     * mutations must route through here so the substrate events
     * (`file-progress`, `file-status-change`) fire at every transition.
     * Direct `file.status = …` / `file.progress = …` writes leave
     * satellite renderers stale.
     *
     * `progress` is clamped to [0, 100]. No-op mutations (status equals
     * prev, progress equals prev) do not emit. `file.error` is intentionally
     * out of scope — events only carry status / progress; callers handle
     * error inline.
     */
    protected mutateFileState(
        file: FileState,
        patch: { status?: FileState['status']; progress?: number }
    ): void {
        const prevStatus = file.status;
        const prevProgress = file.progress;

        if (patch.status !== undefined) file.status = patch.status;
        if (patch.progress !== undefined) {
            file.progress = Math.max(0, Math.min(100, patch.progress));
        }

        if (file.status !== prevStatus) {
            this.emitFileStatusChanged(file, prevStatus, file.status);
        }
        if (file.progress !== prevProgress) {
            this.emitFileProgress(file);
        }
    }

    // ========================================================================
    // UPLOAD PIPELINE — component-driven uploads when uploadFileCallback is set
    // ========================================================================

    /**
     * Re-queue a single file's upload after a failure (error / cancelled) and
     * fire `file-retry` so apps with their own handler can re-run it. Symmetric
     * with the pause/resume design: the COMPONENT preserves `file.progress`
     * and the HANDLER decides whether to continue from the partial offset
     * (resume-aware, e.g. tus.io HEAD then PATCH from the server's offset) or
     * reset and start fresh (single-shot endpoints). Handlers that always
     * start from 0 can simply call `ctx.setProgress(0)` on their first tick — the
     * bar snaps back from the old failure point as expected. Clears `error`
     * and flips status to `pending`; `file.progress` is unchanged so
     * `ctx.startBytes` reflects the last known offset.
     */
    retryFile(id: string): void {
        const file = this.files.find(f => f.id === id);
        if (!file) return;
        this.pausedIds.delete(id);
        // Cancel any pending reorder + release the "complete" bucket
        // immediately. Belt-and-braces: patchFileRow's boundary check
        // also covers this when the row is in the rendered DOM, but
        // calling scheduleReorder(id, false) directly handles the case
        // where the row is hidden behind a Show-more cap (querySelector
        // returns null and the inline branch skips).
        if (this.config.isReorderCompletedEnabled) {
            this.scheduleReorder(id, false);
        }
        file.error = undefined;
        this.mutateFileState(file, { status: 'pending' });
        fileLogger.debug('File retry requested', { id, name: file.name, startPercent: file.progress });
        this.emitRetryEvent(file);
        // Component-driven mode: re-queue via the worker pool. A call made
        // mid-drain joins it and refills idle workers up to `concurrency`, so
        // retryAll calling retryFile in a loop runs the retries in parallel.
        // Mode B: a
        // per-file handler also qualifies; uploadAll's per-worker filter
        // skips files with neither.
        if (file.uploadFileCallback || this.config.uploadFileCallback) {
            void this.uploadAll();
        }
    }

    /**
     * Retry every file currently in the 'error' or 'cancelled' state. Each
     * retry fires its own `file-retry` event so apps with a single
     * upload-handler wired to `file-add` can wire the same handler to
     * `file-retry` and have bulk retry "just work". When the component-driven
     * pipeline (`uploadFileCallback`) is active, retryFile() also re-queues
     * the file — the queue drains via uploadAll() called at the end.
     */
    retryAll(): void {
        // Snapshot the ids first — retryFile mutates each file's status, so
        // iterating over a live filter would skip every other entry.
        const failedIds = this.files
            .filter(f => f.status === 'error' || f.status === 'cancelled')
            .map(f => f.id);
        for (const id of failedIds) {
            this.retryFile(id);
        }
    }

    /**
     * Drain the queue of pending files through a worker pool of size
     * `config.concurrency`. A call made while a drain is running tops the pool
     * back up to `concurrency` (workers that found nothing to do have already
     * exited) and resolves with that same drain — so `retryAll()` retrying N
     * files in a loop, or files added mid-drain, use every free slot.
     */
    uploadAll(): Promise<void> {
        const concurrency = Math.max(1, this.config.concurrency ?? 1);

        if (!this.drainPromise) {
            this.isDrainingQueue = true;
            this.drainError = undefined;
            this.drainPromise = new Promise<void>((resolve, reject) => {
                this.settleDrain = (error?: unknown) => (error === undefined ? resolve() : reject(error));
            });
        }
        const drain = this.drainPromise;

        // Mode B: skip files that have neither a per-file handler nor a
        // store-level handler. Otherwise the worker spins picking up files
        // that runUpload would immediately drop, never marking activeIds.
        const hasHandler = (f: FileState) =>
            !!(f.uploadFileCallback || this.config.uploadFileCallback);

        const worker = async (): Promise<void> => {
            try {
                while (true) {
                    const next = this.files.find(f =>
                        f.status === 'pending' &&
                        !this.pausedIds.has(f.id) &&
                        !this.activeIds.has(f.id) &&
                        hasHandler(f)
                    );
                    if (!next) return;
                    this.activeIds.add(next.id);
                    try {
                        await this.runUpload(next.id);
                    } finally {
                        this.activeIds.delete(next.id);
                    }
                }
            } catch (error) {
                if (this.drainError === undefined) this.drainError = error;
            } finally {
                this.activeWorkerCount--;
                if (this.activeWorkerCount === 0) {
                    const settle = this.settleDrain;
                    const error = this.drainError;
                    this.isDrainingQueue = false;
                    this.drainPromise = null;
                    this.settleDrain = null;
                    this.drainError = undefined;
                    settle?.(error);
                }
            }
        };

        // Count every new worker before starting any: a worker that finds
        // nothing exits synchronously, and must not see the count hit 0 (and
        // settle the drain) while its siblings are still being spawned.
        const missing = concurrency - this.activeWorkerCount;
        if (missing > 0) {
            this.activeWorkerCount += missing;
            for (let i = 0; i < missing; i++) void worker();
        }
        return drain;
    }

    /**
     * Upload a single file by ID immediately, bypassing the queue. Useful for
     * "upload-on-demand" UIs (e.g. each row has its own upload button).
     */
    async uploadFile(id: string): Promise<void> {
        // Mode B: a per-file handler is enough — the file might have come
        // in via a picker that owns its own handler, even if the store
        // itself has none.
        const file = this.files.find(f => f.id === id);
        if (!file) return;
        if (!file.uploadFileCallback && !this.config.uploadFileCallback) return;
        if (this.activeIds.has(id)) return;
        this.activeIds.add(id);
        try {
            await this.runUpload(id);
        } finally {
            this.activeIds.delete(id);
        }
    }

    /** Pause an in-flight upload. The handler's AbortSignal fires; the file
     *  status flips to 'paused' once the handler bails. resumeFile() restarts
     *  from progress=0 (handlers don't resume mid-stream by default). */
    pauseFile(id: string): void {
        this.pausedIds.add(id);
        const ctrl = this.controllers.get(id);
        if (ctrl) {
            ctrl.abort();
        }
        // Always flip status to 'paused' synchronously when applicable.
        // Two cases this covers:
        //   1) Not in flight (no ctrl, status pending/uploading) — same as
        //      the original `else` branch.
        //   2) In flight under auto-retry, but paused during the retry
        //      delay (between attempts) — the previous attempt's ctrl is
        //      still in the controllers map (finally hasn't fired yet)
        //      because the outer runUpload is awaiting setTimeout. We hit
        //      the `if (ctrl)` branch above and abort, but the catch path
        //      that would normally flip status to 'paused' is already
        //      done — its delay-wakeup will see `pausedIds.has(id)` and
        //      bail out early without touching status. So the file would
        //      be left visibly "uploading" forever. Flipping here
        //      synchronously is idempotent with the catch-path flip when
        //      a handler IS in flight (status will already be 'paused' by
        //      the time the catch runs; the catch's re-flip is a no-op).
        const file = this.files.find(f => f.id === id);
        if (file && (file.status === 'pending' || file.status === 'uploading')) {
            this.mutateFileState(file, { status: 'paused' });
        }
    }

    /**
     * Un-pause a file and re-queue it. The worker pool picks it up on its
     * next iteration (or immediately if no workers are running). Progress is
     * preserved across pause → resume so the handler can resume mid-stream
     * if its server supports it (HTTP Content-Range, tus.io, etc); the
     * handler receives the preserved offset via `ctx.startBytes`.
     *
     * Cancelled files are treated as fresh starts since "cancel" is
     * user-initiated abort — server-side state should be assumed gone.
     */
    async resumeFile(id: string): Promise<void> {
        this.pausedIds.delete(id);
        const file = this.files.find(f => f.id === id);
        if (!file) return;
        if (file.status === 'paused') {
            // Preserve progress — handler resumes from ctx.startBytes.
            file.error = undefined;
            this.mutateFileState(file, { status: 'pending' });
        } else if (file.status === 'cancelled') {
            // Cancelled → user-initiated abort, server state is assumed lost.
            file.error = undefined;
            this.mutateFileState(file, { status: 'pending', progress: 0 });
        }
        await this.uploadAll();
    }

    /** Cancel an in-flight upload. Unlike pauseFile(), the file ends in the
     *  'cancelled' status and won't auto-resume — the user has to retry. */
    cancelFile(id: string): void {
        // Distinguish cancel from pause in the run path by clearing pausedIds.
        this.pausedIds.delete(id);
        const ctrl = this.controllers.get(id);
        if (ctrl) {
            ctrl.abort();
        } else {
            const file = this.files.find(f => f.id === id);
            if (file && (file.status === 'pending' || file.status === 'uploading')) {
                this.mutateFileState(file, { status: 'cancelled' });
            }
        }
    }

    /** Pause every uploading / pending file. */
    pauseAll(): void {
        for (const f of this.files) {
            if (f.status === 'uploading' || f.status === 'pending') {
                this.pauseFile(f.id);
            }
        }
    }

    /** Resume every paused file. Progress is preserved so handlers see a
     *  non-zero `ctx.startBytes` and can resume mid-stream. */
    async resumeAll(): Promise<void> {
        for (const f of this.files) {
            if (f.status === 'paused') {
                this.pausedIds.delete(f.id);
                // Progress preserved — handler sees startBytes > 0.
                f.error = undefined;
                this.mutateFileState(f, { status: 'pending' });
            }
        }
        await this.uploadAll();
    }

    /**
     * Internal: run the upload handler for a single file, drive the status
     * machine, and apply the retry policy on failure. The worker pool calls
     * this — direct callers should use uploadFile() so the activeIds bookkeeping
     * stays consistent.
     */
    protected async runUpload(id: string, attempt = 0): Promise<void> {
        const file = this.files.find(f => f.id === id);
        if (!file) return;
        if (this.pausedIds.has(id)) return;
        // Mode B precedence: a file-stamped handler (set by the contributing
        // picker at add-time, see ARCHITECTURE.md) wins over the store-level
        // handler. Mode A files just inherit `config.uploadFileCallback`.
        const handler = file.uploadFileCallback ?? this.config.uploadFileCallback;
        if (!handler) return;

        const ctrl = new AbortController();
        this.controllers.set(id, ctrl);

        // Flip to uploading. Progress is NOT reset here — the caller
        // (resumeFile / retryFile / processFiles) controls that. Both
        // pause/resume AND retry-after-failure preserve `file.progress`,
        // so a resume-aware handler always sees a non-zero `startBytes`
        // for any re-entry and can decide whether to continue or restart.
        // Cancel-then-resume (via resumeFile after a cancel) resets to 0,
        // matching the explicit-restart intent of cancellation.
        file.error = undefined;
        this.mutateFileState(file, { status: 'uploading' });
        // Snapshot the pre-attempt progress as the "last known-good"
        // baseline. The handler ticks ctx.setProgress optimistically (bytes
        // SENT, not bytes ACKNOWLEDGED) as data flies up the wire — if
        // the request ultimately rejects, those bytes never landed on
        // the server, so the bar has to snap back to this baseline
        // before the retry / error path takes over. Pause / cancel keep
        // the optimistic value (user intent, not failure) — only the
        // failure branch in the catch below uses this.
        const baselineProgress = file.progress;

        // Build the per-call ctx — startBytes/startPercent reflect the
        // file's preserved progress, metadata carries any state previously
        // stashed by the handler via setMetadata, and setMetadata mutates
        // file.metadata in place so subsequent attempts (after pause /
        // retry) can recover it via ctx.metadata.
        const ctx: FileUploadContext = this.ctx({
            file: file.file,
            signal: ctrl.signal,
            setProgress: (p: number) => {
                // Guard against late progress callbacks after abort —
                // updateFileProgress would auto-flip status to 'uploading'
                // and overwrite the abort outcome.
                if (ctrl.signal.aborted) return;
                this.updateFileProgress(id, p);
            },
            startBytes: Math.floor(file.size * (file.progress / 100)),
            startPercent: file.progress,
            metadata: file.metadata,
            setMetadata: (patch: Record<string, unknown>) => {
                file.metadata = { ...(file.metadata ?? {}), ...patch };
            },
            uploadMetadata: file.uploadMetadata
        });

        try {
            const result = await handler(ctx);
            // Success — patch + emit. Merge any FileUploadResult fields the
            // handler returned (metadata, downloadUrl, etc.) into the file
            // state atomically with the complete flip. Restricted shape (only
            // the four whitelisted fields) so handlers can't accidentally
            // overwrite id / file / status / progress / error.
            //
            // `file-update` covers the non-status/non-progress field writes
            // so the renderer's listener picks up `previewUrl` / `name`
            // changes; the subsequent `mutateFileState` emits the
            // status-changed + progress events that trigger the row's
            // status-pill / bar-fill patch.
            let didMerge = false;
            if (result) {
                if (result.metadata !== undefined)    { file.metadata    = result.metadata;    didMerge = true; }
                if (result.downloadUrl !== undefined) { file.downloadUrl = result.downloadUrl; didMerge = true; }
                if (result.previewUrl !== undefined)  { file.previewUrl  = result.previewUrl;  didMerge = true; }
                if (result.name !== undefined)        { file.name        = result.name;        didMerge = true; }
            }
            if (didMerge) this.emitFileUpdated(file);
            this.mutateFileState(file, { status: 'complete', progress: 100 });
            this.emitUploadedEvent(file);
        } catch (err) {
            if (ctrl.signal.aborted) {
                // The signal fires for pause AND cancel — distinguish by which
                // set holds the id. pause keeps it for resume; cancel doesn't.
                // `mutateFileState` emits `file-status-change`; the renderer's
                // listener patches the row.
                this.mutateFileState(file, {
                    status: this.pausedIds.has(id) ? 'paused' : 'cancelled'
                });
                return;
            }
            const msg = err instanceof Error ? err.message : 'Upload failed';
            const policy = this.config.retryPolicy ?? {};
            const maxAttempts = Math.max(1, policy.attempts ?? 1);
            fileLogger.debug('Auto-retry: handler rejected', {
                id, name: file.name, progress: file.progress, attempt: attempt + 1, maxAttempts, error: msg
            });
            // Snap-back behaviour is the contract of `progressMode`:
            //   - optimistic: the handler may report ctx.setProgress before the
            //     bytes are acknowledged; on failure those bytes never
            //     landed, so we drop back to the pre-attempt baseline.
            //   - pessimistic: the handler is contracted to only report
            //     acknowledged bytes; the bar already reflects committed
            //     state and must not go backwards (forward-only or stop).
            const isOptimistic = (this.config.progressMode ?? 'optimistic') === 'optimistic';
            if (isOptimistic && file.progress !== baselineProgress) {
                fileLogger.debug('Auto-retry: snapping progress back to the baseline (optimistic mode)', {
                    id, name: file.name, from: file.progress, to: baselineProgress
                });
                this.mutateFileState(file, { progress: baselineProgress });
            }
            if (attempt + 1 < maxAttempts) {
                const delay = (policy.delayMs ?? 1000) * Math.pow(policy.backoff ?? 2, attempt);
                fileLogger.debug('Auto-retry: scheduling the next attempt', {
                    id, name: file.name, delayMs: delay, progress: file.progress,
                    startBytes: Math.floor(file.size * (file.progress / 100))
                });
                await new Promise(r => setTimeout(r, delay));
                // Bail out cleanly if the file was paused / removed during the
                // backoff window.
                if (this.pausedIds.has(id) || !this.files.find(f => f.id === id)) {
                    fileLogger.debug('Auto-retry: aborted during the delay', {
                        id, name: file.name, reason: this.pausedIds.has(id) ? 'paused' : 'removed'
                    });
                    return;
                }
                // Auto-retry preserves `file.progress` to match the manual
                // `retryFile` path — the COMPONENT keeps the partial offset
                // and the HANDLER decides whether to continue (resume-aware,
                // e.g. tus.io HEAD then PATCH from the server's offset) or
                // reset and start fresh by calling `ctx.setProgress(0)` on its
                // first tick. This makes the auto-retry path honor the same
                // resume contract as Pause → Resume and per-row Retry, so a
                // resume-aware handler gets consistent behaviour across all
                // three recovery flows.
                fileLogger.debug('Auto-retry: starting attempt', {
                    id, name: file.name, attempt: attempt + 2, maxAttempts, progress: file.progress
                });
                return this.runUpload(id, attempt + 1);
            }
            fileLogger.debug('Auto-retry: giving up — attempts exhausted', {
                id, name: file.name, maxAttempts, progress: file.progress
            });
            file.error = msg;
            // Status flip to 'error' fires `file-status-change`; the
            // renderer's listener patches the row. The `file.error` write
            // is tied to the same status transition so no separate
            // `file-update` is needed — error-aware renderers gate on
            // status === 'error' anyway.
            this.mutateFileState(file, { status: 'error' });
        } finally {
            this.controllers.delete(id);
        }
    }

    // ========================================================================
    // FILE PROCESSING (validation + add pipeline)
    // ========================================================================

    protected async processFiles(files: File[], opts?: AddFilesOptions): Promise<void> {
        const { accepted, rejected: rejectedFiles } = this.validateBatch(files);
        let acceptedFiles = accepted;

        // User-confirmation / transform gate. Runs ONCE per batch, AFTER all
        // sync validation passes. Files don't enter the queue (no
        // `file-add`, not in `this.files`) until it answers. `false` moves
        // them to `rejectedFiles` with `code: 'cancelled'` so the consumer
        // can distinguish user-cancel from validator-reject; a `File[]`
        // replaces the batch (validated again — the gate is not re-run).
        if (acceptedFiles.length > 0 && this.config.beforeFilesAddCallback) {
            const gate = await runBeforeCallback<object, unknown>(
                this.config.beforeFilesAddCallback,
                this.ctx({ files: [...acceptedFiles], existingFiles: this.getFiles() }),
                'beforeFilesAddCallback'
            );
            if (gate.isCancelled) {
                for (const file of acceptedFiles) {
                    rejectedFiles.push({
                        file,
                        validation: {
                            valid: false,
                            error: 'Add cancelled by user',
                            code: 'cancelled'
                        }
                    });
                }
                acceptedFiles = [];
            } else if ('value' in gate && Array.isArray(gate.value)) {
                const replacement: unknown[] = gate.value;
                const replaced = this.validateBatch(replacement.filter((f): f is File => f instanceof File));
                acceptedFiles = replaced.accepted;
                rejectedFiles.push(...replaced.rejected);
            }
        }

        this.commitFiles(acceptedFiles.map(file => createFileState(file, generateFileId(), opts)), rejectedFiles);
    }

    /**
     * Run the stateless + stateful checks (count cap, per-file validation,
     * dedupe, total-size cap) over a batch against the current selection.
     */
    protected validateBatch(files: File[]): { accepted: File[]; rejected: RejectedFile[] } {
        const acceptedFiles: File[] = [];
        const rejectedFiles: RejectedFile[] = [];

        // Seed the dedupe set with the existing selection so a subsequent
        // "Add more" (or repeat drop) skips files already on the list. The
        // set also catches duplicates *within the same incoming batch*
        // (e.g. user picks the same file twice in a single dialog).
        const mode: DedupeMode = (this.config.dedupeMode ?? DEFAULT_CONFIG.dedupeMode) as DedupeMode;
        const seenKeys = new Set<string>(
            mode === 'none' ? [] : this.files.map(f => dedupeKeyFor(f.file, mode))
        );

        // Stateful caps. The running total seeds from the bytes already in
        // the selection; each accepted file is added to it so two files that
        // would each fit on their own can't both squeak in past the cap.
        // FluentUI uses the same running-total pattern.
        const maxCount = this.config.maxFileCount ?? 0;
        const maxTotal = this.config.maxTotalSize ?? 0;
        let runningCount = this.files.length;
        let runningTotal = maxTotal > 0 ? this.files.reduce((sum, f) => sum + f.size, 0) : 0;

        for (const file of files) {
            // Count cap — done first so an over-cap drop accepts what fits
            // and rejects only the overflow (vs. rejecting the whole batch).
            if (maxCount > 0 && runningCount >= maxCount) {
                rejectedFiles.push({
                    file,
                    validation: {
                        valid: false,
                        error: `Maximum ${maxCount} file${maxCount === 1 ? '' : 's'} allowed`,
                        code: 'count'
                    }
                });
                continue;
            }

            const validation = validateFilePure(file, this.config, this.getFiles(), this.contextBase);
            if (!validation.valid) {
                rejectedFiles.push({ file, validation });
                continue;
            }

            if (mode !== 'none') {
                const key = dedupeKeyFor(file, mode);
                if (seenKeys.has(key)) {
                    rejectedFiles.push({
                        file,
                        validation: {
                            valid: false,
                            error: `Duplicate file: ${file.name}`,
                            code: 'duplicate'
                        }
                    });
                    continue;
                }
                seenKeys.add(key);
            }

            // Total-size cap — last gate before accept so the running total
            // only advances for files that passed every other check.
            if (maxTotal > 0 && runningTotal + file.size > maxTotal) {
                rejectedFiles.push({
                    file,
                    validation: {
                        valid: false,
                        error: `Total size would exceed ${formatFileSize(maxTotal)}`,
                        code: 'size'
                    }
                });
                continue;
            }

            runningCount++;
            runningTotal += file.size;
            acceptedFiles.push(file);
        }

        return { accepted: acceptedFiles, rejected: rejectedFiles };
    }

    /** Commit an accepted batch: state, previews, events, re-render, auto-upload. */
    protected commitFiles(acceptedFiles: FileState[], rejectedFiles: RejectedFile[]): void {
        // Add accepted files
        if (acceptedFiles.length > 0) {
            // In single mode, replace existing files
            if (!this.config.isMultipleEnabled) {
                this.files = [acceptedFiles[0]];
            } else {
                this.files.push(...acceptedFiles);
            }

            fileLogger.debug('Files added', { count: acceptedFiles.length });

            // Generate previews for images
            acceptedFiles.forEach(fileState => {
                if (isImageFile(fileState.file)) {
                    void this.generatePreview(fileState);
                }
            });

            // Emit events
            acceptedFiles.forEach(file => this.emitAddEvent(file));
            this.emitChangeEvent();
        }

        // Handle rejected files
        if (rejectedFiles.length > 0) {
            fileLogger.warn('Files rejected', { count: rejectedFiles.length, rejectedFiles });
            this.emitRejectEvent(rejectedFiles);
        }

        // Re-render the row set. Per-file events were already reported
        // above (`file-add` for each accepted file, `change` from
        // `emitChangeEvent`); the renderer's `onEngineEvent` picks up the
        // summary / selector badge / overall-progress refresh AND the
        // open-popover refresh.
        this.renderFileList();

        // Auto-upload kicks in once the new files are committed to state, the
        // UI has reflected the additions, and the file-add event has fired.
        // The worker pool's re-entrancy guard collapses overlapping calls.
        // Mode B: a per-file handler stamped via opts.uploadFileCallback also
        // qualifies — uploadAll's filter picks the right handler per file.
        const hasAnyHandler =
            !!this.config.uploadFileCallback ||
            acceptedFiles.some(f => !!f.uploadFileCallback);
        if (
            acceptedFiles.length > 0 &&
            hasAnyHandler &&
            this.config.isAutoUploadEnabled !== false
        ) {
            void this.uploadAll();
        }
    }

    protected async generatePreview(fileState: FileState): Promise<void> {
        try {
            const previewUrl = await createImagePreview(fileState.file);
            fileState.previewUrl = previewUrl;
            fileLogger.debug('Preview generated', { id: fileState.id, name: fileState.name });

            // Signal the previewUrl write via `file-update` so the
            // renderer's hook patches the row (grid mode swaps the
            // placeholder for the data URL; other modes are no-op
            // visually but still keep the DOM in sync with FileState).
            this.emitFileUpdated(fileState);
        } catch (error) {
            fileLogger.warn('Failed to generate preview', { id: fileState.id, error });
        }
    }

    // ========================================================================
    // REORDER TIMERS
    // ========================================================================

    /**
     * Return a snapshot of `this.files` ordered for rendering. When
     * `isReorderCompletedEnabled` is on, reorder-eligible files (status
     * 'complete' AND no pending reorder timer) slide to the end via a
     * stable sort (so within each bucket the original add order is
     * preserved). Used by the popover render path and the inline list's
     * cap-render slice; the inline list itself uses CSS `order` for
     * already-rendered rows.
     *
     * Eligibility (not raw `status === 'complete'`) means the popover
     * sort respects the same `reorderCompletedDelay` window the inline
     * CSS rule does — files mid-delay stay in the unresolved bucket.
     */
    getOrderedFiles(): FileState[] {
        if (!this.config.isReorderCompletedEnabled) return this.files;
        return this.files
            .map((f, i) => ({ f, i, complete: this.isReorderEligible(f) ? 1 : 0 }))
            .sort((a, b) => (a.complete - b.complete) || (a.i - b.i))
            .map(x => x.f);
    }

    /** A file is reorder-eligible when its status is `complete` AND no
     *  delay timer is pending for it. Used by the popover sort and by
     *  the inline render functions to stamp `data-reorder-bucket`. */
    isReorderEligible(file: FileState): boolean {
        if (!this.config.isReorderCompletedEnabled) return false;
        if (file.status !== 'complete') return false;
        return !this.reorderTimers.has(file.id);
    }

    /**
     * Schedule (or cancel) the delayed reorder for a file. Called from
     * `patchFileRow` whenever a row's status crosses the complete
     * boundary, and from teardown paths (`removeFile`, `retryFile`,
     * `clear`) to clean up.
     *
     * The visible row's `data-reorder-bucket` is the single source of
     * truth for CSS — set when the timer fires, cleared when the file
     * un-completes. The id-set `reorderEligibleIds` mirrors this for the
     * non-DOM render paths (popover sort, cap re-render).
     */
    protected scheduleReorder(id: string, becomingComplete: boolean): void {
        // Always cancel any pending timer first; the caller's intent
        // overrides whatever the previous transition queued.
        const pending = this.reorderTimers.get(id);
        if (pending !== undefined) {
            clearTimeout(pending);
            this.reorderTimers.delete(id);
        }

        if (!this.config.isReorderCompletedEnabled) return;

        const apply = () => {
            // The file may have been removed during the timer wait.
            const stillExists = this.files.some(f => f.id === id);
            if (!stillExists) return;

            // Renderer hook does the DOM-side bucket flip, popover
            // re-sort, and capped-list re-render. Phase A · Step 2 will
            // turn this into an event the renderer subscribes to.
            this.applyReorderToRenderer(id, becomingComplete);
        };

        const delay = Math.max(0, this.config.reorderCompletedDelay ?? 1500);
        if (delay === 0) {
            // Microtask so cleanup hooks (remove / retry called in the
            // same tick) still get a chance to cancel.
            queueMicrotask(apply);
        } else {
            const handle = window.setTimeout(() => {
                this.reorderTimers.delete(id);
                apply();
            }, delay);
            this.reorderTimers.set(id, handle);
        }
    }

    /** Clear all pending reorder timers. Called from destroy / clear;
     *  individual cancellation goes through scheduleReorder(id, false). */
    protected clearAllReorderTimers(): void {
        for (const handle of this.reorderTimers.values()) clearTimeout(handle);
        this.reorderTimers.clear();
    }

    // ========================================================================
    // OVERALL PROGRESS (data only — NOT markup; renderer owns the strip)
    // ========================================================================

    /**
     * Aggregate upload stats across the current selection. Mirrors FluentUI
     * InputFile's overallProgress: completed files count for their full size,
     * uploading files contribute size × progress%. `hasActivity` is the gate
     * for showing the strip — pure pending selections (nothing uploaded yet)
     * keep the strip hidden so it doesn't appear at 0% before any upload
     * starts.
     *
     * Public so satellite surfaces (`<web-dropzone-progress>`) can read the
     * same aggregate without duplicating the calculation.
     */
    getOverallProgress(): OverallProgress {
        let uploadedBytes = 0;
        let totalBytes = 0;
        let completedCount = 0;
        let failedCount = 0;
        let uploadingCount = 0;
        let pausedCount = 0;

        for (const f of this.files) {
            totalBytes += f.size;
            if (f.status === 'complete') {
                uploadedBytes += f.size;
                completedCount++;
            } else {
                // Every other state contributes whatever progress was last
                // reported. This keeps the overall bar smooth across status
                // transitions — particularly during resume where a file
                // momentarily goes paused → pending → uploading. If only
                // some of those states counted, the overall bar would animate
                // down then back up and the user sees a "jump back".
                uploadedBytes += Math.floor(f.size * (f.progress / 100));
                if (f.status === 'uploading') uploadingCount++;
                else if (f.status === 'paused') pausedCount++;
                else if (f.status === 'error' || f.status === 'cancelled') {
                    // Cancelled rolls into "failed" for the overall readout —
                    // both need user intervention (retry) to ever finish.
                    failedCount++;
                }
                // 'pending' contributes only to uploadedBytes — no dedicated
                // counter, since pending isn't a "state the user acts on".
            }
        }

        const percent = totalBytes === 0
            ? 0
            : Math.min(100, (uploadedBytes / totalBytes) * 100);
        const hasActivity =
            uploadingCount > 0 || completedCount > 0 || failedCount > 0 || pausedCount > 0;

        // Aggregate-state priority (drives the overall bar's color):
        //   error > uploading > paused > complete
        // Errors override everything else because a hidden errored file
        // (e.g. a badge off-screen) would otherwise blend into a partial
        // bar and the user wouldn't notice why the strip never hits 100%.
        // Active uploads win over paused so the bar reads as "live" while
        // anything's still moving; paused wins over complete so a "half
        // done, half paused" selection signals action-needed rather than
        // a happy in-progress state.
        const aggregateStatus: 'uploading' | 'paused' | 'error' | 'complete' =
            failedCount > 0          ? 'error'
          : uploadingCount > 0       ? 'uploading'
          : pausedCount > 0          ? 'paused'
          : completedCount === this.files.length && this.files.length > 0 ? 'complete'
          : 'uploading';

        return { uploadedBytes, totalBytes, completedCount, failedCount, uploadingCount, pausedCount, percent, hasActivity, aggregateStatus };
    }

    // ========================================================================
    // EVENT EMISSION
    // ========================================================================

    protected emitAddEvent(file: FileState): void {
        this.notify('file-add', { file });
        this.markFilesChanged(file.id);
    }

    protected emitRemoveEvent(file: FileState): void {
        this.notify('file-remove', { file });
        this.markFilesChanged(file.id);
    }

    /**
     * Mark a file id as dirty and schedule the coalesced
     * `files-change` event for the next animation frame. Multiple
     * calls within the same frame collapse into a single dispatch
     * with the union of dirty ids. The dispatch carries the current
     * `getFiles()` snapshot — reactive consumers diff against their
     * own last-seen list.
     */
    protected markFilesChanged(id: string): void {
        this.dirtyFileIds.add(id);
        if (this.filesChangedRafHandle !== null) return;
        this.filesChangedRafHandle = requestAnimationFrame(() => {
            this.filesChangedRafHandle = null;
            const changedIds = Array.from(this.dirtyFileIds);
            this.dirtyFileIds.clear();
            this.notify('files-change', { changedIds, files: this.getFiles() });
        });
    }

    protected emitChangeEvent(): void {
        this.notify('change', { files: this.getFiles() });
    }

    /**
     * Internal re-render signal fired by `updateConfig` (a config/attribute
     * change), kept distinct from the public `change` (a file-selection
     * change). Renderers and satellites listen to it to refresh their surfaces
     * against the rebuilt DOM; external consumers listening to `change` are not
     * disturbed — which is what prevents a config-mutating `change` handler from
     * looping back into `updateConfig`. INTERNAL — not a public event: it is
     * dispatched (not bubbling, not composed) on the host element, where the
     * satellites bound to this store listen.
     */
    protected emitConfigChangedEvent(): void {
        this.onConfigApplied();
        dispatch(this.contextElement, 'dz-config-changed', undefined, { bubbles: false });
    }

    protected emitRejectEvent(rejectedFiles: RejectedFile[]): void {
        this.notify('files-reject', { rejectedFiles });
    }

    protected emitRetryEvent(file: FileState): void {
        this.notify('file-retry', { file });
    }

    protected emitUploadedEvent(file: FileState): void {
        this.notify('file-upload-complete', { file });
    }

    protected emitDeleteEvent(file: FileState): void {
        this.notify('file-delete', { file });
    }

    /**
     * Substrate event for satellite renderers (`<web-dropzone-list>`,
     * `<web-dropzone-indicator>`, …). Fires whenever a file's progress
     * value changes — including the implicit 0→100 jump on `setFileStatus`
     * → 'complete'. See ARCHITECTURE.md.
     */
    protected emitFileProgress(file: FileState): void {
        this.notify('file-progress', {
            id: file.id, progress: file.progress, status: file.status, file
        });
        this.markFilesChanged(file.id);
    }

    /**
     * Substrate event — fires whenever a file's status transitions.
     * `prevStatus !== nextStatus` is guaranteed (no-op mutations are
     * suppressed in `mutateFileState`).
     */
    protected emitFileStatusChanged(
        file: FileState,
        prevStatus: FileState['status'],
        nextStatus: FileState['status']
    ): void {
        this.notify('file-status-change', {
            id: file.id, prevStatus, nextStatus, file
        });
        this.markFilesChanged(file.id);
    }

    /**
     * Substrate event — fires whenever a field on a FileState OTHER than
     * `progress` or `status` changes. Catch-all post-mutation refresh
     * signal for the renderer (`previewUrl` arriving from
     * `generatePreview`, `metadata` / `downloadUrl` / `name` returned
     * from a successful upload handler, etc.).
     *
     * Progress and status have their own dedicated events
     * (`file-progress`, `file-status-change`) so subscribers can opt
     * into the granularity they care about.
     */
    protected emitFileUpdated(file: FileState): void {
        this.notify('file-update', { file });
        this.markFilesChanged(file.id);
    }

    // ========================================================================
    // PERSISTED UI STATE
    // ========================================================================

    /** Resolve the storage namespace key. Persistence is disabled (everything
     *  becomes a no-op) when no storage-key is configured. */
    protected getStorageKey(): string | null {
        const k = this.config.storageKey;
        return (typeof k === 'string' && k.length > 0) ? k : null;
    }

    /** localStorage key paired with the configured storage-key. */
    protected localStorageKeyFor(storageKey: string): string {
        return `dz-state:${storageKey}`;
    }

    /**
     * Load persisted state. Prefers `loadStateCallback` when set; otherwise
     * falls back to localStorage. Returns null when no state is found OR
     * when persistence is disabled. Tolerant of corruption (JSON parse
     * errors) and missing globals (SSR / sandboxed contexts).
     */
    protected async loadDropzoneState(): Promise<DropzoneState | null> {
        const key = this.getStorageKey();
        if (!key) return null;

        if (this.config.loadStateCallback) {
            try {
                const result = await this.config.loadStateCallback(this.ctx({ key }));
                return result ?? null;
            } catch (err) {
                uiLogger.warn('loadStateCallback threw, ignoring', err);
                return null;
            }
        }

        try {
            const raw = globalThis.localStorage?.getItem(this.localStorageKeyFor(key));
            return raw ? JSON.parse(raw) : null;
        } catch {
            // localStorage may be unavailable (private mode, SSR) or the
            // serialized value may be corrupted. Either way, start fresh.
            return null;
        }
    }

    /**
     * Merge `partial` into the existing state and write it back through
     * the configured sink (callback or localStorage). The full snapshot is
     * always passed to `persistStateCallback` — implementations can write
     * the full object or diff against their own prior view as they prefer.
     */
    protected async saveDropzoneState(partial: Partial<DropzoneState>): Promise<void> {
        const key = this.getStorageKey();
        if (!key) return;

        const current = (await this.loadDropzoneState()) ?? {};
        const next = { ...current, ...partial };

        if (this.config.persistStateCallback) {
            try {
                await this.config.persistStateCallback(this.ctx({ key, state: next }));
            } catch (err) {
                uiLogger.warn('persistStateCallback threw, falling back to in-memory', err);
            }
            return;
        }

        try {
            globalThis.localStorage?.setItem(
                this.localStorageKeyFor(key),
                JSON.stringify(next)
            );
        } catch {
            // localStorage write failures (quota, private mode) are
            // swallowed — the UI keeps working with in-memory state.
        }
    }
}
