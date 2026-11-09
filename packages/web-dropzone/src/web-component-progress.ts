/**
 * `<web-dropzone-progress for="<store-id>">` — satellite renderer.
 *
 * Aggregate progress strip — bar + counts + percent + bulk-action buttons
 * (Pause all / Resume all / Cancel all / Retry all). Same surface the convenience form
 * used to render inline inside `<web-dropzone>`; promoted to a standalone
 * element so decoupled layouts (headless store + custom HTML) can drop it
 * anywhere on the page.
 *
 * The strip auto-hides when there's no upload activity (pure pending
 * selections, an empty queue, or everything cleared). That's why this
 * satellite is safe to leave in flow — it collapses to zero height when
 * idle and re-appears once the first byte transfers.
 *
 * Customization surfaces:
 *  - `data-status` attribute on the host element exposes the aggregate
 *    state (uploading / paused / error / complete) — `::part(bar)` /
 *    `::part(fill)` are styled accordingly from main.css.
 *  - Action buttons are auto-shown based on aggregate state — there's no
 *    knob to override them piecemeal. Set `uploadFileCallback` on the
 *    store to enable Pause / Resume buttons (Retry shows whenever any
 *    file is in `error` state, callback or not).
 */

import styles from './css/main.css?inline';
import { adoptStyles, createMicrotaskScheduler, type InputDef } from '@keenmate/web-components-core';
import {
    SatelliteElement,
    SATELLITE_INPUTS,
    subscribeStoreEvents,
    type SatelliteElementConfig
} from './satellite-base';
import { escapeHtml, formatFileSize } from '@keenmate/web-dropzone-core';
import type { DropzoneElement } from './web-component';
import type { OverallProgress } from '@keenmate/web-dropzone-core';

/** `<web-dropzone-progress>` inputs: only the shared satellite rows (`for`, `labels`, `custom-styles`, `getCustomStylesCallback`). */
const INPUTS: readonly InputDef[] = [...SATELLITE_INPUTS];

export class DropzoneProgressElement extends SatelliteElement {
    protected static override inputs = INPUTS;
    protected readonly satelliteTagName = 'web-dropzone-progress';
    private shadow: ShadowRoot;
    private container: HTMLElement;
    /**
     * Coalesce per-tick refreshes. The store fires file-progress at 50ms
     * intervals across every active upload; a 20-file burst would
     * otherwise re-aggregate 400×/sec — overkill for a single bar.
     */
    private readonly refreshScheduler = createMicrotaskScheduler();
    private readonly refreshTask = (): void => this.refresh();
    private scheduleRefresh(): void { this.refreshScheduler.schedule(this.refreshTask); }

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        adoptStyles(this.shadow, styles);

        this.container = document.createElement('div');
        this.container.className = 'dz__overall-progress';
        // `part="root"` so consumers can reach the strip wrapper from
        // outside the shadow root — useful for tweaking margins / hiding
        // behavior without re-implementing the whole bar.
        this.container.setAttribute('part', 'root');
        this.shadow.appendChild(this.container);
    }

    /** `labels` changed (core `update()`): re-render with the new strings. */
    protected override inputsChanged(): void {
        if (this.store) this.refresh();
    }

    protected attachStoreSubscriptions(storeEl: DropzoneElement): () => void {
        // Every event that can move the aggregate triggers a refresh.
        // The microtask coalescer below drops bursts to one refresh.
        return subscribeStoreEvents(storeEl, {
            'file-add':          () => this.scheduleRefresh(),
            'file-remove':        () => this.scheduleRefresh(),
            'change':              () => this.scheduleRefresh(),
            // Config change (e.g. `labels`): rebuild the action buttons too.
            'dz-config-changed':   () => { delete this.container.dataset.dzButtonsSig; this.scheduleRefresh(); },
            'file-progress':       () => this.scheduleRefresh(),
            'file-status-change': () => this.scheduleRefresh()
        });
    }

    protected onStoreReady(): void {
        this.refresh();
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    /**
     * Refresh the strip in place. Always-changing bits (fill width, counts,
     * percent) are patched on every call. The action button group is only
     * rebuilt when its signature changes (uploading > 0, paused > 0,
     * failed > 0 — three bits) so a tick refresh doesn't tear down
     * mid-click. Empty state collapses the wrapper via `innerHTML = ''`
     * paired with `.dz__overall-progress:empty { display: none }`.
     */
    private refresh(): void {
        if (!this.store) return;
        const overall = this.store.getOverallProgress();

        // Reflect aggregate state on the host element AND the container —
        // both `:host([data-status=…])` and `.dz__overall-progress[data-status=…]`
        // selectors live in the main stylesheet, so either path lights up.
        if (!overall.hasActivity) {
            this.container.innerHTML = '';
            delete this.container.dataset.dzButtonsSig;
            delete this.container.dataset.status;
            this.removeAttribute('data-status');
            this.removeAttribute('data-empty');
            this.setAttribute('data-empty', 'true');
            return;
        }
        this.removeAttribute('data-empty');

        if (this.container.dataset.status !== overall.aggregateStatus) {
            this.container.dataset.status = overall.aggregateStatus;
        }
        if (this.getAttribute('data-status') !== overall.aggregateStatus) {
            this.setAttribute('data-status', overall.aggregateStatus);
        }

        const totalFileCount = this.store.getFiles().length;
        const pipelineActive = !!this.store.getConfig().uploadFileCallback;
        const sig = this.overallActionsSignature(overall, pipelineActive);

        const fillEl = this.container.querySelector('.dz__overall-progress-fill') as HTMLElement | null;
        const barEl = this.container.querySelector('.dz__overall-progress-bar') as HTMLElement | null;
        const countsEl = this.container.querySelector('.dz__overall-progress-counts') as HTMLElement | null;
        const percentEl = this.container.querySelector('.dz__overall-progress-percent') as HTMLElement | null;
        const actionsEl = this.container.querySelector('.dz__overall-progress-actions') as HTMLElement | null;

        // First render — install the whole structure.
        if (!fillEl || !countsEl || !percentEl || !actionsEl) {
            this.container.innerHTML = this.renderMarkup(overall, totalFileCount, pipelineActive);
            this.bindActionHandlers(this.container);
            this.container.dataset.dzButtonsSig = sig;
            return;
        }

        const pct = Math.round(overall.percent);
        fillEl.style.width = `${overall.percent}%`;
        barEl?.setAttribute('aria-valuenow', String(pct));
        countsEl.innerHTML = this.renderCountsInner(overall, totalFileCount);
        percentEl.textContent = `${pct}%`;

        // Only rebuild the actions group when the visible button set
        // crosses a threshold. Otherwise tick churn would unmount a
        // button while the user's finger was on it.
        if (this.container.dataset.dzButtonsSig !== sig) {
            actionsEl.innerHTML = this.renderActions(overall, pipelineActive);
            this.bindActionHandlers(actionsEl);
            this.container.dataset.dzButtonsSig = sig;
        }
    }

    private renderMarkup(o: OverallProgress, totalFileCount: number, pipelineActive: boolean): string {
        const pct = Math.round(o.percent);
        return `
            <div class="dz__overall-progress-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
                <div class="dz__overall-progress-fill" style="width: ${o.percent}%"></div>
            </div>
            <div class="dz__overall-progress-stats">
                <span class="dz__overall-progress-counts">${this.renderCountsInner(o, totalFileCount)}</span>
                <div class="dz__overall-progress-actions">${this.renderActions(o, pipelineActive)}</div>
                <span class="dz__overall-progress-percent">${pct}%</span>
            </div>
        `;
    }

    private renderCountsInner(o: OverallProgress, totalFileCount: number): string {
        const pausedSegment = o.pausedCount > 0
            ? ` · <span class="dz__overall-progress-paused">${escapeHtml(this.label('progressPaused', { count: o.pausedCount }))}</span>`
            : '';
        const failedSegment = o.failedCount > 0
            ? ` · <span class="dz__overall-progress-failed">${escapeHtml(this.label('progressFailed', { count: o.failedCount }))}</span>`
            : '';
        const counts = this.label('progressCounts', {
            completed: o.completedCount,
            total: totalFileCount,
            uploadedSize: formatFileSize(o.uploadedBytes),
            totalSize: formatFileSize(o.totalBytes)
        });
        return `${escapeHtml(counts)}${pausedSegment}${failedSegment}`;
    }

    private renderActions(o: OverallProgress, pipelineActive: boolean): string {
        // A disabled store (its `disabled` or a disabled `<fieldset>`) disables
        // the bulk buttons: no interaction, not focusable (core SPEC §6.4).
        const dis = this.store?.getConfig().isDisabled ? ' disabled' : '';
        const out: string[] = [];
        if (pipelineActive && o.uploadingCount > 0) {
            out.push(`<button type="button" class="dz__overall-progress-action" data-dz-action="pause-all"${dis}>${escapeHtml(this.label('pauseAll'))}</button>`);
        }
        if (pipelineActive && o.pausedCount > 0) {
            out.push(`<button type="button" class="dz__overall-progress-action" data-dz-action="resume-all"${dis}>${escapeHtml(this.label('resumeAll'))}</button>`);
        }
        // Cancel all — only while something is uploading / queued / paused.
        if (pipelineActive && o.uploadingCount + o.pendingCount + o.pausedCount > 0) {
            out.push(`<button type="button" class="dz__overall-progress-action" data-dz-action="cancel-all"${dis}>${escapeHtml(this.label('cancelAll'))}</button>`);
        }
        if (o.failedCount > 0) {
            out.push(`<button type="button" class="dz__overall-progress-action" data-dz-action="retry-all"${dis}>${escapeHtml(this.label('retryAll'))}</button>`);
        }
        return out.join('');
    }

    private overallActionsSignature(o: OverallProgress, pipelineActive: boolean): string {
        const p = pipelineActive && o.uploadingCount > 0 ? '1' : '0';
        const r = pipelineActive && o.pausedCount > 0 ? '1' : '0';
        const c = pipelineActive && o.uploadingCount + o.pendingCount + o.pausedCount > 0 ? '1' : '0';
        const e = o.failedCount > 0 ? '1' : '0';
        return `${p}${r}${c}${e}${this.store?.getConfig().isDisabled ? 'd' : ''}`;
    }

    private bindActionHandlers(root: ParentNode): void {
        if (!this.store) return;
        const store = this.store;
        root.querySelectorAll('[data-dz-action="retry-all"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                store.retryAll();
            });
        });
        root.querySelectorAll('[data-dz-action="pause-all"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                store.pauseAll();
            });
        });
        root.querySelectorAll('[data-dz-action="resume-all"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                void store.resumeAll();
            });
        });
        root.querySelectorAll('[data-dz-action="cancel-all"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                void store.cancelAll();
            });
        });
    }
}

/** Every input as a typed property (core usage "Typing the properties", rulebook C-CA-16). */
export interface DropzoneProgressElement extends SatelliteElementConfig {}
