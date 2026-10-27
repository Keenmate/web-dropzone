/**
 * Shared helpers for satellite renderers — `<web-dropzone-picker>`,
 * `<web-dropzone-list>`, `<web-dropzone-indicator>`. See ARCHITECTURE.md for
 * the store + satellite-renderers topology.
 *
 * Each satellite binds to exactly one `<web-dropzone>` store via its
 * `for="<store-id>"` attribute. The resolution race (satellite may upgrade
 * before, after, or alongside the store's `connectedCallback`) is the
 * trickiest part of the wiring; these helpers centralize it.
 */

import type { DropzoneElement } from './web-component';
import type { DropzoneController, DropzoneContext } from '@keenmate/web-dropzone-core';
import { dispatch, observeThemeContext, withComponentContext, THEME_CONTEXT_ATTRIBUTE, THEME_SOURCE_ATTRIBUTE } from '@keenmate/web-components-core';
import { storeControllerOf, STORE_BUILD_EVENT } from './store-link';

/**
 * Look up the `<web-dropzone>` element a satellite binds to via its `for=`
 * attribute. Returns null if the element is missing or isn't a
 * `<web-dropzone>` (e.g. `for="some-div"`). Does NOT wait for the store to
 * be upgraded or initialized — callers should pair this with
 * `whenStoreReady`, which handles both races.
 *
 * Note: we check by `tagName` rather than duck-typing on `controller` because
 * the store custom element may not have upgraded yet (satellites can
 * register before `<web-dropzone>` does — see index.ts).
 */
export function resolveStoreElement(forId: string | null): DropzoneElement | null {
    if (!forId) return null;
    const el = document.getElementById(forId);
    if (!el) return null;
    if (el.tagName !== 'WEB-DROPZONE') return null;
    return el as DropzoneElement;
}

/**
 * The store's satellite-side controller once the store is built (`isReady`),
 * else undefined. It is the non-flushing twin of `storeEl.controller` (see
 * store-link.ts) — undefined until the element has upgraded.
 */
function readyController(storeEl: DropzoneElement): DropzoneController | undefined {
    const controller = storeControllerOf(storeEl);
    return controller?.isReady ? controller : undefined;
}

/**
 * Resolve a store's controller (the satellite-side twin of `storeEl.controller`), waiting if the
 * store hasn't upgraded or built yet. Calls `onResolved` exactly once.
 * Returns a teardown function that cancels the wait if the satellite is
 * disconnected before resolution.
 *
 * Race handling: a satellite can connect before the store does — either
 * because the store hasn't upgraded yet (custom element registration
 * order) or because its build hasn't run yet. We listen for the store's
 * internal build signal (`STORE_BUILD_EVENT`, every build — core's public
 * `ready` fires only once per element) and re-check then. The listener is attached even on
 * the un-upgraded element — `addEventListener` is inherited from
 * `HTMLElement`, so the upgrade preserves it.
 *
 * The controller delegates to the store's CURRENT engine, so a satellite
 * keeps working across store rebuilds (mode flip, DOM move).
 */
export function whenStoreReady(
    storeEl: DropzoneElement,
    onResolved: (store: DropzoneController) => void
): () => void {
    const immediate = readyController(storeEl);
    if (immediate) {
        onResolved(immediate);
        return () => { /* nothing to tear down */ };
    }
    const handler = () => {
        const ready = readyController(storeEl);
        if (ready) {
            storeEl.removeEventListener(STORE_BUILD_EVENT, handler);
            onResolved(ready);
        }
    };
    storeEl.addEventListener(STORE_BUILD_EVENT, handler);
    return () => storeEl.removeEventListener(STORE_BUILD_EVENT, handler);
}

/**
 * A context prototype for a store: `controller` / `element` as getters, so
 * a ctx built with `Object.create(base)` inherits them non-enumerably (the
 * per-row icon callback ctx in the list satellite).
 */
export function createStoreContextBase(storeEl: DropzoneElement): DropzoneContext {
    return Object.create(Object.prototype, {
        controller: { get: () => storeEl.controller },
        element: { get: () => storeEl }
    }) as DropzoneContext;
}

/**
 * Fire a satellite event (SPEC §12.5): bubbles, NOT composed, dispatched on
 * the satellite; the detail carries the bound store's `controller` /
 * `element` (non-enumerable).
 */
export function dispatchSatelliteEvent(
    satellite: HTMLElement,
    storeEl: DropzoneElement | null,
    name: string,
    detail: object = {}
): boolean {
    const payload = storeEl ? withComponentContext(detail, storeEl.controller, storeEl as HTMLElement) : detail;
    return dispatch(satellite, name, payload);
}

/**
 * Subscribe to one or more events on the store element. Returns a teardown
 * function that removes every listener. Each handler receives the live
 * CustomEvent so satellites can read `event.detail` directly.
 *
 * Events are dispatched on the store element itself (bubbling, not
 * composed), so listening there works from any shadow root.
 */
export function subscribeStoreEvents(
    storeEl: DropzoneElement,
    handlers: Record<string, (event: Event) => void>
): () => void {
    const entries = Object.entries(handlers);
    for (const [type, fn] of entries) {
        storeEl.addEventListener(type, fn);
    }
    return () => {
        for (const [type, fn] of entries) {
            storeEl.removeEventListener(type, fn);
        }
    };
}

/**
 * Read an HTML attribute and validate it against a closed set of allowed
 * values, returning the typed value or a fallback. Centralizes the
 * `attribute → enum` pattern used by every satellite for things like
 * `selector-appearance`, `list-appearance`, `position`, `drawer`.
 */
export function resolveEnumAttribute<T extends string>(
    el: HTMLElement,
    attr: string,
    allowed: readonly T[],
    fallback: T
): T {
    const raw = el.getAttribute(attr);
    return (allowed as readonly string[]).includes(raw ?? '')
        ? (raw as T)
        : fallback;
}

/**
 * Build a microtask-coalesced scheduler around `fn`. Multiple calls within
 * the same task collapse into a single deferred invocation; the next call
 * after the microtask flushes schedules a fresh one. Used by satellites to
 * debounce per-event refreshes so a burst of `file-progress` / `change` /
 * `file-status-change` events in one frame results in exactly one render.
 */
export function createMicrotaskScheduler(fn: () => void): () => void {
    let scheduled = false;
    return () => {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(() => {
            scheduled = false;
            fn();
        });
    };
}

/**
 * Standard "the satellite couldn't find its store" warning. Every satellite
 * needs to emit the same diagnostic with its own tag — passing the satellite's
 * tag name (`web-dropzone-picker`, `web-dropzone-list`, …) is enough.
 */
export function warnStoreMissing(elementName: string, forId: string | null): void {
    // eslint-disable-next-line no-console
    console.warn(
        `<${elementName} for="${forId ?? ''}"> — store not found. ` +
        `Make sure a <web-dropzone id="${forId ?? ''}"> exists on the page.`
    );
}

/**
 * SSR-safe HTMLElement base — the satellite class extends this so the
 * module can still be imported in a Node test runner without crashing
 * on `class extends undefined`. Matches the pattern every satellite file
 * uses locally; centralizing means subclasses don't need their own copy.
 */
const SatelliteBaseElement = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;

/**
 * Base class for `<web-dropzone-picker>`, `<web-dropzone-list>`,
 * `<web-dropzone-indicator>`, `<web-dropzone-progress>`. Owns the
 * connection lifecycle (`connectedCallback` / `disconnectedCallback` /
 * `bindToStore` / `teardownStoreBinding`) so the race-resolution logic
 * lives in one place and can be tested once — subclasses provide just
 * their event subscription + first-render hooks.
 *
 * Two abstract members:
 *  - `attachStoreSubscriptions(storeEl, store)` — wire up event listeners,
 *    return the cleanup function. Called exactly once per resolved store.
 *  - `onStoreReady(storeEl, store)` — fire the first render + any one-time
 *    bind work (e.g. mounting an embedded satellite).
 *
 * Two optional hooks:
 *  - `setupBeforeBind()` — runs at the top of `connectedCallback`, before
 *    the `for=` resolution. Use for DOM mutations that must apply
 *    regardless of whether the store resolves (the indicator pushes its
 *    `data-position` / `data-drawer` attributes here so the chip renders
 *    even when bound asynchronously).
 *  - `satelliteTagName` — used in the "store not found" warning so the
 *    diagnostic names the specific element type.
 */
export abstract class SatelliteElement extends SatelliteBaseElement {
    /**
     * The bound store, once it is built — the store's non-flushing
     * satellite-side controller (internal; the public one is `controller`).
     */
    protected store: DropzoneController | null = null;
    protected storeEl: DropzoneElement | null = null;
    /**
     * Set by `bindToStore()` for satellites mounted inside another shadow
     * root (the convenience-form `<web-dropzone display-mode=…>` mounts its
     * own picker / list / indicator internally, where `document.getElementById`
     * lookups can't reach across the shadow boundary). When set, the
     * `connectedCallback` consults this directly instead of resolving the
     * `for=` attribute.
     */
    protected programmaticStoreEl: DropzoneElement | null = null;
    private cleanupStoreWait: (() => void) | null = null;
    private cleanupSubscriptions: (() => void) | null = null;

    protected abstract readonly satelliteTagName: string;

    protected abstract attachStoreSubscriptions(
        storeEl: DropzoneElement,
        store: DropzoneController
    ): () => void;

    protected abstract onStoreReady(
        storeEl: DropzoneElement,
        store: DropzoneController
    ): void;

    /** Optional pre-bind DOM setup. Default no-op. */
    protected setupBeforeBind(): void { /* override in subclasses if needed */ }

    /** Unsubscribe from core's theme context; set while connected. */
    private themeUnsub: (() => void) | null = null;

    connectedCallback(): void {
        this.subscribeThemeContext();
        this.setupBeforeBind();
        if (this.programmaticStoreEl) {
            this.storeEl = this.programmaticStoreEl;
        } else {
            const forId = this.getAttribute('for');
            this.storeEl = resolveStoreElement(forId);
            if (!this.storeEl) {
                warnStoreMissing(this.satelliteTagName, forId);
                return;
            }
        }
        this.waitForStore();
    }

    disconnectedCallback(): void {
        this.themeUnsub?.();
        this.themeUnsub = null;
        this.teardownStoreBinding();
    }

    /**
     * Satellites aren't BlissElements, so mirror the page theme onto the host
     * the way BlissElement does: core's theme context (page signal, or the
     * `theme-source` attribute) → `data-context-theme`, which dark-mode.css reads.
     */
    private subscribeThemeContext(): void {
        this.themeUnsub?.();
        this.themeUnsub = observeThemeContext(this, this.getAttribute(THEME_SOURCE_ATTRIBUTE) || null, (scheme) => {
            if (scheme) this.setAttribute(THEME_CONTEXT_ATTRIBUTE, scheme);
            else this.removeAttribute(THEME_CONTEXT_ATTRIBUTE);
        });
    }

    /**
     * Programmatically bind to a `<web-dropzone>` element, bypassing the
     * `for=` attribute. Use when mounting the satellite inside another
     * shadow root (where `document.getElementById` can't reach the store).
     *
     * Safe to call before `connectedCallback` — the binding is consulted
     * when the element connects. Calling after connection tears down the
     * current wiring and re-binds.
     */
    bindToStore(storeEl: DropzoneElement): void {
        if (this.programmaticStoreEl === storeEl && this.store) return;
        this.programmaticStoreEl = storeEl;
        if (this.isConnected) {
            this.teardownStoreBinding();
            this.storeEl = storeEl;
            this.waitForStore();
        }
    }

    protected teardownStoreBinding(): void {
        if (this.cleanupStoreWait) {
            this.cleanupStoreWait();
            this.cleanupStoreWait = null;
        }
        if (this.cleanupSubscriptions) {
            this.cleanupSubscriptions();
            this.cleanupSubscriptions = null;
        }
        this.store = null;
        this.storeEl = null;
    }


    /**
     * The bound store's public controller (the same object as the store's
     * `el.controller`), or `null` until the store is built. Lets consumer
     * code reach the store from a satellite reference.
     */
    get controller(): DropzoneController | null {
        return this.store && this.storeEl ? this.storeEl.controller : null;
    }

    private waitForStore(): void {
        if (!this.storeEl) return;
        const storeEl = this.storeEl;
        this.cleanupStoreWait = whenStoreReady(storeEl, (store) => {
            this.store = store;
            this.cleanupSubscriptions = this.attachStoreSubscriptions(storeEl, store);
            this.onStoreReady(storeEl, store);
        });
    }
}
