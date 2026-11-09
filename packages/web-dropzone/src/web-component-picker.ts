/**
 * `<web-dropzone-picker for="<store-id>">` — satellite renderer.
 *
 * The picker is a file selector (card / button / minimal appearance) that
 * pushes files into a separate `<web-dropzone>` store via `addFiles`. It
 * never stores files itself; it only collects them from user interaction
 * (drag-drop, click → native file dialog) and routes them.
 *
 * Its own `disabled` / `readonly` (native semantics, core SPEC §6.4) add to
 * the bound store's: the picker can't add files while either is disabled or
 * read-only; only a disable greys it out.
 *
 * Mode B per-picker upload binding (see ARCHITECTURE.md): if the picker has
 * `uploadFileCallback` and/or `uploadMetadata` JS properties set, those are
 * stamped onto every FileState the picker contributes. The store's upload
 * loop then uses each file's stamped handler instead of the store-level
 * one — so two pickers bound to the same store can route to different
 * endpoints / buckets / tenants while sharing a single queue + list.
 */

import styles from './css/main.css?inline';
import { adoptStyles, toBool, toEnum, toFunction, toText, toValue, type InputDef } from '@keenmate/web-components-core';
import {
    SatelliteElement,
    SATELLITE_INPUTS,
    subscribeStoreEvents,
    type SatelliteElementConfig
} from './satellite-base';
import { escapeHtml, UI_ICONS } from '@keenmate/web-dropzone-core';
import { subscribePageFileDrag, isPageFileDragActive, applyArmedState } from './page-file-drag';
import type { DropzoneElement } from './web-component';
import type {
    SelectorAppearance,
    CardSize,
    FileUploadHandler
} from '@keenmate/web-dropzone-core';

const SELECTOR_APPEARANCES = ['card', 'button', 'minimal', 'native'] as const;
const CARD_SIZES = ['minimal', 'compact', 'big'] as const;

const DEFAULT_ICON = UI_ICONS.cloudUpload;

/**
 * `<web-dropzone-picker>` inputs. `null` on `accept` / `multiple` / `icon` /
 * `highlight-on-page-drag` means "not set": the bound store's value applies.
 */
const INPUTS: readonly InputDef[] = [
    ...SATELLITE_INPUTS,
    { configKey: 'selectorAppearance', attribute: 'selector-appearance', converter: toEnum(SELECTOR_APPEARANCES, { default: 'card' }), shouldReflect: true, on: 'update', description: 'Selector appearance: card (drop area), button, minimal (icon button) or native (file-input look).' },
    { configKey: 'cardSize', attribute: 'card-size', converter: toEnum(CARD_SIZES, { default: 'compact' }), shouldReflect: true, on: 'update', description: 'Card size for the card appearance.' },
    { configKey: 'accept', attribute: 'accept', converter: toText({ isNullable: true }), shouldReflect: true, on: 'update', description: 'Accepted file types for this picker\'s file dialog. Unset = the bound store\'s `accept` (the store validates every file either way).' },
    { configKey: 'isMultiple', attribute: 'multiple', converter: toBool('tristate'), on: 'update', type: 'boolean | null', description: 'Allow choosing several files in the dialog. Unset = the bound store\'s `multiple`.' },
    { configKey: 'icon', attribute: 'icon', converter: toText({ isNullable: true }), shouldReflect: true, on: 'update', description: 'Prompt icon (raw HTML — NOT sanitized). Unset = the bound store\'s `icon`, else the built-in upload icon.' },
    { configKey: 'isDisabled', attribute: 'disabled', converter: toBool('presence'), shouldReflect: true, on: 'update', type: 'boolean', description: 'Disable this picker (like a native control: no clicks / drops, not focusable, greyed). A disabled store disables it too.' },
    { configKey: 'isReadonly', attribute: 'readonly', converter: toBool('presence'), shouldReflect: true, on: 'update', type: 'boolean', description: 'Read-only (like a native control): this picker adds no files, but stays visible and focusable. A read-only store makes it read-only too.' },
    { configKey: 'isFilesInside', attribute: 'inside', converter: toBool('default-false'), on: 'update', type: 'boolean', description: 'Files-inside layout: the card slots its light-DOM children (a `<web-dropzone-list nested>`) below the prompt. Set by the store when it mounts the picker itself.' },
    { configKey: 'shouldHighlightOnPageDrag', attribute: 'highlight-on-page-drag', converter: toBool('tristate'), on: 'update', type: 'boolean | null', description: 'Arm the picker while files are dragged anywhere over the page (`armed` attribute + `:state(armed)`). Unset = the bound store\'s `highlight-on-page-drag`.' },
    { configKey: 'uploadFileCallback', converter: toFunction(), on: 'none', type: 'FileUploadHandler | null', description: 'Mode B: upload handler stamped onto every file this picker adds (wins over the store\'s `uploadFileCallback` for those files).' },
    { configKey: 'uploadMetadata', converter: toValue(), on: 'none', type: 'Record<string, unknown> | null', description: 'Mode B: metadata stamped onto every file this picker adds (`ctx.uploadMetadata` in the upload handler).' },
];

/** Every `<web-dropzone-picker>` input, keyed by `configKey` (its typed properties). */
export interface DropzonePickerElementConfig extends SatelliteElementConfig {
    selectorAppearance?: SelectorAppearance;
    cardSize?: CardSize;
    accept?: string | null;
    isMultiple?: boolean | null;
    icon?: string | null;
    isDisabled?: boolean;
    isReadonly?: boolean;
    isFilesInside?: boolean;
    shouldHighlightOnPageDrag?: boolean | null;
    uploadFileCallback?: FileUploadHandler | null;
    uploadMetadata?: Record<string, unknown> | null;
}

export class DropzonePickerElement extends SatelliteElement {
    protected static override inputs = INPUTS;
    protected readonly satelliteTagName = 'web-dropzone-picker';
    private shadow: ShadowRoot;
    private container: HTMLElement;
    private inputEl: HTMLInputElement | null = null;
    private dragActive = false;
    private dragCounter = 0;
    /** Unsubscribe from the shared page-drag tracker (set while `highlight-on-page-drag` is live). */
    private unsubscribePageDrag: (() => void) | null = null;
    private isArmedState = false;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });

        // Reuse the store's CSS so picker chrome (`dz__dropzone--card`,
        // `dz__button`, `dz__minimal`) renders identically across both
        // the convenience-form picker (inside <web-dropzone>) and the
        // satellite — one constructed sheet shared by every instance.
        adoptStyles(this.shadow, styles);

        this.container = document.createElement('div');
        this.container.className = 'dz__host';
        this.shadow.appendChild(this.container);
    }

    /** An own input changed (core `update()`): re-render. */
    protected override inputsChanged(): void {
        if (this.store) this.render();
    }

    /** Core reports a flip of the picker's own `disabled`. */
    protected override disabledChanged(): void {
        if (this.store) this.render();
    }

    /**
     * Subscribe to store events that affect the picker's surface — file
     * count changes drive the count badge on the button / minimal variants,
     * so we need to re-render when the underlying selection changes.
     * Card variant doesn't show a badge but still re-renders cheaply
     * (small DOM, debouncing isn't worth the complexity here).
     */
    protected attachStoreSubscriptions(storeEl: DropzoneElement): () => void {
        return subscribeStoreEvents(storeEl, {
            'file-add':   () => this.render(),
            'file-remove': () => this.render(),
            'change':       () => this.render(),
            // Config re-render (e.g. accept / multiple / disabled changed).
            'dz-config-changed': () => this.render()
        });
    }

    protected onStoreReady(): void {
        this.render();
        this.wireDragResetSafetyNet();
    }

    protected override deactivated(): void {
        document.removeEventListener('drop', this.handleDocReset);
        document.removeEventListener('dragend', this.handleDocReset);
        this.dragActive = false;
        this.dragCounter = 0;
        this.syncPageDrag();
    }

    /**
     * True while the picker is armed (`highlight-on-page-drag` + files are
     * dragged over the page + it accepts drops). Mirrors the `armed` attribute
     * / `:state(armed)`.
     */
    get isArmed(): boolean {
        return this.isArmedState;
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    private render(): void {
        if (!this.store) return;

        const appearance = this.resolveSelectorAppearance();
        const cardSize = this.resolveCardSize();
        // Native semantics (core SPEC §6.4): disabled → `disabled` (not
        // focusable); read-only → focusable, `aria-disabled` (adds nothing).
        const controlAttrs = this.isOwnOrStoreDisabled()
            ? 'disabled'
            : this.isAddBlocked() ? 'aria-disabled="true"' : '';
        const isReadonly = !!this.config.isReadonly || !!this.store.getConfig().isReadonly;
        // `disabled` (= can't add) covers readonly too; only a real disable greys the surface.
        const stateClass = this.isOwnOrStoreDisabled()
            ? 'dz__dropzone--disabled'
            : isReadonly ? 'dz__dropzone--readonly' : '';
        const storeCfg = this.store.getConfig();

        const acceptAttr = (this.config.accept as string | null) ?? storeCfg.accept ?? '';
        const multipleAttr = (this.config.isMultiple as boolean | null) ?? storeCfg.isMultiple ?? true;
        const label = this.label('selectFiles');
        const icon = (this.config.icon as string | null) ?? storeCfg.icon ?? DEFAULT_ICON;
        const hint = this.label('hint');

        // Card: the hidden input IS the keyboard control — name it after the
        // prompt (not the transient drag text). Button / minimal / native
        // render their own <button>, so the input leaves the tab order (one
        // tab stop per selector).
        const promptText = this.label('prompt');
        const inputA11yAttrs = appearance === 'card'
            ? `aria-label="${escapeHtml(promptText)}"`
            : 'tabindex="-1" aria-hidden="true"';

        const inputHtml = `
            <input type="file"
                class="dz__dropzone-input"
                ${inputA11yAttrs}
                ${multipleAttr ? 'multiple' : ''}
                ${acceptAttr ? `accept="${escapeHtml(acceptAttr)}"` : ''}
                ${controlAttrs}
            >
        `;

        // File count drives the button / minimal count badge — mirrors the
        // legacy in-class renderer so the convenience form (which mounts
        // this satellite internally) keeps its count chip on those selectors.
        const fileCount = this.store.getFiles().length;
        const countBadge = fileCount > 0
            ? `<span class="dz__button-badge">${fileCount}</span>`
            : '';
        const minimalBadge = fileCount > 0
            ? `<span class="dz__minimal-badge">${fileCount}</span>`
            : '';

        let inner = '';
        if (appearance === 'button') {
            inner = `
                <div class="dz__dropzone dz__dropzone--button ${stateClass}">
                    ${inputHtml}
                    <button type="button" class="dz__button" ${controlAttrs}>
                        <span class="dz__button-label">${escapeHtml(label)}</span>
                        ${countBadge}
                    </button>
                </div>
            `;
        } else if (appearance === 'minimal') {
            const ariaLabel = promptText;
            inner = `
                <div class="dz__dropzone dz__dropzone--minimal ${stateClass}">
                    ${inputHtml}
                    <button type="button" class="dz__minimal" aria-label="${escapeHtml(ariaLabel)}" ${controlAttrs}>
                        <span class="dz__minimal-icon">${icon}</span>
                        ${minimalBadge}
                    </button>
                </div>
            `;
        } else if (appearance === 'native') {
            const noFileText = this.label('noFileChosen');
            const files = this.store.getFiles();
            const labelText = files.length === 0
                ? noFileText
                : files.length === 1
                    ? files[0].name
                    : this.label('filesChosen', { count: files.length });
            inner = `
                <div class="dz__dropzone dz__dropzone--native ${stateClass}">
                    ${inputHtml}
                    <button type="button" class="dz__native-button" ${controlAttrs}>${escapeHtml(label)}</button>
                    <span class="dz__native-label" title="${escapeHtml(labelText)}">${escapeHtml(labelText)}</span>
                </div>
            `;
        } else {
            // card
            const text = this.dragActive
                ? this.label('dragActive')
                : promptText;
            const hintHtml = hint
                ? `<div class="dz__dropzone-hint">${escapeHtml(hint)}</div>`
                : '';
            const browseBtn = cardSize === 'big'
                ? `<button type="button" class="dz__card-action">${escapeHtml(label)}</button>`
                : '';
            // `inside="true"` enables the files-inside layout — the file
            // list satellite slots into the card via the `<slot>` below,
            // and `dz__dropzone--has-files` flips on so the picker's
            // existing CSS (margin between prompt and list) kicks in.
            const insideMode = !!this.config.isFilesInside;
            const hasFiles = insideMode && fileCount > 0;
            const classes = [
                'dz__dropzone',
                'dz__dropzone--card',
                `dz__dropzone--card-${cardSize}`,
                stateClass,
                this.dragActive ? 'dz__dropzone--active' : '',
                insideMode ? 'dz__dropzone--files-inside' : '',
                hasFiles ? 'dz__dropzone--has-files' : ''
            ].filter(Boolean).join(' ');
            const slotHtml = insideMode ? '<slot></slot>' : '';
            inner = `
                <div class="${classes}">
                    ${inputHtml}
                    <div class="dz__dropzone-content">
                        <div class="dz__dropzone-icon">${icon}</div>
                        <div class="dz__dropzone-text">${escapeHtml(text)}</div>
                        ${browseBtn}
                        ${hintHtml}
                    </div>
                    ${slotHtml}
                </div>
            `;
        }

        this.container.innerHTML = inner;
        this.inputEl = this.container.querySelector('input.dz__dropzone-input');
        this.attachInteractionHandlers();
        this.syncPageDrag();
    }

    // ========================================================================
    // ARMED (highlight-on-page-drag)
    // ========================================================================

    /** Own `highlight-on-page-drag` wins; unset → the bound store's setting. */
    private isPageDragHighlighted(): boolean {
        const own = this.config.shouldHighlightOnPageDrag as boolean | null;
        return own ?? !!this.store?.getConfig().shouldHighlightOnPageDrag;
    }

    /** Join / leave the shared page-drag tracker (one page listener set for every instance). */
    private syncPageDrag(): void {
        const shouldTrack = this.isConnected && !!this.store && this.isPageDragHighlighted();
        if (shouldTrack && !this.unsubscribePageDrag) {
            this.unsubscribePageDrag = subscribePageFileDrag(() => this.syncArmed());
        } else if (!shouldTrack && this.unsubscribePageDrag) {
            this.unsubscribePageDrag();
            this.unsubscribePageDrag = null;
        }
        this.syncArmed();
    }

    /** Armed = tracking + a file drag over the page + the picker accepts drops. */
    private syncArmed(): void {
        const isArmed = !!this.unsubscribePageDrag && isPageFileDragActive() && !this.isAddBlocked();
        if (isArmed === this.isArmedState) return;
        this.isArmedState = isArmed;
        applyArmedState(this, this.internals, isArmed);
    }

    /**
     * Open the native file dialog, as a click on the picker would. No-op while
     * disabled or before the picker has rendered (not bound to a store yet).
     */
    openFileDialog(): void {
        if (this.isAddBlocked()) return;
        this.inputEl?.click();
    }

    // ========================================================================
    // ATTRIBUTE RESOLUTION
    // ========================================================================

    private resolveSelectorAppearance(): SelectorAppearance {
        return this.config.selectorAppearance as SelectorAppearance;
    }

    private resolveCardSize(): CardSize {
        return this.config.cardSize as CardSize;
    }

    /** Disabled by its own `disabled` or the store's (not counting `readonly`). */
    private isOwnOrStoreDisabled(): boolean {
        return this.isEffectivelyDisabled || !!this.store?.getConfig().isDisabled;
    }

    /** The picker can't add files: disabled, or it / the store is read-only. */
    private isAddBlocked(): boolean {
        return this.isOwnOrStoreDisabled() || !!this.config.isReadonly || !!this.store?.getConfig().isReadonly;
    }

    // ========================================================================
    // INTERACTION
    // ========================================================================

    private attachInteractionHandlers(): void {
        const dropZone = this.container.querySelector('.dz__dropzone') as HTMLElement | null;
        if (!dropZone) return;

        // File picker dialog opens for any click in the drop zone. Stop the
        // `input.change` from bubbling into the same handler twice — we
        // listen to it explicitly below.
        dropZone.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            // A click ON the input (pointer, or Enter / Space on the focused
            // read-only card input) opens the dialog unless adding is blocked:
            // cancelling the click cancels the dialog.
            if (target.tagName === 'INPUT') {
                if (this.isAddBlocked()) e.preventDefault();
                return;
            }
            if (this.isAddBlocked()) return;
            this.inputEl?.click();
        });

        if (this.inputEl) {
            this.inputEl.addEventListener('change', () => {
                const files = this.inputEl?.files;
                if (files && files.length > 0) {
                    this.contributeFiles(Array.from(files));
                }
                // Reset the input so the same file can be picked again.
                if (this.inputEl) this.inputEl.value = '';
            });
        }

        // Drag/drop on the picker itself. The card surface visualizes
        // `dragActive`; button + minimal accept drops but don't show the
        // overlay (the existing `--active` modifier is card-only by design).
        dropZone.addEventListener('dragover', (e) => {
            if (this.isAddBlocked()) return;
            e.preventDefault();
            e.stopPropagation();
        });
        // The card highlight is scoped to THIS picker's surface via an
        // enter/leave depth counter (children fire their own enter/leave, so a
        // plain boolean would flicker). Previously the highlight was driven by
        // document-level drag events, which lit up EVERY picker on the page at
        // once — dragging over one bucket highlighted all of them.
        dropZone.addEventListener('dragenter', (e) => {
            if (this.isAddBlocked()) return;
            e.preventDefault();
            e.stopPropagation();
            if (!e.dataTransfer?.types.includes('Files')) return;
            this.dragCounter++;
            this.setDragActive(true);
        });
        dropZone.addEventListener('dragleave', (e) => {
            if (this.isAddBlocked()) return;
            e.stopPropagation();
            this.dragCounter = Math.max(0, this.dragCounter - 1);
            if (this.dragCounter === 0) this.setDragActive(false);
        });
        dropZone.addEventListener('drop', (e) => {
            if (this.isAddBlocked()) return;
            e.preventDefault();
            e.stopPropagation();
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                this.contributeFiles(Array.from(files));
            }
            this.setDragActive(false);
            this.dragCounter = 0;
        });
    }

    /**
     * Safety net for the per-picker highlight: a drag that ends or is dropped
     * OUTSIDE this picker won't always fire our element-level `dragleave`
     * (browsers are inconsistent when the drag terminates off-target), so reset
     * defensively on any document-level drop / dragend. This does NOT activate
     * the highlight — that is scoped to the picker's own surface (see
     * `attachInteractionHandlers`); activating here is what used to light up
     * every picker on the page at once.
     */
    private wireDragResetSafetyNet(): void {
        document.addEventListener('drop', this.handleDocReset);
        document.addEventListener('dragend', this.handleDocReset);
    }

    private handleDocReset = (): void => {
        this.dragCounter = 0;
        this.setDragActive(false);
    };

    private setDragActive(active: boolean): void {
        if (this.dragActive === active) return;
        this.dragActive = active;
        // Only the card variant visualizes drag state (button / minimal don't).
        if (this.resolveSelectorAppearance() !== 'card') return;
        // Update the live DOM in place rather than re-rendering: rebuilding the
        // drop target mid-drag destroys the element the pointer is over, which
        // breaks the drag sequence and the enter/leave counter.
        const dz = this.container.querySelector('.dz__dropzone--card') as HTMLElement | null;
        if (!dz) { this.render(); return; }
        dz.classList.toggle('dz__dropzone--active', active);
        const textEl = dz.querySelector('.dz__dropzone-text');
        if (textEl) {
            textEl.textContent = active
                ? this.label('dragActive')
                : this.label('prompt');
        }
    }

    /**
     * Push collected files into the bound store, stamping per-picker Mode B
     * routing (uploadFileCallback / uploadMetadata) if either was set on this
     * element. The store applies its own validation, dedupe, and caps —
     * the picker never rejects files itself.
     */
    private contributeFiles(files: File[]): void {
        if (!this.store) return;
        const opts: { uploadFileCallback?: FileUploadHandler; uploadMetadata?: Record<string, unknown> } = {};
        const uploadFileCallback = this.config.uploadFileCallback as FileUploadHandler | null;
        const uploadMetadata = this.config.uploadMetadata as Record<string, unknown> | null;
        if (uploadFileCallback) opts.uploadFileCallback = uploadFileCallback;
        if (uploadMetadata) opts.uploadMetadata = uploadMetadata;
        this.store.addFiles(files, opts);
    }
}

/** Every input as a typed property (core usage "Typing the properties", rulebook C-CA-16). */
export interface DropzonePickerElement extends DropzonePickerElementConfig {}
