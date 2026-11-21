/**
 * Shared structural callback contract for any "status surface" in the
 * package — the floating indicator chip, the rolling list appearance, and
 * any future surface that shows "what's the current file doing + what's the
 * overall queue doing".
 *
 * Three callbacks per surface, all sharing the `StatusSurfaceCallback`
 * signature (defined in `core/store-api.ts` so consumer-facing config
 * keys like `renderRollingBodyCallback` can reference it without dragging
 * the renderer back into core):
 *
 *   - **body**     — outer wrapper / shell. Decides whether the surface is
 *                    visible at all (return `false` to hide), and either
 *                    composes its own DOM around the other parts or yields
 *                    to the library's polished default (return `null`).
 *   - **fileInfo** — the part that identifies the focal file: name, icon,
 *                    size, status. Useful for "Uploading xyz.zip" templates.
 *                    No-op when there's no current file.
 *   - **progress** — per-file progress + overall progress + state.
 *                    The args carry both slices because some templates
 *                    want to show them side-by-side
 *                    ("xyz.zip 47% — 3 / 10 done").
 *
 * Each surface exposes the three as JS-only properties (no HTML attribute
 * equivalent — they're functions). Polished out-of-the-box rendering is the
 * library calling its own defaults through the same hooks — every part is
 * replaceable piecemeal without rebuilding the whole surface.
 *
 * Return-value semantics — core `renderSlot` (SPEC §12.35), the same for
 * every `render*Callback` of every Keenmate component:
 *   - `string`                → HTML (skipped when equal to the previous string)
 *   - `Node`                  → mounted (skipped when it is already the only child)
 *   - `null`  / `undefined`   → the library default
 *   - `false`                 → hidden (or, for body, the whole surface)
 *
 * The skip rules are what make this safe to call at progress-tick frequency.
 * Cache your spinner / element outside the callback and return the same
 * instance each tick — the surface will skip the DOM swap.
 *
 * This module owns the IMPLEMENTATION (compute / pick / build helpers, the
 * slot helpers over `renderSlot`, and the rolling renderer shared by
 * `<web-dropzone>` and `<web-dropzone-list>`). The PUBLIC TYPES
 * (`StatusSurfaceArgs`, `StatusSurfaceCallback`,
 * `StatusSurfaceResult`, `StatusAggregate`) live in `core/store-api.ts` so
 * `core/types.ts`'s `DropzoneConfig` can reference them without crossing
 * the eventual package boundary back into the renderer.
 */

import { animateOut, renderSlot, withComponentContext, type SlotKind } from '@keenmate/web-components-core';
import { escapeHtml } from '@keenmate/web-dropzone-core';
import type { FileState, DropzoneController, LabelFn } from '@keenmate/web-dropzone-core';
import type {
    StatusAggregate,
    StatusSurfaceArgs,
    StatusSurfaceCallback,
    StatusSurfaceResult
} from '@keenmate/web-dropzone-core';
import { listProgressInner } from './row-templates';
import { syncRowButtonsDisabled } from './row-patching';

// Re-export the public surface types so existing renderer-internal imports
// keep working — they import these symbols from `./status-surface` today.
export type {
    StatusAggregate,
    StatusSurfaceArgs,
    StatusSurfaceResult,
    StatusSurfaceCallback
} from '@keenmate/web-dropzone-core';

/**
 * Computes a `StatusAggregate` from a file list. The aggregate is cheap
 * (O(N)) but every status surface uses the same shape, so it lives here as
 * a shared helper.
 */
export function computeStatusAggregate(files: ReadonlyArray<FileState>): StatusAggregate {
    const agg: StatusAggregate = {
        total: files.length,
        uploading: 0,
        paused: 0,
        pending: 0,
        complete: 0,
        error: 0,
        cancelled: 0,
        overallStatus: 'idle'
    };
    if (files.length === 0) return agg;
    for (const f of files) {
        if (f.status === 'uploading') agg.uploading++;
        else if (f.status === 'paused') agg.paused++;
        else if (f.status === 'pending') agg.pending++;
        else if (f.status === 'complete') agg.complete++;
        else if (f.status === 'error') agg.error++;
        else if (f.status === 'cancelled') agg.cancelled++;
    }
    if (agg.error > 0) agg.overallStatus = 'error';
    else if (agg.uploading > 0) agg.overallStatus = 'uploading';
    else if (agg.paused > 0) agg.overallStatus = 'paused';
    else if (agg.pending > 0) agg.overallStatus = 'pending';
    else if (agg.complete > 0) agg.overallStatus = 'complete';
    return agg;
}

/**
 * Computes byte-weighted overall percent across the queue. Kept separate
 * from `computeStatusAggregate` so surfaces that don't need it (badges,
 * grid) can skip the pass over file.size.
 */
export function computeOverallPercent(files: ReadonlyArray<FileState>): number {
    if (files.length === 0) return 0;
    let totalBytes = 0;
    let doneBytes = 0;
    for (const f of files) {
        totalBytes += f.size;
        doneBytes += f.size * (f.progress / 100);
    }
    return totalBytes > 0
        ? Math.min(100, Math.round((doneBytes / totalBytes) * 100))
        : 0;
}

/**
 * Picks the focal file for a status surface. Priority: first uploading file
 * (the one actively transferring), else last pending (next up), else last
 * non-complete (paused/error), else last complete. Returns undefined for
 * an empty queue.
 */
export function pickCurrentFile(files: ReadonlyArray<FileState>): FileState | undefined {
    if (files.length === 0) return undefined;
    const uploading = files.find(f => f.status === 'uploading' || f.status === 'cancelling');
    if (uploading) return uploading;
    const pending = files.find(f => f.status === 'pending');
    if (pending) return pending;
    const stuck = files.find(f =>
        f.status === 'paused' || f.status === 'error' || f.status === 'cancelled'
    );
    if (stuck) return stuck;
    return files[files.length - 1];
}

/**
 * Builds a fully-populated `StatusSurfaceArgs` from a file list + the store's
 * `controller` / `element` (attached non-enumerably — the component context).
 * Used by every surface to standardize the data passed to callbacks.
 */
export function buildStatusSurfaceArgs(
    files: ReadonlyArray<FileState>,
    controller: DropzoneController,
    element: HTMLElement
): StatusSurfaceArgs {
    const aggregate = computeStatusAggregate(files);
    const overallPercent = computeOverallPercent(files);
    const currentFile = pickCurrentFile(files);
    return withComponentContext({
        currentFile,
        currentFilePercent: currentFile?.progress,
        currentFileStatus: currentFile?.status,
        aggregate,
        overallPercent,
        overallStatus: aggregate.overallStatus,
        files
    }, controller, element);
}

/** Last default string written per slot — skips an unchanged default (progress ticks). */
const defaultHtml = new WeakMap<HTMLElement, string>();

/**
 * Render one surface slot through core `renderSlot`: the callback's result
 * (string = HTML, Node = mounted, `null` / `undefined` = `renderDefaultContent()`,
 * `false` = hidden). The default is a string (skipped when unchanged) or a
 * Node (skipped when already mounted — a cached loader keeps animating).
 * Without `renderDefaultContent` a default result leaves the slot as it is.
 */
export function applySurfaceSlot(
    el: HTMLElement,
    result: StatusSurfaceResult | (() => StatusSurfaceResult),
    renderDefaultContent?: () => string | Node
): SlotKind {
    const kind = renderSlot(el, result, {
        renderDefault: (c) => {
            if (!renderDefaultContent) return;
            const v = renderDefaultContent();
            if (typeof v === 'string') {
                if (defaultHtml.get(c) !== v) { c.innerHTML = v; defaultHtml.set(c, v); }
            } else {
                defaultHtml.delete(c);
                if (c.firstChild !== v || c.childNodes.length !== 1) c.replaceChildren(v);
            }
        },
    });
    if (kind !== 'default') defaultHtml.delete(el);
    return kind;
}

/** What each restorable slot / rolling body showed last (absent = the template's own default). */
const lastKinds = new WeakMap<HTMLElement, SlotKind>();

/**
 * A slot whose default the row template already drew: `null` / `undefined`
 * leaves it alone, unless a custom / hidden result replaced it — then
 * `restore()` writes the default back.
 */
function applyRestorableSlot(el: HTMLElement, result: () => StatusSurfaceResult, restore: () => string): void {
    const prev = lastKinds.get(el);
    const kind = renderSlot(el, result, {
        renderDefault: (c) => { if (prev !== undefined && prev !== 'default') c.innerHTML = restore(); },
    });
    lastKinds.set(el, kind);
}

/** Inputs of {@link renderRollingSurface} — what differs between the store and the list satellite. */
export interface RollingSurfaceOptions {
    args: StatusSurfaceArgs;
    /** The file in the front slot (each caller's own pick); none → the block is emptied. */
    front: FileState | null | undefined;
    rotation: string;
    bodyCallback?: StatusSurfaceCallback | null;
    fileInfoCallback?: StatusSurfaceCallback | null;
    progressCallback?: StatusSurfaceCallback | null;
    /** The front row's HTML (a list row). */
    renderRow: (file: FileState) => string;
    label?: LabelFn;
    /** The store's `locale` — the restored default progress percent. */
    locale?: string | null;
    isDisabled: boolean;
    /** Create / refresh the queue badge inside the block. */
    updateQueueButton: (wrapper: HTMLElement, count: number, show: boolean) => void;
    /** A fresh front row was mounted (bind its buttons). */
    onRowMounted?: (row: HTMLElement) => void;
}

/**
 * The rolling list appearance — ONE renderer for `<web-dropzone>` and
 * `<web-dropzone-list>`. A stable block (the popover anchor) holds the front
 * file's row; a new front overlaps the outgoing row in the same grid cell so
 * the rotation keyframes play together; the queue badge floats in a corner.
 *
 * `renderRollingBodyCallback` owns the whole block (core `renderSlot`: string
 * HTML, Node mounted, `null` / `undefined` → this default, `false` → hidden);
 * the file-info / progress callbacks replace the row's `.dz__file-item-name` /
 * `.dz__file-item-progress` (`null` keeps the row's own default).
 */
export function renderRollingSurface(wrapper: HTMLElement, o: RollingSurfaceOptions): void {
    wrapper.dataset.rotation = o.rotation;
    const prev = lastKinds.get(wrapper);
    const body = o.bodyCallback;
    const kind = renderSlot(wrapper, body ? () => body(o.args) : null, {
        renderDefault: (w) => {
            // Back from a custom body: start the default block afresh.
            if (prev === 'custom') w.replaceChildren();
            renderRollingDefault(w, o);
        },
    });
    lastKinds.set(wrapper, kind);
}

function renderRollingDefault(wrapper: HTMLElement, o: RollingSurfaceOptions): void {
    const front = o.front;
    if (!front) {
        wrapper.replaceChildren();
        return;
    }
    const queueCount = o.args.files.length;
    const showQueueBtn = queueCount > 1;

    // The "settled" current slot — not one mid-rotation-out: what decides
    // whether the front file actually changed.
    const previousCurrent = wrapper.querySelector<HTMLElement>(
        '.dz__rolling-current:not(.dz__rolling-current--leaving)'
    );
    if (previousCurrent && previousCurrent.dataset.frontId === front.id) {
        // Same front: per-row ticks land via the row patchers; refresh the
        // slot callbacks (a status change re-renders them) + the badge.
        applyRollingSlots(previousCurrent, o, front);
        syncRowButtonsDisabled(previousCurrent, front, o.isDisabled);
        o.updateQueueButton(wrapper, queueCount, showQueueBtn);
        return;
    }

    const newCurrentEl = document.createElement('div');
    newCurrentEl.className = 'dz__rolling-current';
    newCurrentEl.dataset.frontId = front.id;
    newCurrentEl.innerHTML = o.renderRow(front);
    applyRollingSlots(newCurrentEl, o, front);

    if (previousCurrent && o.rotation !== 'slide-in') {
        // True rotation — the outgoing slot stays mounted so its keyframe
        // (translateX/Y out) plays in parallel with the incoming one; removed
        // when it ends (core animateOut — at once with motion off / reduced).
        wrapper.insertBefore(newCurrentEl, previousCurrent);
        const toRemove = previousCurrent;
        animateOut([toRemove], { className: 'dz__rolling-current--leaving', onDone: () => toRemove.remove() });
    } else if (previousCurrent) {
        // slide-in: snap-replace; the new slot's keyframe is the only motion.
        previousCurrent.replaceWith(newCurrentEl);
    } else {
        wrapper.insertBefore(newCurrentEl, wrapper.firstChild);
    }
    o.onRowMounted?.(newCurrentEl);
    o.updateQueueButton(wrapper, queueCount, showQueueBtn);
}

/** The rolling file-info + progress callbacks into the front row's slots (only when set). */
function applyRollingSlots(currentEl: HTMLElement, o: RollingSurfaceOptions, front: FileState): void {
    const fileInfo = o.fileInfoCallback;
    const fileInfoSlot = currentEl.querySelector<HTMLElement>('.dz__file-item-name');
    if (fileInfo && fileInfoSlot) {
        applyRestorableSlot(fileInfoSlot, () => fileInfo(o.args), () => escapeHtml(front.name));
    }
    const progress = o.progressCallback;
    const progressSlot = currentEl.querySelector<HTMLElement>('.dz__file-item-progress');
    if (progress && progressSlot) {
        applyRestorableSlot(progressSlot, () => progress(o.args), () => listProgressInner(front, o.label, o.locale));
    }
}
