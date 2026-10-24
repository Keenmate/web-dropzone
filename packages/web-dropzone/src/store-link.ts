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

import type { DropzoneController } from '@keenmate/web-dropzone-core';

const links = new WeakMap<HTMLElement, DropzoneController>();

/** Called by `<web-dropzone>` once, at construction. */
export function linkStoreController(storeEl: HTMLElement, controller: DropzoneController): void {
    links.set(storeEl, controller);
}

/** The satellite-side controller of a store element (undefined before it upgraded). */
export function storeControllerOf(storeEl: HTMLElement): DropzoneController | undefined {
    return links.get(storeEl);
}
