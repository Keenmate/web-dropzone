/**
 * `<web-dropzone-indicator for="<store-id>">` — satellite renderer.
 *
 * Status surface that summarizes the bound store's activity. Three
 * flexibility hooks make one element cover a wide range of UX:
 *
 *   - `position="right|left|top|bottom|inline"` — viewport-edge fixed
 *     (default) or inline flow.
 *   - `drawer="auto|off"` — `auto` (default) → chip is a button that
 *     opens a slide-out drawer with the full file list (embedded
 *     `<web-dropzone-list>`); `off` → non-interactive `<div role="status">`,
 *     no drawer DOM. Suits a "rotating indicator that something is
 *     happening" widget.
 *   - Structural render callbacks (`renderBodyCallback`,
 *     `renderFileInfoCallback`, `renderProgressCallback`) — replace any
 *     of the three default parts piecemeal. See `./status-surface.ts`
 *     for the shared contract; the same callback shape is reused by the
 *     rolling list block in `dropzone.ts`.
 *
 * The default rendering is the library calling its own polished defaults
 * through the same hooks: Lucide SVG glyphs + the shared upload loader (core renderLoader) for
 * active uploads + a thin progress bar under the label. Each default part
 * is replaceable independently — you can override progress but keep the
 * built-in file info, or vice versa.
 *
 * Memoization is consistent across all three callbacks (see
 * `applyStatusSurfaceResult`): string returns are skipped when equal to
 * the previous string; element returns are skipped when the returned
 * node is already mounted as the only child. That's what lets a cached
 * loader survive across 50ms progress ticks without restarting.
 */

import styles from './css/main.css?inline';
import indicatorStyles from './css/indicator.css?inline';
import {
    SatelliteElement,
    SATELLITE_INPUTS,
    subscribeStoreEvents,
    type SatelliteElementConfig
} from './satellite-base';
import {
    escapeHtml,
    STATUS_ICONS,
    formatFileSize,
    fileStatusLabel,
    statusLabel
} from '@keenmate/web-dropzone-core';
import { adoptStyles, createMicrotaskScheduler, renderLoader, toEnum, toFunction, type InputDef } from '@keenmate/web-components-core';
import {
    buildStatusSurfaceArgs,
    StatusSurface
} from './status-surface';
import type {
    StatusSurfaceArgs,
    StatusSurfaceCallback
} from './status-surface';
import type { DropzoneElement } from './web-component';
import type { FileState, FileStatus, LabelFn } from '@keenmate/web-dropzone-core';

const POSITIONS = ['right', 'left', 'top', 'bottom', 'inline'] as const;
type IndicatorPosition = typeof POSITIONS[number];

const DRAWER_MODES = ['auto', 'off'] as const;
type DrawerMode = typeof DRAWER_MODES[number];

/** `<web-dropzone-indicator>` inputs. */
const INPUTS: readonly InputDef[] = [
    ...SATELLITE_INPUTS,
    { configKey: 'position', attribute: 'position', converter: toEnum(POSITIONS, { default: 'right' }), shouldReflect: true, on: 'update', description: 'Where the chip sits: fixed to a viewport edge (right, left, top, bottom) or inline in the page flow.' },
    { configKey: 'drawer', attribute: 'drawer', converter: toEnum(DRAWER_MODES, { default: 'auto' }), shouldReflect: true, on: 'update', description: '`auto`: the chip is a button opening a slide-out drawer with the full file list; `off`: a non-interactive `role="status"` chip, no drawer.' },
    { configKey: 'renderBodyCallback', converter: toFunction(), on: 'update', type: 'StatusSurfaceCallback | null', description: 'Replace the whole chip body (`args`: `StatusSurfaceArgs`). Return a string / element, `null` for the default, `false` to hide the chip. When set, the default file-info / progress slots are not mounted.' },
    { configKey: 'renderFileInfoCallback', converter: toFunction(), on: 'update', type: 'StatusSurfaceCallback | null', description: 'Replace the chip\'s file-info slot (default body only). `args.currentFile`, `currentFilePercent`, `currentFileStatus`.' },
    { configKey: 'renderProgressCallback', converter: toFunction(), on: 'update', type: 'StatusSurfaceCallback | null', description: 'Replace the chip\'s progress slot (default body only): per-file and overall slices.' },
];

/** Every `<web-dropzone-indicator>` input, keyed by `configKey` (its typed properties). */
export interface DropzoneIndicatorElementConfig extends SatelliteElementConfig {
    position?: IndicatorPosition;
    drawer?: DrawerMode;
    renderBodyCallback?: StatusSurfaceCallback | null;
    renderFileInfoCallback?: StatusSurfaceCallback | null;
    renderProgressCallback?: StatusSurfaceCallback | null;
}

/**
 * Builds the default chip label. Used internally when the consumer hasn't
 * overridden the body/fileInfo/progress trio. Exposed via the shared
 * status-surface contract — see [status-surface.ts](./status-surface.ts).
 */
function defaultChipLabel(args: StatusSurfaceArgs, label: LabelFn): string {
    const a = args.aggregate;
    if (a.total === 0)   return label('indicatorIdle');
    if (a.error > 0)     return label('indicatorFailed', { count: a.error });
    if (a.uploading > 0) return label('indicatorUploading', { count: a.uploading });
    if (a.paused > 0)    return label('indicatorPaused', { count: a.paused });
    if (a.pending > 0)   return label('indicatorQueued', { count: a.pending });
    return label('indicatorDone', { count: a.complete });
}

export class DropzoneIndicatorElement extends SatelliteElement {
    protected static override inputs = INPUTS;
    protected readonly satelliteTagName = 'web-dropzone-indicator';
    private shadow: ShadowRoot;
    /**
     * Chip element. `<button>` when the drawer is enabled (it toggles the
     * drawer), `<div role="status">` when `drawer="off"`. Stored as
     * `HTMLElement` so both cases share one field.
     */
    private chipEl: HTMLElement;

    /**
     * Default-path sub-containers. Built by the body default when the
     * consumer hasn't supplied `renderBodyCallback`. Each one is the
     * mount point for the corresponding fileInfo / progress callback;
     * surgical patching writes into these without disturbing the chip's
     * outer button + click handler.
     */
    private fileInfoSlotEl: HTMLElement | null = null;
    private progressSlotEl: HTMLElement | null = null;

    /**
     * Per-callback memoization snapshots. See `applyStatusSurfaceResult`.
     * One entry per slot — when a callback returns the same value two
     * ticks in a row the slot's DOM is left untouched.
     */
    private surface = new StatusSurface();
    /** Snapshot of the last default-body state, used to skip rebuilds. */
    private bodyDefaultMounted = false;

    /**
     * Drawer + close button. Both null when `drawer="off"`.
     */
    private drawerEl: HTMLElement | null = null;
    private drawerCloseBtn: HTMLButtonElement | null = null;
    private drawerOpen = false;

    /**
     * Coalesces aggregate recomputation. A bulk drop with N files
     * uploading at 50ms ticks fires N × file-progress per tick — each
     * would otherwise iterate every file to recompute totals. With this,
     * we recompute once per microtask (≈ once per paint frame).
     */
    private readonly refreshScheduler = createMicrotaskScheduler();
    private readonly refreshTask = (): void => this.refresh();
    private scheduleRefresh(): void { this.refreshScheduler.schedule(this.refreshTask); }

    // The three render callbacks (`renderBodyCallback`, `renderFileInfoCallback`,
    // `renderProgressCallback`) are property-only input rows; see INPUTS.
    private get bodyCallback(): StatusSurfaceCallback | null {
        return this.config.renderBodyCallback as StatusSurfaceCallback | null;
    }
    private get fileInfoCallback(): StatusSurfaceCallback | null {
        return this.config.renderFileInfoCallback as StatusSurfaceCallback | null;
    }
    private get progressCallback(): StatusSurfaceCallback | null {
        return this.config.renderProgressCallback as StatusSurfaceCallback | null;
    }

    private resetMemoization(): void {
        this.surface.reset();
        this.bodyDefaultMounted = false;
    }

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        adoptStyles(this.shadow, styles);
        adoptStyles(this.shadow, indicatorStyles);

        // Chip is built on connect (and rebuilt on drawer flips) because
        // its element kind depends on attribute state.
        this.chipEl = document.createElement('button');
    }

    /**
     * Own inputs changed (core `update()`): position / drawer re-apply, a new
     * render callback drops its memoized slot, then one refresh.
     */
    protected override inputsChanged(partial: Record<string, unknown>): void {
        if ('position' in partial) this.applyPosition();
        if ('drawer' in partial) {
            this.applyDrawerMode();
            this.bindEmbeddedList();
        }
        if ('renderBodyCallback' in partial) this.resetMemoization();
        if ('renderFileInfoCallback' in partial) this.surface.resetFileInfo();
        if ('renderProgressCallback' in partial) this.surface.resetProgress();
        if (this.store) this.scheduleRefresh();
    }

    protected setupBeforeBind(): void {
        this.applyPosition();
        this.applyDrawerMode();
    }

    protected onStoreReady(): void {
        this.bindEmbeddedList();
        this.refresh();
    }

    // ========================================================================
    // POSITION + DRAWER MODE
    // ========================================================================

    private resolvePosition(): IndicatorPosition {
        return this.config.position as IndicatorPosition;
    }

    private resolveDrawerMode(): DrawerMode {
        return this.config.drawer as DrawerMode;
    }

    private applyPosition(): void {
        this.shadow.host.setAttribute('data-position', this.resolvePosition());
    }

    private applyDrawerMode(): void {
        const mode = this.resolveDrawerMode();
        this.shadow.host.setAttribute('data-drawer', mode);

        // Tear down previous chip + drawer. We always rebuild on a drawer
        // flip because the chip's element kind (button vs div) differs.
        if (this.chipEl.parentNode) this.chipEl.parentNode.removeChild(this.chipEl);
        if (this.drawerEl?.parentNode) this.drawerEl.parentNode.removeChild(this.drawerEl);
        this.drawerEl = null;
        this.drawerCloseBtn = null;
        this.fileInfoSlotEl = null;
        this.progressSlotEl = null;
        this.resetMemoization();
        this.drawerOpen = false;
        this.shadow.host.setAttribute('data-drawer-open', 'false');

        if (mode === 'auto') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('aria-label', this.label('indicatorStatus'));
            btn.addEventListener('click', () => this.toggleDrawer());
            this.chipEl = btn;
        } else {
            const div = document.createElement('div');
            div.setAttribute('role', 'status');
            div.setAttribute('aria-label', this.label('indicatorStatus'));
            this.chipEl = div;
        }
        this.chipEl.className = 'dz__indicator-chip';
        // `part="chip"` lets consumers reach the chip wrapper from outside the
        // shadow root via `::part(chip)` — needed when they want to strip the
        // pill (border / background / padding) and render plain inline text.
        this.chipEl.setAttribute('part', 'chip');
        this.shadow.appendChild(this.chipEl);

        if (mode === 'auto') {
            this.drawerEl = document.createElement('div');
            this.drawerEl.className = 'dz__indicator-drawer';
            this.drawerEl.setAttribute('part', 'drawer');
            this.drawerEl.setAttribute('role', 'dialog');
            this.drawerEl.setAttribute('aria-label', this.label('indicatorQueue'));
            this.populateDrawer();
            this.shadow.appendChild(this.drawerEl);
        }
    }

    // ========================================================================
    // SUBSCRIPTIONS
    // ========================================================================

    protected attachStoreSubscriptions(storeEl: DropzoneElement): () => void {
        return subscribeStoreEvents(storeEl, {
            'file-add':           () => this.scheduleRefresh(),
            'file-remove':         () => this.scheduleRefresh(),
            'change':               () => this.scheduleRefresh(),
            'dz-config-changed':    () => this.scheduleRefresh(),
            'file-progress':        () => this.scheduleRefresh(),
            'file-status-change':  () => this.scheduleRefresh()
        });
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    private populateDrawer(): void {
        if (!this.drawerEl) return;
        // Body intentionally empty — the embedded `<web-dropzone-list>` is
        // mounted in `bindEmbeddedList` once `storeEl` is known, so we can
        // call `bindToStore` BEFORE the list is connected. Putting the
        // list in this innerHTML string would have its `connectedCallback`
        // fire mid-parse with no binding, logging "store not found".
        this.drawerEl.innerHTML = `
            <header class="dz__indicator-drawer-header">
                <span class="dz__indicator-drawer-title">${escapeHtml(this.label('indicatorTitle'))}</span>
                <button type="button" class="dz__indicator-drawer-close" aria-label="${escapeHtml(this.label('close'))}"></button>
            </header>
            <div class="dz__indicator-drawer-body"></div>
        `;
        this.drawerCloseBtn = this.drawerEl.querySelector('.dz__indicator-drawer-close');
        if (this.drawerCloseBtn) {
            this.drawerCloseBtn.addEventListener('click', () => this.setDrawerOpen(false));
        }
        // Try to mount immediately — no-op if storeEl isn't resolved yet
        // (populateDrawer runs during connectedCallback, before
        // whenStoreReady fires). The whenStoreReady callback re-invokes us.
        this.bindEmbeddedList();
    }

    /**
     * Mount + wire the drawer's embedded `<web-dropzone-list>` to the
     * same store this indicator is bound to. Idempotent: creates the
     * list element on the first call where both `drawerEl` and `storeEl`
     * exist, and re-binds (cheap) on subsequent calls. Safe to invoke
     * from both `populateDrawer` (which may run before the store
     * resolves) and the `whenStoreReady` callback (which runs once it
     * does).
     */
    private bindEmbeddedList(): void {
        if (!this.drawerEl || !this.storeEl) return;
        const body = this.drawerEl.querySelector('.dz__indicator-drawer-body');
        if (!body) return;
        type BindableList = HTMLElement & { bindToStore?: (el: DropzoneElement) => void };
        let embeddedList = body.querySelector('web-dropzone-list') as BindableList | null;
        if (!embeddedList) {
            embeddedList = document.createElement('web-dropzone-list') as BindableList;
            embeddedList.setAttribute('list-appearance', 'detailed');
            // bindToStore BEFORE appendChild — sets `programmaticStoreEl`
            // so the list's connectedCallback uses it instead of looking
            // up the `for=` attribute (which we don't set).
            embeddedList.bindToStore?.(this.storeEl);
            body.appendChild(embeddedList);
        } else {
            embeddedList.bindToStore?.(this.storeEl);
        }
    }

    private refresh(): void {
        if (!this.store) return;
        this.refreshStaticLabels();
        const files = this.store.getFiles();
        const args = buildStatusSurfaceArgs(files, this.storeEl!.controller, this.storeEl!);

        // ---- Chip dataset (drives color + 'empty' state via CSS) --------
        const newStatus = args.overallStatus;
        if (this.chipEl.dataset.status !== newStatus) {
            this.chipEl.dataset.status = newStatus;
        }
        const nextEmpty = args.aggregate.total === 0 ? 'true' : 'false';
        if (this.chipEl.dataset.empty !== nextEmpty) {
            this.chipEl.dataset.empty = nextEmpty;
        }
        // A disabled store (its `disabled` or a disabled `<fieldset>`) disables
        // the drawer chip: no interaction, not focusable (core SPEC §6.4).
        if (this.chipEl instanceof HTMLButtonElement) {
            this.chipEl.disabled = !!this.store.getConfig().isDisabled;
        }

        // ---- Body callback (or default) ---------------------------------
        const bodyResult = this.bodyCallback
            ? this.bodyCallback(args)
            : null;

        const { current } = this.surface.applyBody(this.chipEl, bodyResult);
        if (current === 'hidden') {
            this.bodyDefaultMounted = false;
            return;
        }
        if (current === 'custom') {
            this.chipEl.hidden = false;
            this.bodyDefaultMounted = false;
            return;
        }

        // current === 'default' — render the polished OOB body. Build slots
        // once and patch in place from there.
        this.chipEl.hidden = false;
        if (!this.bodyDefaultMounted
            || !this.fileInfoSlotEl
            || !this.progressSlotEl
            || this.fileInfoSlotEl.parentNode !== this.chipEl) {
            this.buildDefaultBodyShell(args);
            // Reset slot memoization so the next callback call writes
            // fresh content into the just-built slots.
            this.surface.resetSlots();
        }
        this.refreshFileInfoSlot(args);
        this.refreshProgressSlot(args);
    }

    /**
     * Builds the polished OOB body once. Three slots inside the chip:
     * a leading status glyph (file-info default lives here), a middle
     * label, and a trailing progress block. The label is patched per
     * refresh; the two slots get filled by the file-info / progress
     * callbacks (or library defaults when those aren't set).
     */
    private buildDefaultBodyShell(_args: StatusSurfaceArgs): void {
        this.chipEl.innerHTML = '';

        this.fileInfoSlotEl = document.createElement('span');
        this.fileInfoSlotEl.className = 'dz__indicator-file-info';
        this.chipEl.appendChild(this.fileInfoSlotEl);

        const label = document.createElement('span');
        label.className = 'dz__indicator-label';
        this.chipEl.appendChild(label);

        this.progressSlotEl = document.createElement('span');
        this.progressSlotEl.className = 'dz__indicator-progress';
        this.chipEl.appendChild(this.progressSlotEl);

        this.bodyDefaultMounted = true;
    }

    /** Chip / drawer accessible names + drawer title / close — live with `labels`. */
    private refreshStaticLabels(): void {
        const setAttr = (el: Element | null | undefined, name: string, value: string) => {
            if (el && el.getAttribute(name) !== value) el.setAttribute(name, value);
        };
        setAttr(this.chipEl, 'aria-label', this.label('indicatorStatus'));
        setAttr(this.drawerEl, 'aria-label', this.label('indicatorQueue'));
        setAttr(this.drawerCloseBtn, 'aria-label', this.label('close'));
        const title = this.drawerEl?.querySelector('.dz__indicator-drawer-title');
        const titleText = this.label('indicatorTitle');
        if (title && title.textContent !== titleText) title.textContent = titleText;
    }

    private refreshFileInfoSlot(args: StatusSurfaceArgs): void {
        if (!this.fileInfoSlotEl) return;
        const result = this.fileInfoCallback
            ? this.fileInfoCallback(args)
            : null;
        this.surface.applyFileInfo(
            this.fileInfoSlotEl,
            result,
            () => this.defaultFileInfo(args)
        );
    }

    private refreshProgressSlot(args: StatusSurfaceArgs): void {
        if (!this.progressSlotEl) return;
        const result = this.progressCallback
            ? this.progressCallback(args)
            : null;
        this.surface.applyProgress(
            this.progressSlotEl,
            result,
            () => this.defaultProgress(args)
        );

        // The label sits between the two slots and reads from the
        // aggregate. Auto-hide it when the consumer has provided either a
        // fileInfo OR progress callback — once you're customizing those
        // structural slots, the OOB "1 uploading" / "3 done" summary
        // becomes visual noise sandwiched between your own template parts.
        // Templates that DO want a description alongside custom slots
        // should bake it into the fileInfo / progress return value, or
        // use `renderBodyCallback` to own the whole chip.
        const label = this.chipEl.querySelector<HTMLElement>('.dz__indicator-label');
        if (label) {
            const labelHidden = !!this.fileInfoCallback
                || !!this.progressCallback;
            if (label.hidden !== labelHidden) label.hidden = labelHidden;
            if (!labelHidden) {
                const nextLabel = defaultChipLabel(args, this.label);
                if (label.textContent !== nextLabel) label.textContent = nextLabel;
            }
        }
    }

    /**
     * Library default for the file-info slot. While idle: nothing (empty
     * string memoizes to a no-op). While there's a focal file: the
     * file's status glyph — swapped to the upload loader (core renderLoader)
     * when the focal file is actively uploading. Returns an HTMLElement so the
     * loader instance survives across ticks (identity-checked memoization).
     */
    private defaultFileInfo(args: StatusSurfaceArgs): string | HTMLElement {
        if (!args.currentFile) { this.releaseUploadLoader(); return ''; }
        if (args.currentFile.status === 'uploading') {
            return this.getUploadLoader();
        }
        this.releaseUploadLoader();
        const status = args.currentFile.status as FileStatus;
        // Static glyph for non-uploading focal states (paused / error /
        // complete). Returned as a string so it memoizes by equality.
        return `<span class="dz__indicator-file-info-icon" data-status="${status}" title="${escapeHtml(fileStatusLabel(this.label, args.currentFile))}">${STATUS_ICONS[status]}</span>`;
    }

    /**
     * Library default for the progress slot. Shows the byte-weighted
     * overall percent when anything is uploading. Returned as a string so
     * adjacent ticks at the same percent are memoized away.
     */
    private defaultProgress(args: StatusSurfaceArgs): string {
        if (args.aggregate.uploading === 0) return '';
        return `<span class="dz__indicator-percent">${args.overallPercent}%</span>`;
    }

    /**
     * The upload loader (SPEC §12.14 of core): a `role="status"` container
     * filled by core `renderLoader()` — the store's `renderLoadingCallback`,
     * else `window.components.renderLoadingCallback`, else the default
     * `.dz__loader`. Drawn once per upload run and reused across refreshes so
     * the animation never restarts (`applyStatusSurfaceResult` short-circuits
     * when the returned element is already mounted); released (hook cleanup)
     * when the focal file stops uploading or the store binding goes away.
     */
    private uploadLoader: HTMLElement | null = null;
    private removeUploadLoader: (() => void) | null = null;
    private getUploadLoader(): HTMLElement {
        if (!this.uploadLoader) {
            const container = document.createElement('span');
            container.className = 'dz__indicator-loader';
            this.removeUploadLoader = renderLoader(this, container, 'upload', {
                prefix: 'dz',
                label: statusLabel(this.label, 'uploading'),
                renderLoadingCallback: this.storeEl?.renderLoadingCallback ?? null
            });
            this.uploadLoader = container;
        }
        return this.uploadLoader;
    }
    private releaseUploadLoader(): void {
        if (!this.uploadLoader) return;
        this.removeUploadLoader?.();
        this.removeUploadLoader = null;
        this.uploadLoader = null;
    }

    protected override teardownStoreBinding(): void {
        super.teardownStoreBinding();
        this.releaseUploadLoader();
    }

    // ========================================================================
    // DRAWER
    // ========================================================================

    private toggleDrawer(): void {
        this.setDrawerOpen(!this.drawerOpen);
    }

    private setDrawerOpen(open: boolean): void {
        if (!this.drawerEl) return;
        if (this.drawerOpen === open) return;
        this.drawerOpen = open;
        this.shadow.host.setAttribute('data-drawer-open', open ? 'true' : 'false');
    }
}

/** Every input as a typed property (core usage "Typing the properties", rulebook C-CA-16). */
export interface DropzoneIndicatorElement extends DropzoneIndicatorElementConfig {}

// Convenience re-exports so users writing callbacks have a single import
// path for everything: types + status icons.
export {
    formatFileSize,
    STATUS_ICONS
} from '@keenmate/web-dropzone-core';
export type { LoaderRenderContext, RenderLoaderCallback } from '@keenmate/web-components-core';
export type {
    StatusSurfaceArgs,
    StatusSurfaceCallback,
    StatusSurfaceResult,
    StatusAggregate
} from '@keenmate/web-dropzone-core';
