/**
 * Internal link from a `<web-dropzone>` to the controller its satellites
 * bind through. Not public API.
 *
 * Same `DropzoneController` shape as the public `el.controller`, but it does
 * NOT flush the element's pending input writes before each call. Satellites
 * read the store while it is emitting (a `change` listener re-rendering a
 * picker); a flush there would apply a pending config change mid-dispatch,
 * re-rendering the store — and tearing down the very satellite that is
 * reading. Consumers keep the flushing `el.controller` (set-then-call works).
 *
 * A dedicated zero-import module so `satellite-base.ts` can read it without
 * importing `web-component.ts` at runtime (satellites must register first —
 * see `index.ts`).
 */

import type { DropzoneController, FileState } from '@keenmate/web-dropzone-core';

const links = new WeakMap<HTMLElement, DropzoneController>();

/** Called by `<web-dropzone>` once, at construction. */
export function linkStoreController(storeEl: HTMLElement, controller: DropzoneController): void {
    links.set(storeEl, controller);
}

/** The satellite-side controller of a store element (undefined before it upgraded). */
export function storeControllerOf(storeEl: HTMLElement): DropzoneController | undefined {
    return links.get(storeEl);
}

const reorderLinks = new WeakMap<HTMLElement, (file: FileState) => boolean>();

/**
 * Called by `<web-dropzone>` once, at construction: how a satellite list asks
 * whether a file's row sits in the "complete" reorder bucket (`should-sink-completed`
 * on, status complete, `reorder-completed-delay` elapsed). Internal - the
 * public controller doesn't expose reorder timing.
 */
export function linkStoreReorder(storeEl: HTMLElement, isReorderEligible: (file: FileState) => boolean): void {
    reorderLinks.set(storeEl, isReorderEligible);
}

/** Whether `file`'s row belongs in the store's "complete" reorder bucket. */
export function isStoreFileReorderEligible(storeEl: HTMLElement, file: FileState): boolean {
    return reorderLinks.get(storeEl)?.(file) ?? false;
}
