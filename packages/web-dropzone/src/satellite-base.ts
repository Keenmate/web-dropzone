/**
 * Shared helpers for satellite renderers — `<web-dropzone-picker>`,
 * `<web-dropzone-list>`, `<web-dropzone-indicator>`, `<web-dropzone-progress>`
 * — and their `BlissElement` base class. See ARCHITECTURE.md for
 * the store + satellite-renderers topology.
 *
 * Each satellite binds to exactly one `<web-dropzone>` store via its
 * `for="<store-id>"` attribute. The resolution race (satellite may upgrade
 * before, after, or alongside the store's `connectedCallback`) is the
 * trickiest part of the wiring; these helpers centralize it.
 */

import type { DropzoneElement } from './web-component';
import type { DropzoneController, DropzoneContext, DropzoneLabels, LabelFn } from '@keenmate/web-dropzone-core';
import { createLabelFn } from '@keenmate/web-dropzone-core';
import { BlissElement, createCustomStyles, toFunction, toText, withComponentContext, type CustomStylesHandle, type EventMap, type InputDef } from '@keenmate/web-components-core';
import { storeControllerOf, STORE_BUILD_EVENT } from './store-link';
import { labelsConverter } from './inputs';

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
 * The input rows every satellite shares (core `static inputs`): `for` — the id
 * of the `<web-dropzone>` store to bind to (`el.htmlFor`, the platform's name
 * for a `for` attribute, as on `<label>` / `<output>`); `labels` — the
 * satellite's own UI strings, merged per key over the bound store's `labels`,
 * then the built-in English.
 */
export const SATELLITE_INPUTS: readonly InputDef[] = [
    { configKey: 'htmlFor', attribute: 'for', converter: toText({ isNullable: true }), shouldReflect: true, on: 'update', type: 'string | null', description: 'Id of the `<web-dropzone>` store this satellite binds to (attribute `for`). Changing it re-binds. Not needed when the store mounts the satellite itself.' },
    { configKey: 'labels', attribute: 'labels', converter: labelsConverter, on: 'update', type: 'Partial<DropzoneLabels>', description: 'This satellite\'s own UI strings — a partial `DropzoneLabels` (property, or a JSON attribute), merged per key over the bound store\'s `labels`, then the built-in English. Live.' },
    { configKey: 'customStyles', attribute: 'custom-styles', converter: toText({ isNullable: true }), on: 'update', type: 'string | null', description: 'Extra CSS for this satellite\'s shadow root (raw CSS — NOT sanitized). Comes after the page-wide `window.components[tag].customStyles`, so it overrides it; `getCustomStylesCallback` wins over it.' },
    { configKey: 'getCustomStylesCallback', converter: toFunction(), on: 'update', type: '(ctx: object) => string | null | undefined', description: 'Returns extra CSS for this satellite\'s shadow root (raw CSS — NOT sanitized); wins over `customStyles`.' },
];

/** The inputs every satellite has (its typed properties). */
export interface SatelliteElementConfig {
    htmlFor?: string | null;
    labels?: Partial<DropzoneLabels>;
    customStyles?: string | null;
    getCustomStylesCallback?: ((ctx: object) => string | null | undefined) | null;
}

/**
 * Base class for `<web-dropzone-picker>`, `<web-dropzone-list>`,
 * `<web-dropzone-indicator>`, `<web-dropzone-progress>` — a core
 * `BlissElement` (inputs table, SSR stub, theme context mirror, `motion`,
 * defer / ready, per-instance logger, `window.components[tag]` entry), so a
 * satellite has no attribute plumbing of its own. It owns the store binding
 * (`for=` resolution / `bindToStore()` + the store-ready race) so that logic
 * lives in one place; subclasses provide their event subscription + first
 * render hooks.
 *
 * Two abstract members:
 *  - `attachStoreSubscriptions(storeEl, store)` — wire up event listeners,
 *    return the cleanup function. Called exactly once per resolved store.
 *  - `onStoreReady(storeEl, store)` — fire the first render + any one-time
 *    bind work (e.g. mounting an embedded satellite).
 *
 * Optional hooks:
 *  - `setupBeforeBind()` — runs at every activation, before the `for=`
 *    resolution. Use for DOM work that must apply whether or not the store
 *    resolves (the indicator writes `data-position` / `data-drawer` here).
 *  - `inputsChanged(partial)` — a batch of the satellite's own inputs changed
 *    (core `update()`; `for` re-binds before it).
 *  - `deactivated()` — after the store binding is torn down on disconnect.
 */
export abstract class SatelliteElement<TEvents extends EventMap = Record<string, never>> extends BlissElement<TEvents, DropzoneController | null> {
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
     * lookups can't reach across the shadow boundary). When set, activation
     * uses it instead of resolving the `for=` attribute.
     */
    protected programmaticStoreEl: DropzoneElement | null = null;
    private cleanupStoreWait: (() => void) | null = null;
    private cleanupSubscriptions: (() => void) | null = null;
    /** Between core's `connect()` and `disconnect()`. */
    private isActive = false;
    /** Core's custom-CSS handle (page layer + instance layer), made on the first build. */
    private customStylesHandle: CustomStylesHandle | null = null;

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

    /** The satellite's own inputs changed (not `for`). Default no-op. */
    protected inputsChanged(_partial: Record<string, unknown>): void { /* override */ }

    /** After the binding was torn down on disconnect. Default no-op. */
    protected deactivated(): void { /* override */ }

    /** UI strings: own `labels` → the bound store's `labels` → built-in English. */
    protected readonly label: LabelFn = createLabelFn(() => [
        this.config.labels as Partial<DropzoneLabels> | null | undefined,
        this.store?.getConfig().labels
    ]);

    /**
     * Build (core `reinit()`): custom CSS, the canonical way (core usage
     * "Style injection", rulebook C-CA-15) — the page layer
     * `window.components[tag].customStyles`, then this instance's.
     */
    protected override reinit(): void {
        if (this.customStylesHandle) {
            this.customStylesHandle.refresh();
            return;
        }
        this.customStylesHandle = createCustomStyles(this, this.shadowRoot!, {
            cssClass: 'dz-custom-styles',
            getContext: () => this.withContext({}),
            getInstanceStyles: () => ({
                css: this.config.customStyles as string | null,
                callback: this.config.getCustomStylesCallback as ((ctx: object) => string | null | undefined) | null,
            }),
        });
    }

    /** Final teardown (core `destroy()`): the binding and the custom CSS. */
    protected override destroyCallback(): void {
        this.teardownStoreBinding();
        this.customStylesHandle?.destroy();
        this.customStylesHandle = null;
    }

    /** Activation (core): resolve the store and bind once it is built. */
    protected override connect(): void {
        this.isActive = true;
        this.setupBeforeBind();
        this.bindFromConfig();
    }

    /** Deactivation (core): stop listening to the store. */
    protected override disconnect(): void {
        this.isActive = false;
        this.teardownStoreBinding();
        this.deactivated();
    }

    /** Core `update()`: `for` re-binds; everything goes to `inputsChanged()`. */
    protected override update(partial: Record<string, unknown>): void {
        if ('customStyles' in partial || 'getCustomStylesCallback' in partial) this.customStylesHandle?.refresh();
        if ('htmlFor' in partial && !this.programmaticStoreEl && this.isActive) {
            this.teardownStoreBinding();
            this.bindFromConfig();
        }
        this.inputsChanged(partial);
    }

    private bindFromConfig(): void {
        if (this.programmaticStoreEl) {
            this.storeEl = this.programmaticStoreEl;
        } else {
            const forId = (this.config.htmlFor as string | null) ?? null;
            this.storeEl = resolveStoreElement(forId);
            if (!this.storeEl) {
                this.log.UI.warn(
                    `<${this.satelliteTagName} for="${forId ?? ''}"> — store not found. ` +
                    `Make sure a <web-dropzone id="${forId ?? ''}"> exists on the page.`
                );
                return;
            }
        }
        this.waitForStore();
    }

    /**
     * Programmatically bind to a `<web-dropzone>` element, bypassing the
     * `for=` attribute. Use when mounting the satellite inside another
     * shadow root (where `document.getElementById` can't reach the store).
     *
     * Safe to call before the element connects — the binding is used when it
     * activates. Calling after connection tears down the current wiring and
     * re-binds.
     */
    bindToStore(storeEl: DropzoneElement): void {
        if (this.programmaticStoreEl === storeEl && this.store) return;
        this.programmaticStoreEl = storeEl;
        if (this.isActive) {
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
    override get controller(): DropzoneController | null {
        return this.store && this.storeEl ? this.storeEl.controller : null;
    }

    /**
     * Fire one of this satellite's declared events (`static events`) through
     * core `emit()` (SPEC §12.5): the `on*` twin is called with the detail,
     * then the DOM event (bubbles, NOT composed) is dispatched on the
     * satellite. The detail carries the BOUND STORE's context — `controller`
     * (the store's `el.controller`) and `element` (the `<web-dropzone>`),
     * non-enumerable — attached up front, so core keeps them.
     */
    protected emitStoreEvent<K extends keyof TEvents & string>(name: K): boolean {
        const storeEl = this.storeEl;
        const detail = storeEl ? withComponentContext({}, storeEl.controller, storeEl as HTMLElement) : {};
        return this.emit(name, detail as never);
    }

    private waitForStore(): void {
        if (!this.storeEl) return;
        const storeEl = this.storeEl;
        this.cleanupStoreWait = whenStoreReady(storeEl, (store) => {
            this.cleanupStoreWait = null;
            this.store = store;
            this.cleanupSubscriptions = this.attachStoreSubscriptions(storeEl, store);
            this.onStoreReady(storeEl, store);
        });
    }
}

/** The shared inputs as typed properties (core usage "Typing the properties", rulebook C-CA-16). */
export interface SatelliteElement<TEvents extends EventMap = Record<string, never>> extends SatelliteElementConfig {}
