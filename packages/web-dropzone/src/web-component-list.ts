/**
 * `<web-dropzone-list for="<store-id>">` — satellite renderer.
 *
 * A read-mostly view of a store's `FileState[]`, rendered in one of several
 * appearances (list / detailed / grid / badges / rolling). Subscribes to
 * the store's substrate events (file-add, file-remove, file-progress,
 * file-status-change, change) so it stays in sync without polling. Action
 * buttons (remove, pause, resume, cancel, retry) call back through to the
 * store's public API.
 *
 * Rolling appearance shows a single "front" file (highest-priority active
 * one — see `getFrontFile`) with rotation animations. A queue badge button
 * sits in the top-right corner; clicking it dispatches a `queue-open`
 * event (core `emit()`: `onQueueOpen` twin first; bubbles, not composed; detail carries the store's `controller` / `element`) — popover wiring is up to the consumer.
 * The convenience form (`<web-dropzone>`) listens for this event and opens
 * its built-in popover; standalone satellite consumers can wire any UI.
 *
 * The satellite never owns file state. The store is authoritative; the
 * satellite is a projection. See ARCHITECTURE.md.
 */

import styles from './css/main.css?inline';
import { adoptStyles, ICON_CSS, createMicrotaskScheduler, keepScrollAcrossMove, toBool, toEnum, type EventDef, type InputDef } from '@keenmate/web-components-core';
import {
    SatelliteElement,
    SATELLITE_INPUTS,
    subscribeStoreEvents,
    createStoreContextBase,
    type SatelliteElementConfig
} from './satellite-base';
import {
    escapeHtml,
    isImageFile,
    createImagePreview,
    formatFileSize,
    statusIconName,
    statusLabel,
    DEFAULT_CONFIG
} from '@keenmate/web-dropzone-core';
import type { FileStatus } from '@keenmate/web-dropzone-core';
import {
    patchProgressFill,
    patchProgressText,
    patchStatusIcon,
    patchActionButton,
    patchCancelButton,
    patchRemoveButton
} from './row-patching';
import { isStoreFileReorderEligible, runStoreAction } from './store-link';
import {
    renderListItem,
    renderDetailedItem,
    renderGridItem,
    renderBadgeItem,
    repaintRowIcons,
    repaintFileIcons,
    repaintNamedIcons,
    renderDzIcon,
    ICON_NAME_ATTR,
    FILE_ICON_ATTR,
    statusGlyph
} from './row-templates';
import type { DzIconOptions, RowTemplateOptions } from './row-templates';
import type { DropzoneContext, DropzoneListEventMap, QueueOpenEventDetail, SummaryActivateEventDetail } from '@keenmate/web-dropzone-core';
import { buildStatusSurfaceArgs, renderRollingSurface } from './status-surface';
import type { DropzoneElement } from './web-component';
import type { FileState, GridLayout, GridStatus, ListAppearance, RollingRotation } from '@keenmate/web-dropzone-core';

// Appearances this satellite implements. `none` deliberately omitted —
// it means "no list visible at all", which is best handled by simply
// not mounting the satellite. The popover wrapper (core createPopover, resize,
// persistence) still lives in `<web-dropzone>`'s in-class code; the
// satellite renders the summary anchor only.
const SUPPORTED_APPEARANCES = [
    'list', 'detailed', 'grid', 'badges', 'rolling', 'popover'
] as const satisfies readonly ListAppearance[];

/** `<web-dropzone-list>` inputs. */
const INPUTS: readonly InputDef[] = [
    ...SATELLITE_INPUTS,
    { configKey: 'listAppearance', attribute: 'list-appearance', converter: toEnum(SUPPORTED_APPEARANCES, { default: 'list' }), shouldReflect: true, on: 'update', description: 'How the files are shown: list, detailed, grid, badges, rolling (one current file + queue badge) or popover (the summary line; the popover itself is the store\'s).' },
    { configKey: 'gridLayout', attribute: 'grid-layout', converter: toEnum(['uniform', 'natural'] as const, { default: DEFAULT_CONFIG.gridLayout }), shouldReflect: true, on: 'update', description: 'Tile layout for the grid appearance: uniform equal-size tiles, or natural (equal-height rows keeping each image\'s aspect ratio).' },
    { configKey: 'gridStatus', attribute: 'grid-status', converter: toEnum(['badge', 'overlay'] as const, { default: DEFAULT_CONFIG.gridStatus }), shouldReflect: true, on: 'update', description: 'How finished grid files are flagged: badge (corner glyph) or overlay (full-tile veil + big glyph).' },
    { configKey: 'isNested', attribute: 'nested', converter: toBool('default-false'), on: 'update', type: 'boolean', description: 'Files-inside styling (the list sits inside a picker card). Set by the store when it mounts the list itself.' },
];

/** Every `<web-dropzone-list>` input, keyed by `configKey` (its typed properties). */
export interface DropzoneListElementConfig extends SatelliteElementConfig {
    listAppearance?: (typeof SUPPORTED_APPEARANCES)[number];
    gridLayout?: GridLayout;
    gridStatus?: GridStatus;
    isNested?: boolean;
}

/**
 * Event table (core SPEC §12.5): each is one DOM event on the list (bubbles,
 * NOT composed) + a camelCase `on*` twin called first with the same detail.
 * The detail carries the BOUND STORE's `controller` / `element`
 * (non-enumerable), no data of its own.
 */
const EVENTS: readonly EventDef[] = [
    { name: 'summary-activate', description: 'Popover appearance: the summary line was activated (click / Enter / Space). The standalone list owns no popover — open your own UI here. `detail`: the bound store\'s `controller` / `element`. Twin: `onSummaryActivate(detail)`.' },
    { name: 'queue-open', description: 'Rolling appearance: the queue badge was clicked. `detail`: the bound store\'s `controller` / `element`. Twin: `onQueueOpen(detail)`.' },
];

export class DropzoneListElement extends SatelliteElement<DropzoneListEventMap> {
    protected static override inputs = INPUTS;
    protected static override events = EVENTS;
    protected readonly satelliteTagName = 'web-dropzone-list';

    // `on*` twins — called with the event detail (core installs the accessors).
    declare onSummaryActivate: ((detail: SummaryActivateEventDetail) => void) | null;
    declare onQueueOpen: ((detail: QueueOpenEventDetail) => void) | null;

    private shadow: ShadowRoot;
    private container: HTMLElement;
    /**
     * Coalesces structural re-render requests within the same microtask.
     * Adding N files at once dispatches N × file-add plus one change —
     * without coalescing we'd rebuild the list N+1 times (and destroy the
     * row a user might be mid-click on). With it: one rebuild per burst.
     */
    private readonly renderScheduler = createMicrotaskScheduler();
    private readonly renderAllTask = (): void => this.renderAll();
    private scheduleRenderAll(): void { this.renderScheduler.schedule(this.renderAllTask); }
    /**
     * When `max-visible-file-count` is in effect and the queue exceeds it, the
     * list collapses to the first N rows + a "Show N more" toggle. Click
     * flips this flag and re-renders; further structural events (add /
     * remove / clear) leave it sticky so the user's preference survives
     * the next burst. Reset to false on a full clear in the change handler.
     */
    private showAll = false;
    /** Context prototype for per-row icon ctx — rebuilt when the bound store changes. */
    private contextBase: { storeEl: DropzoneElement; base: DropzoneContext } | null = null;

    /**
     * Who draws this list's icons: the store element (its tag + `icons` map +
     * `renderIconCallback` — a satellite draws with its store's, so the
     * page-wide `window.components.icons['web-dropzone.<name>']` applies).
     */
    private iconOptions(): DzIconOptions {
        const cfg = this.store?.getOptions();
        return { host: cfg?.hostElement ?? this, renderIconCallback: cfg?.renderIconCallback, icons: cfg?.icons };
    }

    private iconContext(): DropzoneContext | undefined {
        const storeEl = this.storeEl;
        if (!storeEl) return undefined;
        if (this.contextBase?.storeEl !== storeEl) {
            this.contextBase = { storeEl, base: createStoreContextBase(storeEl, () => this.renderState) };
        }
        return this.contextBase.base;
    }

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        adoptStyles(this.shadow, styles);
        adoptStyles(this.shadow, ICON_CSS);
        this.container = document.createElement('div');
        this.container.className = 'dz__host dz__host--list-only';
        this.shadow.appendChild(this.container);
        // The rows keep their scroll position across a DOM move (core, SPEC §12.31).
        keepScrollAcrossMove(this, () => this.container.querySelectorAll('.dz__file-list, .dz__files-inside'));
    }

    /** An own input changed (core `update()`): re-render. */
    protected override inputsChanged(): void {
        if (this.store) this.renderAll();
    }

    /**
     * The page-wide `window.components.renderIconCallback` changed (core,
     * C-CA-40): repaint the rows' Cancel / Remove and file-type icons in place with the
     * store's icon hook — rows, scroll and focus are kept.
     */
    protected override iconsChanged(): void {
        const store = this.store;
        if (!store) return;
        const cfg = store.getOptions();
        const files = store.getFiles();
        const findFile = (id: string) => files.find((f) => f.id === id);
        const iconOptions = this.iconOptions();
        repaintRowIcons(this.container, findFile, cfg.cancelIcon, cfg.removeIcon, iconOptions);
        repaintFileIcons(this.container, findFile, { iconOverrides: cfg, iconContext: this.iconContext(), iconOptions });
        repaintNamedIcons(this.container, findFile, iconOptions);
    }

    // ========================================================================
    // STORE SUBSCRIPTIONS
    // ========================================================================

    protected attachStoreSubscriptions(storeEl: DropzoneElement): () => void {
        return subscribeStoreEvents(storeEl, {
            // add / remove / change → structural; coalesce burst events
            // (one re-render per microtask) so a bulk drop doesn't churn
            // DOM rows while the user is mid-click on an existing row.
            'file-add':   () => this.scheduleRenderAll(),
            'file-remove': () => this.scheduleRenderAll(),
            'change':       () => this.scheduleRenderAll(),
            // Config re-render (e.g. `item-controls` changed) → re-render rows.
            'dz-config-changed': () => this.scheduleRenderAll(),
            // `sink-completed`: a completed row's delay elapsed (or a
            // retried row left the bucket) — internal store signal.
            'dz-reorder': (e) => {
                const { id, isComplete } = (e as CustomEvent<{ id: string; isComplete: boolean }>).detail;
                this.applyReorder(id, isComplete);
            },
            // progress / status changes → patch the affected row in place
            // (rendering at 50ms ticks across 20 files would burn DOM otherwise).
            'file-progress': (e) => this.patchRow((e as CustomEvent).detail.id),
            // A previewUrl landing (async image preview) arrives as file-update;
            // swap the row's icon slot for the <img> without a full re-render.
            'file-update': (e) => this.patchPreview((e as CustomEvent).detail.file.id),
            // Status changes need extra handling for rolling (front-file
            // pick may shift — patchRow alone can't reflect that) and for
            // popover (the summary's status icon depends on aggregate
            // state, not the per-file row).
            'file-status-change': (e) => {
                this.patchRow((e as CustomEvent).detail.id);
                const appearance = this.resolveAppearance();
                if (appearance === 'rolling' && this.store) {
                    this.renderRolling(this.store.getFiles());
                } else if (appearance === 'popover' && this.store) {
                    this.renderSummary(this.store.getFiles());
                }
            }
        });
    }

    protected onStoreReady(): void {
        this.renderAll();
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    private resolveAppearance(): ListAppearance {
        return this.config.listAppearance as ListAppearance;
    }

    private renderAll(): void {
        if (!this.store) return;
        const files = this.store.getFiles();
        const appearance = this.resolveAppearance();

        if (files.length === 0) {
            // The queue was just cleared — reset the show-more flag so the
            // next non-empty render starts capped again rather than
            // surprising the user with the expanded view.
            this.showAll = false;
            // Popover renders nothing when empty — the summary line only
            // appears once there are files, matching the in-class
            // behavior; if we showed an empty-state message the popover
            // anchor would also need an entire empty-state click handler
            // path. Easier to just keep the surface invisible.
            if (appearance === 'popover') {
                this.container.innerHTML = '';
                return;
            }
            const emptyMessage = this.label('messages.noData');
            // labels.noData '' = deliberately empty: render nothing.
            this.container.innerHTML = emptyMessage ? `<div class="dz__empty">${escapeHtml(emptyMessage)}</div>` : '';
            return;
        }

        if (appearance === 'rolling') {
            this.renderRolling(files);
            return;
        }
        if (appearance === 'popover') {
            this.renderSummary(files);
            return;
        }

        // `nested="true"` swaps the container class family to
        // `.dz__files-inside--*` — that's the family the
        // in-class files-inside layout uses, and the corresponding
        // styles in `_dropzone.css` only differ for nested rows. We
        // already inline that stylesheet inside the satellite shadow,
        // so the rules apply unchanged.
        const isNested = !!this.config.isNested;
        const base = isNested ? 'dz__files-inside' : 'dz__file-list';
        const reorderClass = this.store.getOptions().shouldSinkCompleted ? ` ${base}--reorder-completed` : '';
        const containerClass = `${base} ${base}--${appearance}${reorderClass}`;

        // Apply the max-visible-file-count cap. Mirrors the in-class renderer:
        // appearances with their own dedicated layout (rolling, popover)
        // are excluded above — we only reach here for list/detailed/grid/
        // badges. When the queue is empty we already returned.
        // With `sink-completed`, the cap windows the reordered list (rows
        // in the "complete" bucket last), as the in-class renderer does.
        const cap = this.store.getOptions().maxVisibleFileCount ?? 0;
        const visible = cap > 0 && !this.showAll ? this.orderForReorder(files).slice(0, cap) : files;
        const toggle = this.renderShowMoreToggle(files.length, cap, appearance);

        // Grid tile layout (uniform | natural) + finished-file flag
        // (badge | overlay) — only emitted for the grid appearance.
        const gridAttrs = appearance === 'grid'
            ? ` data-grid-layout="${this.config.gridLayout as GridLayout}"`
              + ` data-grid-status="${this.config.gridStatus as GridStatus}"`
            : '';

        const rows = visible.map(f => this.renderRow(f, appearance)).join('');
        // The same wrapper (same class) is kept and only its rows are replaced: it is
        // the scroll container, so its scroll position survives a re-render (a file
        // added) and a DOM move (keepScrollAcrossMove tracks this element).
        const existing = this.container.firstElementChild;
        if (existing instanceof HTMLElement && this.container.childElementCount === 1 && existing.className === containerClass) {
            existing.dataset.listAppearance = appearance;
            if (appearance === 'grid') {
                existing.dataset.gridLayout = this.config.gridLayout as GridLayout;
                existing.dataset.gridStatus = this.config.gridStatus as GridStatus;
            } else {
                delete existing.dataset.gridLayout;
                delete existing.dataset.gridStatus;
            }
            existing.innerHTML = `${rows}${toggle}`;
        } else {
            this.container.innerHTML = `<div class="${containerClass}" data-list-appearance="${appearance}"${gridAttrs}>${rows}${toggle}</div>`;
        }
        this.bindRowHandlers();
        this.bindToggleHandler();
        this.attachPreviewLoaders(visible);
    }

    /**
     * Render the trailing "Show N more" / "Show less" toggle when the
     * `max-visible-file-count` cap is in effect and the queue exceeds it.
     * Mirrors the in-class renderer's `renderToggleButton` — badges
     * surface uses a pill-shaped variant to fit the badge frame; the
     * other inline appearances use a full-width text button.
     */
    private renderShowMoreToggle(total: number, cap: number, appearance: ListAppearance): string {
        if (cap <= 0 || total <= cap) return '';
        const isBadges = appearance === 'badges';
        const dis = this.isStoreDisabled ? ' disabled' : '';
        if (this.showAll) {
            return isBadges
                ? `<button type="button" class="dz__badge dz__badge--more" data-dz-action="toggle-visible" aria-label="${escapeHtml(this.label('ariaLabels.showLess'))}"${dis}>−</button>`
                : `<button type="button" class="dz__show-more" data-dz-action="toggle-visible"${dis}>${escapeHtml(this.label('buttons.showLess'))}</button>`;
        }
        const hidden = total - cap;
        return isBadges
            ? `<button type="button" class="dz__badge dz__badge--more" data-dz-action="toggle-visible" aria-label="${escapeHtml(this.label('ariaLabels.showMore', { ctx: { count: hidden } }))}"${dis}>+${hidden}</button>`
            : `<button type="button" class="dz__show-more" data-dz-action="toggle-visible"${dis}>${escapeHtml(this.label('buttons.showMore', { ctx: { count: hidden } }))}</button>`;
    }

    /** Bind the toggle button's click handler (only present when the
     *  max-visible cap is active and over). */
    private bindToggleHandler(): void {
        const btn = this.container.querySelector<HTMLElement>('[data-dz-action="toggle-visible"]');
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showAll = !this.showAll;
            this.renderAll();
        });
    }

    // ========================================================================
    // POPOVER APPEARANCE — summary anchor only
    // ========================================================================

    /**
     * Render a single summary line ("{count} files · {size}") that acts as
     * the click target for the popover. The actual popover wrapper is
     * external to this satellite — the convenience form's `<web-dropzone>`
     * renders it in-class, and standalone consumers wire any UI they want
     * by listening for `summary-activate` (bubbles, not composed) or setting
     * its `onSummaryActivate` twin.
     *
     * The summary subtree is re-rendered on every store change. That's
     * cheap (one line of DOM) and avoids the per-tick patching dance the
     * in-class summary does — there's no nested resize / focus state to
     * preserve here, just the icon + text.
     */
    private renderSummary(files: FileState[]): void {
        if (!this.store) return;
        const cfg = this.store.getOptions();
        const args = buildStatusSurfaceArgs(files, this.storeEl!.controller, this.storeEl!, this.renderState);
        const status = args.overallStatus === 'idle' ? 'pending' : args.overallStatus;
        const iconName = status === 'pending' ? 'summary' : statusIconName(status as Exclude<FileStatus, 'uploading'>);
        const icon = status === 'pending'
            ? renderDzIcon('summary', this.iconOptions())
            : statusGlyph(status as FileStatus, this.iconOptions());
        const iconNameAttr = status === 'uploading' ? '' : ` ${ICON_NAME_ATTR}="${iconName}"`;
        const iconClass = status === 'pending'
            ? 'dz__summary-icon'
            : `dz__summary-icon dz__summary-icon--${status}`;
        const statusName = statusLabel(this.label, status as FileStatus);

        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        const text = this.label('labels.summary', { ctx: { count: files.length, size: formatFileSize(totalSize, this.storeLocale), bytes: totalSize } });

        this.container.innerHTML = `
            <div class="dz__summary">
                <div class="dz__summary-line" ${this.isStoreDisabled ? 'tabindex="-1" aria-disabled="true"' : 'tabindex="0"'} role="button" aria-label="${escapeHtml(this.label('ariaLabels.viewFiles'))}">
                    <span class="${iconClass}" data-status="${status}" aria-label="${escapeHtml(this.label('ariaLabels.status', { ctx: { status, statusName } }))}"${status === 'uploading' ? ' aria-busy="true"' : ''}${iconNameAttr}>${icon}</span>
                    <span class="dz__summary-text">${escapeHtml(text)}</span>
                </div>
            </div>
        `;

        const line = this.container.querySelector('.dz__summary-line');
        if (!line) return;
        const fire = () => {
            if (!this.isStoreDisabled) this.emitStoreEvent('summary-activate');
        };
        line.addEventListener('click', fire);
        line.addEventListener('keydown', (e) => {
            const ke = e as KeyboardEvent;
            if (ke.key === 'Enter' || ke.key === ' ') {
                ke.preventDefault();
                fire();
            }
        });
    }

    private renderRow(file: FileState, appearance: ListAppearance): string {
        // `item-controls` allowlist → a Set the row templates filter on.
        // Absent (undefined) keeps the default "render every part" path.
        const cfg = this.store?.getOptions();
        const ic = cfg?.itemControls;
        const parts = ic ? new Set(ic) : undefined;
        const useThumbnail = this.shouldShowThumbnails(appearance);
        // Store config satisfies FileIconOverrides structurally → forward it so
        // the satellite honours the same fileIcons / getFileIconCallback
        // overrides; the context base gives each per-row ctx the store's
        // controller / element.
        const opts: RowTemplateOptions = {
            parts,
            useThumbnail,
            iconOverrides: cfg,
            iconContext: this.iconContext(),
            removable: this.isFileUserRemovable(file),
            reorderEligible: this.isReorderEligible(file),
            hasUploadHandler: this.hasUploadHandler(file),
            label: this.label,
            locale: cfg?.locale,
            cancelIcon: cfg?.cancelIcon,
            removeIcon: cfg?.removeIcon,
            // The store's icon hook, with the store element as its ctx `element`
            // (a bulk dropzone draws through internal satellites).
            iconOptions: this.iconOptions(),
            isDisabled: this.isStoreDisabled
        };
        if (appearance === 'badges')   return renderBadgeItem(file, opts);
        if (appearance === 'grid')     return renderGridItem(file, opts);
        if (appearance === 'detailed') return renderDetailedItem(file, opts);
        // 'rolling' uses the list-item template for the front-file row.
        return renderListItem(file, opts);
    }

    /** The file has an upload handler (store-level or per-file, Mode B). */
    private hasUploadHandler(file: FileState): boolean {
        return !!(file.uploadFileCallback || this.store?.getOptions().uploadFileCallback);
    }

    /**
     * The bound store is disabled (its `disabled` or a disabled `<fieldset>`):
     * every control this list renders is `disabled` — no interaction, not
     * focusable (core SPEC §6.4 native semantics; the list follows its store).
     */
    private get isStoreDisabled(): boolean {
        return !!this.store?.getOptions().isDisabled;
    }

    /** `allow-uploaded-file-removal="false"` hides the remove button on completed rows (layout kept). */
    private isFileUserRemovable(file: FileState): boolean {
        if (this.store?.getOptions().isReadonly) return false;
        if (file.status !== 'complete') return true;
        return this.store?.getOptions().isUploadedFileRemovalAllowed !== false;
    }

    /** Row belongs in the "complete" reorder bucket (`sink-completed`, delay elapsed). */
    private isReorderEligible(file: FileState): boolean {
        return !!this.storeEl && isStoreFileReorderEligible(this.storeEl, file);
    }

    /** Stable sort: rows in the "complete" reorder bucket last. */
    private orderForReorder(files: FileState[]): FileState[] {
        if (!this.store?.getOptions().shouldSinkCompleted) return files;
        return files
            .map((f, i) => ({ f, i, complete: this.isReorderEligible(f) ? 1 : 0 }))
            .sort((a, b) => a.complete - b.complete || a.i - b.i)
            .map(x => x.f);
    }

    /**
     * A `sink-completed` delay elapsed (or a retried row left the bucket):
     * flip the row's bucket so the CSS `order` moves it. With a
     * `max-visible-file-count` cap the visible window changes too, so re-render.
     */
    private applyReorder(id: string, isComplete: boolean): void {
        const cap = this.store?.getOptions().maxVisibleFileCount ?? 0;
        if (cap > 0 && !this.showAll) {
            this.scheduleRenderAll();
            return;
        }
        const row = this.container.querySelector<HTMLElement>(`[data-file-id="${id}"]`);
        if (!row) return;
        if (isComplete) row.dataset.reorderBucket = 'complete';
        else delete row.dataset.reorderBucket;
    }

    /**
     * Resolve the thumbnail flag with the same per-appearance auto-default as
     * `WebDropzone.shouldShowThumbnails`: `show-thumbnails` (store config
     * `isThumbnailsShown`) wins when set; otherwise only `grid` defaults
     * to thumbnails. Kept in sync so the satellite list renders image previews
     * for `list-appearance="badges" show-thumbnails` just like the built-in form.
     */
    private shouldShowThumbnails(appearance: ListAppearance): boolean {
        const enabled = this.store?.getOptions().isThumbnailsShown;
        if (enabled !== undefined) return enabled;
        return appearance === 'grid';
    }

    // ========================================================================
    // ROLLING APPEARANCE
    // ========================================================================

    /**
     * Pick the file currently occupying the "front" slot. Priority order:
     * first uploading → first pending → first paused/error/cancelled
     * (needs attention) → last completed (so the slot doesn't go empty the
     * instant a final upload hits 100%). Returns null only when `files`
     * is empty.
     */
    private getFrontFile(files: FileState[]): FileState | null {
        if (files.length === 0) return null;
        const uploading = files.find(f => f.status === 'uploading' || f.status === 'cancelling');
        if (uploading) return uploading;
        const pending = files.find(f => f.status === 'pending');
        if (pending) return pending;
        const needsAction = files.find(f =>
            f.status === 'paused' || f.status === 'error' || f.status === 'cancelled'
        );
        if (needsAction) return needsAction;
        for (let i = files.length - 1; i >= 0; i--) {
            if (files[i].status === 'complete') return files[i];
        }
        return files[0];
    }

    /**
     * Resolve the rolling rotation mode from the store's config. The
     * satellite doesn't take its own `rolling-rotation` attribute — the
     * store is the single source of truth (matches the in-class renderer's
     * behavior). Falls back to the engine default (`DEFAULT_CONFIG`, 'slide-in').
     */
    private resolveRollingRotation(): RollingRotation {
        const cfg = this.store?.getOptions();
        return (cfg?.rollingRotation ?? DEFAULT_CONFIG.rollingRotation) as RollingRotation;
    }

    /**
     * Render the rolling block. Same call serves first-render and front-
     * changed re-render — `previousCurrent` is detected from the DOM. When
     * the front file hasn't shifted, the existing slot is left in place and
     * we just refresh the queue count + any callback-driven slot content
     * (tick patching is handled by `patchRow` elsewhere).
     */
    private renderRolling(files: FileState[]): void {
        if (!this.store) return;
        const rotation = this.resolveRollingRotation();
        const cfg = this.store.getOptions();

        // Ensure the wrapper exists once and survives across renders — we
        // never reassign the container's innerHTML in rolling mode after
        // the first non-empty render, so callback-mounted nodes (custom
        // body, custom slots) keep their identity across ticks.
        let wrapper = this.container.querySelector<HTMLElement>('.dz__file-list--rolling');
        if (!wrapper) {
            this.container.innerHTML = '';
            wrapper = document.createElement('div');
            wrapper.className = 'dz__file-list dz__file-list--rolling';
            wrapper.setAttribute('data-list-appearance', 'rolling');
            this.container.appendChild(wrapper);
            // Single delegated click handler — covers any current/future row
            // inside the wrapper without rebinding on each rotation.
            this.bindRowHandlers();
        }

        // The shared rolling renderer (status-surface.ts) — the same one the
        // store's in-class list uses; callbacks through core `renderSlot`.
        renderRollingSurface(wrapper, {
            args: buildStatusSurfaceArgs(files, this.storeEl!.controller, this.storeEl!, this.renderState),
            front: this.getFrontFile(files),
            rotation,
            bodyCallback: cfg.renderRollingBodyCallback,
            fileInfoCallback: cfg.renderRollingFileInfoCallback,
            progressCallback: cfg.renderRollingProgressCallback,
            renderRow: (file) => this.renderRow(file, 'rolling'),
            label: this.label,
            locale: this.storeLocale,
            isDisabled: this.isStoreDisabled,
            updateQueueButton: (w, count, show) => this.updateRollingQueueButton(w, count, show),
        });
    }

    /**
     * Ensure the rolling queue badge exists inside `wrapper` and reflects
     * the current file count. Created once and reused across re-renders so
     * its click handler isn't repeatedly rebound (and so the badge doesn't
     * flicker during a front-file swap). On click, dispatches a
     * `queue-open` event (core `emit()`, `onQueueOpen` twin; bubbles, not composed) — popover wiring
     * happens externally (convenience form listens; standalone users wire
     * their own).
     */
    private updateRollingQueueButton(wrapper: HTMLElement, queueCount: number, showQueueBtn: boolean): void {
        let queueBtn = wrapper.querySelector<HTMLButtonElement>('.dz__rolling-queue');
        if (!queueBtn) {
            queueBtn = document.createElement('button');
            queueBtn.type = 'button';
            queueBtn.className = 'dz__rolling-queue';
            queueBtn.dataset.dzAction = 'open-queue';
            queueBtn.innerHTML = '<span class="dz__rolling-queue-count"></span>';
            queueBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.emitStoreEvent('queue-open');
            });
            wrapper.appendChild(queueBtn);
        }
        const countEl = queueBtn.querySelector('.dz__rolling-queue-count');
        if (countEl) countEl.textContent = String(queueCount);
        queueBtn.classList.toggle('dz__rolling-queue--hidden', !showQueueBtn);
        queueBtn.disabled = this.isStoreDisabled;
        queueBtn.setAttribute('aria-label', this.label('ariaLabels.showQueue', { ctx: { count: queueCount } }));
        queueBtn.setAttribute('title', this.label('tooltips.showQueue', { ctx: { count: queueCount } }));
    }

    // ========================================================================
    // ROW EVENTS
    // ========================================================================

    private bindRowHandlers(): void {
        // Single delegated click handler — cheaper than wiring per-row,
        // and survives DOM patches without rebinding.
        this.container.addEventListener('click', this.handleListClick);
    }

    private handleListClick = (e: Event): void => {
        // A disabled store: no user action (a consumer-rendered row button too).
        if (!this.store || this.isStoreDisabled) return;
        const target = e.target as HTMLElement | null;
        if (!target) return;

        // Action button (pause / resume / retry). Slot is always in the DOM;
        // only react when `data-row-action` is set (i.e. not the hidden /
        // inert placeholder shape).
        // Every row button goes through the store (core `runAction`): its
        // `beforeActionCallback`, then the `action` event on `<web-dropzone>`.
        const actionBtn = target.closest<HTMLElement>('[data-dz-action="row-action"]');
        if (actionBtn) {
            const id = actionBtn.getAttribute('data-file-id');
            const action = actionBtn.getAttribute('data-row-action');
            if (!id || (action !== 'pause' && action !== 'resume' && action !== 'retry')) return;
            void runStoreAction(this.storeEl, { action, fileId: id, source: 'row-toolbar', triggerElement: actionBtn, sourceEvent: e });
            return;
        }

        // Cancel (⊘) — asks `beforeFilesCancelCallback`; the row stays as
        // `cancelled` (Retry available).
        const cancelBtn = target.closest<HTMLElement>('[data-dz-action="cancel"]');
        if (cancelBtn) {
            const id = cancelBtn.getAttribute('data-file-id');
            if (id) void runStoreAction(this.storeEl, { action: 'cancel', fileId: id, source: 'row-toolbar', triggerElement: cancelBtn, sourceEvent: e });
            return;
        }

        // Remove (✕) — confirmed through `beforeFilesRemoveCallback`; a
        // running upload is cancelled first, then the file is removed.
        // Programmatic `removeFile(id)` callers stay un-gated by default.
        const removeBtn = target.closest<HTMLElement>('[data-dz-action="remove"]');
        if (removeBtn) {
            const id = removeBtn.getAttribute('data-file-id');
            // Guards (read-only / gone / cancelling) live in the store's activateAction.
            if (id) void runStoreAction(this.storeEl, { action: 'remove', fileId: id, source: 'row-toolbar', triggerElement: removeBtn, sourceEvent: e });
        }
    };

    // ========================================================================
    // ROW PATCHING — for progress / status ticks
    // ========================================================================

    /**
     * One-shot icon-slot → `<img>` swap when a file's `previewUrl` lands
     * asynchronously (store emits `file-update`). Only the appearances whose
     * templates honor `useThumbnail` are patched — badges / detailed / grid —
     * and only when `show-thumbnails` resolves on for that appearance. Skips if
     * the slot is already an image, so repeated `file-update` ticks are cheap.
     */
    private patchPreview(id: string): void {
        if (!this.store) return;
        const file = this.store.getFileById(id);
        if (!file || !file.previewUrl) return;
        const appearance = this.resolveAppearance();
        if (appearance !== 'badges' && appearance !== 'detailed' && appearance !== 'grid') return;
        if (!this.shouldShowThumbnails(appearance)) return;
        const row = this.container.querySelector<HTMLElement>(`[data-file-id="${id}"]`);
        if (!row) return;

        if (appearance === 'grid') {
            const placeholder = row.querySelector('.dz__preview-item-placeholder');
            if (!placeholder) return; // already swapped to <img>
            const img = document.createElement('img');
            img.className = 'dz__preview-item-image';
            img.src = file.previewUrl;
            img.alt = file.name;
            placeholder.replaceWith(img);
            return;
        }

        // badges + detailed both hold `renderPlaceholderInner` in an icon slot.
        const slot = row.querySelector(
            appearance === 'badges' ? '.dz__badge-icon' : '.dz__file-item-icon'
        );
        if (!slot || !slot.hasAttribute(FILE_ICON_ATTR)) return; // no icon part, or already patched
        const img = document.createElement('img');
        img.src = file.previewUrl;
        img.alt = '';
        slot.replaceChildren(img);
        slot.removeAttribute(FILE_ICON_ATTR);   // a thumbnail now — no icon repaint
    }

    private patchRow(id: string): void {
        if (!this.store) return;
        const file = this.store.getFileById(id);
        if (!file) return;
        const row = this.container.querySelector<HTMLElement>(`[data-file-id="${id}"]`);
        if (!row) return;

        const appearance = this.resolveAppearance();
        if (appearance === 'badges') {
            if (row.dataset.status !== file.status) {
                row.dataset.status = file.status;
                row.className = `dz__badge dz__badge--${file.status}`;
            }
            patchStatusIcon(row, 'dz__badge-status', file, this.label, this.iconOptions());
            patchActionButton(
                row.querySelector<HTMLElement>('[data-dz-action="row-action"]'),
                file,
                'dz__badge-action',
                this.label,
                this.iconOptions()
            );
            patchRemoveButton(
                row.querySelector<HTMLElement>('[data-dz-action="remove"]'),
                this.isFileUserRemovable(file),
                'dz__badge-remove',
                file.status === 'cancelling',
                this.isStoreDisabled
            );
            patchCancelButton(row.querySelector<HTMLElement>('[data-dz-action="cancel"]'), file, 'dz__badge-action', this.hasUploadHandler(file), this.isStoreDisabled);
            return;
        }

        // list / detailed / grid all have progress fill + status icon, plus
        // the action button transitions across states (uploading→pause,
        // paused→resume, error→retry, …). Slot is reserved so the button
        // is always in the DOM; we just toggle classes + glyphs.
        row.dataset.status = file.status;
        const prefix = appearance === 'grid' ? 'dz__preview-item' : 'dz__file-item';
        patchProgressFill(row, `${prefix}-progress-fill`, file.progress);
        if (appearance !== 'grid') {
            patchProgressText(row, `${prefix}-progress-text`, file, this.label, this.storeLocale);
        }
        patchStatusIcon(row, `${prefix}-status`, file, this.label, this.iconOptions());
        patchActionButton(
            row.querySelector<HTMLElement>('[data-dz-action="row-action"]'),
            file,
            `${prefix}-action`,
            this.label,
            this.iconOptions()
        );
        patchRemoveButton(
            row.querySelector<HTMLElement>('[data-dz-action="remove"]'),
            this.isFileUserRemovable(file),
            `${prefix}-remove`,
            file.status === 'cancelling',
            this.isStoreDisabled
        );
        patchCancelButton(row.querySelector<HTMLElement>('[data-dz-action="cancel"]'), file, `${prefix}-action`, this.hasUploadHandler(file), this.isStoreDisabled);
    }

    // ========================================================================
    // IMAGE PREVIEW BACKFILL — for grid appearance
    // ========================================================================

    private attachPreviewLoaders(files: FileState[]): void {
        if (this.resolveAppearance() !== 'grid') return;
        // Generate previews for images that don't have one yet. The store
        // also does this in its own renderer, but since the satellite is
        // independent, we duplicate the work here so a satellite-only setup
        // (store has list-appearance="none") still gets thumbnails.
        for (const file of files) {
            if (file.previewUrl) continue;
            if (!isImageFile(file.file)) continue;
            createImagePreview(file.file).then(url => {
                file.previewUrl = url;
                const row = this.container.querySelector<HTMLElement>(`[data-file-id="${file.id}"]`);
                if (!row) return;
                const placeholder = row.querySelector('.dz__preview-item-placeholder');
                if (placeholder) {
                    const img = document.createElement('img');
                    img.className = 'dz__preview-item-image';
                    img.src = url;
                    img.alt = file.name;
                    placeholder.replaceWith(img);
                }
            }).catch(() => { /* swallow — preview is best-effort */ });
        }
    }
}

/** Every input as a typed property (core usage "Typing the properties", rulebook C-CA-16). */
export interface DropzoneListElement extends DropzoneListElementConfig {}
