/**
 * Shared row templates for the file list — used by both the satellite
 * `<web-dropzone-list>` and the convenience-form renderer inside
 * `<web-dropzone>`. Both surfaces emit identical DOM so the styles in
 * `_file-item.css` (icon box, info column, progress bar wrapper, slot-
 * reserving action button, status icon, remove button) light up in either.
 *
 * Why this module exists: the satellite originally hand-rolled its own
 * row HTML with subtly different class names (`__main` vs `__info`, no
 * `__progress-bar` wrapper, no slot reservation for the action button),
 * which silently dropped most of the styling. Keeping the templates here
 * means future tweaks land in one place and the compiler enforces the
 * shape for both callers.
 *
 * The popover/compact row (`<tr>` with `<td>` cells) is NOT shared — it
 * has a completely different DOM shape and only the convenience form
 * uses it. See `WebDropzone.renderCompactItem`.
 */

import {
    formatFileSize,
    getFileTypeCategory,
    getFileIcon,
    isImageFile,
    escapeHtml,
    STATUS_ICONS,
    ACTION_ICONS,
    CANCEL_ICON,
    actionForStatus,
    defaultLabel,
    fileStatusLabel
} from '@keenmate/web-dropzone-core';
import type { FileState, FileItemPart, FileIconOverrides, LabelFn, RowAction, FileStatus } from '@keenmate/web-dropzone-core';

/** The label key of a row action button (aria-label / tooltip, `{name}` = file). */
export const ACTION_LABEL_KEYS = { pause: 'pauseFile', resume: 'resumeFile', retry: 'retryFile' } as const satisfies Record<RowAction, string>;

/**
 * The tiny loader inside one item (a row's status pill, the summary icon): the
 * shared loader contract drawn by CSS only (`.dz__loader--inline`, the
 * `--dz-loader-inline-size` token) — no render hook, no `role="status"`; the
 * item carries `aria-busy` instead. Big loading states go through core
 * `renderLoader()` (the indicator chip).
 */
export const INLINE_LOADER = '<span class="dz__loader dz__loader--inline" aria-hidden="true"></span>';

/** A status glyph — the inline loader while uploading, the Lucide icon otherwise. */
export function statusGlyph(status: FileStatus): string {
    return status === 'uploading' ? INLINE_LOADER : STATUS_ICONS[status];
}

/** `aria-busy` for a row root while its file uploads. */
export function busyAttr(file: Pick<FileState, 'status'>): string {
    return file.status === 'uploading' ? ' aria-busy="true"' : '';
}

/** Status pill — glyph + the status name as tooltip / accessible name (`labels`). */
export function renderStatusPill(file: FileState, cls: string, label: LabelFn = defaultLabel): string {
    const name = escapeHtml(fileStatusLabel(label, file));
    const aria = escapeHtml(label('statusAria', { status: fileStatusLabel(label, file) }));
    return `<span class="${cls} ${cls}--${file.status}" title="${name}" aria-label="${aria}" data-status="${file.status}">${statusGlyph(file.status)}</span>`;
}

export { escapeHtml };

/**
 * Item-part visibility check. `parts` is the `itemControls` allowlist:
 * `undefined` means "no allowlist configured" → every part renders (the
 * default). Once set, only parts named in the set render. Parts an appearance
 * doesn't emit are moot — the template just never calls `showPart` for them.
 */
function showPart(parts: ReadonlySet<FileItemPart> | undefined, part: FileItemPart): boolean {
    return !parts || parts.has(part);
}

/**
 * Per-row knobs that vary between the convenience form and the satellite.
 * All optional — sensible defaults make the satellite (which doesn't need
 * the reorder / non-removable concepts yet) a one-argument call.
 */
export interface RowTemplateOptions {
    /**
     * Stamp `data-reorder-bucket="complete"` on the row so the flexbox
     * `order` rule can slide completed rows to the end of the list. Only
     * the convenience form uses this today (config-driven feature); the
     * satellite leaves it false.
     */
    reorderEligible?: boolean;
    /**
     * Whether the user can interactively remove this file. When false the
     * remove button is still rendered (column width stays reserved) but
     * stamped with the `--hidden` modifier (visibility: hidden + inert).
     * Defaults to true — the satellite doesn't expose the
     * `isUploadedFileRemovalAllowed` config yet, so removal is always allowed.
     */
    removable?: boolean;
    /**
     * Render an `<img>` of `file.previewUrl` when present (and the file is
     * an image), else fall back to the file-type emoji. Defaults to false
     * for list / detailed / badges (icon-only by convention) and true for
     * grid (image grid wants thumbnails by default).
     */
    useThumbnail?: boolean;
    /**
     * `itemControls` allowlist of per-row parts to render. `undefined` (the
     * default) renders every part; once set, only the named parts appear.
     * Filtered per-appearance by the templates — tokens an appearance doesn't
     * emit are simply never consulted.
     */
    parts?: ReadonlySet<FileItemPart>;
    /**
     * Consumer icon overrides (`fileIcons` map + `getFileIconCallback`) forwarded
     * to `getFileIcon`. A full `DropzoneConfig` satisfies this, so callers pass
     * their store config straight through. Absent → built-in category icons.
     */
    iconOverrides?: FileIconOverrides;
    /**
     * Prototype for the `getFileIconCallback` ctx — the store's context base
     * (`controller` / `element` getters), so the per-row ctx inherits them.
     */
    iconContext?: object;
    /**
     * Whether a file has an upload handler (store-level or per-file). A
     * queued (`pending`) file offers Cancel only then — in a plain picker
     * (no handler) every file stays `pending` and there is nothing to cancel.
     */
    hasUploadHandler?: boolean;
    /** `cancel-icon` — HTML for the Cancel glyph (default {@link CANCEL_ICON}). */
    cancelIcon?: string;
    /** `remove-icon` — HTML for the Remove glyph (default: the CSS-masked ✕). */
    removeIcon?: string;
    /** UI-string lookup (the store's `labels`); default: built-in English. */
    label?: LabelFn;
    /**
     * The store is disabled (its `disabled` or a disabled `<fieldset>`): every
     * row button (action / cancel / remove) is rendered `disabled` — no
     * interaction, not focusable (core SPEC §6.4 native semantics).
     */
    isDisabled?: boolean;
}

/**
 * Whether a row offers Cancel: uploading / paused (and `cancelling`, shown
 * disabled), plus queued files when an upload handler will run them.
 */
export function isCancelOffered(file: FileState, hasUploadHandler: boolean): boolean {
    const s = file.status;
    return s === 'uploading' || s === 'paused' || s === 'cancelling' || (s === 'pending' && hasUploadHandler);
}

/**
 * Per-row Cancel (⊘) button. Always in the DOM (the slot stays reserved —
 * `--hidden` when there is nothing to cancel); disabled while `cancelling`.
 * `baseClass` is the appearance's action-button class, so it shares that
 * button's styling; `data-dz-action="cancel"` identifies it.
 */
export function renderCancelButton(file: FileState, baseClass: string, opts: RowTemplateOptions = {}): string {
    const offered = isCancelOffered(file, opts.hasUploadHandler ?? false);
    const cls = offered ? `${baseClass} dz__cancel` : `${baseClass} dz__cancel ${baseClass}--hidden`;
    const inert = offered ? '' : ' tabindex="-1" aria-hidden="true"';
    const disabled = file.status === 'cancelling' || opts.isDisabled ? ' disabled' : '';
    const text = escapeHtml((opts.label ?? defaultLabel)('cancelFile', { name: file.name }));
    return `<button type="button" class="${cls}" data-dz-action="cancel" data-file-id="${file.id}" aria-label="${text}" title="${text}"${inert}${disabled}>${opts.cancelIcon || CANCEL_ICON}</button>`;
}

/**
 * Per-row Remove (✕) button — always rendered; `--hidden` (layout kept) when
 * the file isn't user-removable, disabled while `cancelling`. A `remove-icon`
 * replaces the CSS-masked glyph (`data-custom-icon` switches the mask off).
 */
export function renderRemoveButton(file: FileState, baseClass: string, removable = true, icon?: string, label: LabelFn = defaultLabel, isDisabled = false): string {
    const custom = icon ? ' data-custom-icon' : '';
    return `<button type="button" ${removeButtonAttrs(file, baseClass, removable, label, isDisabled)}${custom}>${icon ?? ''}</button>`;
}

/**
 * Inner content for the icon slot — `<img>` when thumbnail mode is on and
 * the file already has a preview URL, else the file-type emoji.
 */
export function renderPlaceholderInner(file: FileState, useThumbnail: boolean, iconOverrides?: FileIconOverrides, iconContext?: object): string {
    if (useThumbnail && file.previewUrl) {
        return `<img src="${file.previewUrl}" alt="">`;
    }
    return getFileIcon(file.file, iconOverrides, iconContext);
}

/**
 * Per-row action button (pause / resume / retry — see `actionForStatus`).
 * The slot is ALWAYS in the DOM so column widths stay reserved as state
 * transitions. When there's no applicable action (pending / complete) the
 * `--hidden` modifier hides the button visually and drops it from the tab
 * order.
 */
export function renderRowActionButton(file: FileState, baseClass: string, labelFn: LabelFn = defaultLabel, isDisabled = false): string {
    const action = actionForStatus(file.status);
    const hidden = !action;
    const cls = hidden ? `${baseClass} ${baseClass}--hidden` : baseClass;
    const inert = hidden ? ' tabindex="-1" aria-hidden="true"' : '';
    const label = action ? escapeHtml(labelFn(ACTION_LABEL_KEYS[action], { name: file.name })) : '';
    const title = label;
    const dataAction = action ?? '';
    const icon = action ? ACTION_ICONS[action] : '';
    return `<button type="button" class="${cls}" data-dz-action="row-action" data-row-action="${dataAction}" data-file-id="${file.id}" aria-label="${label}" title="${title}"${inert}${isDisabled ? ' disabled' : ''}>${icon}</button>`;
}

/**
 * Text next to a row's progress bar: the percent, or "Cancelling…" while a
 * cancel waits for the upload handler to settle.
 */
export function progressLabel(file: FileState, label: LabelFn = defaultLabel): string {
    return file.status === 'cancelling' ? label('cancelling') : `${file.progress.toFixed(1)}%`;
}

/**
 * Attribute block for the always-rendered remove button. Hidden buttons
 * stay in the DOM (layout reserved) but are inert.
 */
export function removeButtonAttrs(file: FileState, baseClass: string, removable = true, label: LabelFn = defaultLabel, isDisabled = false): string {
    const cls = removable ? baseClass : `${baseClass} ${baseClass}--hidden`;
    const inert = removable ? '' : ' tabindex="-1" aria-hidden="true"';
    // Disabled while a cancel is waiting for the handler to settle, or while the store is disabled.
    const disabled = file.status === 'cancelling' || isDisabled ? ' disabled' : '';
    return `class="${cls}" data-dz-action="remove" data-file-id="${file.id}" aria-label="${escapeHtml(label('removeFile', { name: file.name }))}"${inert}${disabled}`;
}

export function renderListItem(file: FileState, opts: RowTemplateOptions = {}): string {
    const reorderAttr = opts.reorderEligible ? ' data-reorder-bucket="complete"' : '';
    const removable = opts.removable !== false;
    const p = opts.parts;
    const label = opts.label ?? defaultLabel;
    return `
        <div class="dz__file-item dz__file-item--list" data-file-id="${file.id}" data-status="${file.status}"${reorderAttr}${busyAttr(file)}>
            ${showPart(p, 'name') ? `<span class="dz__file-item-name">${escapeHtml(file.name)}</span>` : ''}
            ${showPart(p, 'action') ? renderRowActionButton(file, 'dz__file-item-action', label, opts.isDisabled) : ''}
            ${showPart(p, 'cancel') ? renderCancelButton(file, 'dz__file-item-action', opts) : ''}
            ${showPart(p, 'progress') ? `<div class="dz__file-item-progress">
                <div class="dz__file-item-progress-bar">
                    <div class="dz__file-item-progress-fill" style="width: ${file.progress}%"></div>
                </div>
                <span class="dz__file-item-progress-text">${escapeHtml(progressLabel(file, label))}</span>
            </div>` : ''}
            ${showPart(p, 'status') ? renderStatusPill(file, 'dz__file-item-status', label) : ''}
            ${showPart(p, 'remove') ? renderRemoveButton(file, 'dz__file-item-remove', removable, opts.removeIcon, label, opts.isDisabled) : ''}
        </div>
    `;
}

export function renderDetailedItem(file: FileState, opts: RowTemplateOptions = {}): string {
    const category = getFileTypeCategory(file.file);
    const useThumbnail = opts.useThumbnail ?? false;
    const inner = renderPlaceholderInner(file, useThumbnail, opts.iconOverrides, opts.iconContext);
    const reorderAttr = opts.reorderEligible ? ' data-reorder-bucket="complete"' : '';
    const removable = opts.removable !== false;
    const p = opts.parts;
    const label = opts.label ?? defaultLabel;
    const showSize = showPart(p, 'size');
    const showType = showPart(p, 'type');
    const meta = (showSize || showType) ? `<div class="dz__file-item-meta">
                    ${showSize ? `<span class="dz__file-item-size">${formatFileSize(file.size)}</span>` : ''}
                    ${showType ? `<span class="dz__file-item-type">${escapeHtml(file.type || label('unknownType'))}</span>` : ''}
                </div>` : '';
    return `
        <div class="dz__file-item dz__file-item--detailed" data-file-id="${file.id}" data-status="${file.status}"${reorderAttr}${busyAttr(file)}>
            ${showPart(p, 'icon') ? `<div class="dz__file-item-icon dz__file-item-icon--${category}">${inner}</div>` : ''}
            <div class="dz__file-item-info">
                ${showPart(p, 'name') ? `<div class="dz__file-item-name">${escapeHtml(file.name)}</div>` : ''}
                ${meta}
                ${showPart(p, 'progress') ? `<div class="dz__file-item-progress">
                    <div class="dz__file-item-progress-bar">
                        <div class="dz__file-item-progress-fill" style="width: ${file.progress}%"></div>
                    </div>
                    <span class="dz__file-item-progress-text">${escapeHtml(progressLabel(file, label))}</span>
                </div>` : ''}
            </div>
            ${showPart(p, 'action') ? renderRowActionButton(file, 'dz__file-item-action', label, opts.isDisabled) : ''}
            ${showPart(p, 'cancel') ? renderCancelButton(file, 'dz__file-item-action', opts) : ''}
            ${showPart(p, 'status') ? renderStatusPill(file, 'dz__file-item-status', label) : ''}
            ${showPart(p, 'remove') ? renderRemoveButton(file, 'dz__file-item-remove', removable, opts.removeIcon, label, opts.isDisabled) : ''}
        </div>
    `;
}

export function renderGridItem(file: FileState, opts: RowTemplateOptions = {}): string {
    const isImage = isImageFile(file.file);
    const useThumbnail = opts.useThumbnail ?? true;
    const reorderAttr = opts.reorderEligible ? ' data-reorder-bucket="complete"' : '';
    const removable = opts.removable !== false;
    const p = opts.parts;
    const label = opts.label ?? defaultLabel;
    const inner = !showPart(p, 'icon')
        ? ''
        : isImage && useThumbnail && file.previewUrl
            ? `<img src="${file.previewUrl}" alt="${escapeHtml(file.name)}" class="dz__preview-item-image">`
            : `<div class="dz__preview-item-placeholder">${getFileIcon(file.file, opts.iconOverrides, opts.iconContext)}</div>`;
    const showName = showPart(p, 'name');
    const showAction = showPart(p, 'action');
    const showCancel = showPart(p, 'cancel');
    const showRemove = showPart(p, 'remove');
    return `
        <div class="dz__preview-item ${isImage ? 'dz__preview-item--image' : ''}" data-file-id="${file.id}" data-status="${file.status}"${reorderAttr}${busyAttr(file)}>
            ${inner}
            <div class="dz__preview-item-scrim" aria-hidden="true"></div>
            ${showName ? `<div class="dz__preview-item-overlay">
                <span class="dz__preview-item-name">${escapeHtml(file.name)}</span>
            </div>` : ''}
            ${showPart(p, 'status') ? renderStatusPill(file, 'dz__preview-item-status', label) : ''}
            ${showPart(p, 'progress') ? `<div class="dz__preview-item-progress-bar">
                <div class="dz__preview-item-progress-fill" style="width: ${file.progress}%"></div>
            </div>` : ''}
            ${(showAction || showCancel || showRemove) ? `<div class="dz__preview-item-hover-actions">
                ${showAction ? renderRowActionButton(file, 'dz__preview-item-action', label, opts.isDisabled) : ''}
                ${showCancel ? renderCancelButton(file, 'dz__preview-item-action', opts) : ''}
                ${showRemove ? renderRemoveButton(file, 'dz__preview-item-remove', removable, opts.removeIcon, label, opts.isDisabled) : ''}
            </div>` : ''}
        </div>
    `;
}

export function renderBadgeItem(file: FileState, opts: RowTemplateOptions = {}): string {
    const statusClass = file.status !== 'pending' ? `dz__badge--${file.status}` : '';
    const useThumbnail = opts.useThumbnail ?? false;
    const inner = renderPlaceholderInner(file, useThumbnail, opts.iconOverrides, opts.iconContext);
    const reorderAttr = opts.reorderEligible ? ' data-reorder-bucket="complete"' : '';
    const removable = opts.removable !== false;
    const p = opts.parts;
    const label = opts.label ?? defaultLabel;
    return `
        <span class="dz__badge ${statusClass}" data-file-id="${file.id}" data-status="${file.status}"${reorderAttr}${busyAttr(file)}>
            <span class="dz__badge-text" title="${escapeHtml(file.name)}">
                ${showPart(p, 'icon') ? `<span class="dz__badge-icon">${inner}</span>` : ''}
                ${showPart(p, 'name') ? `<span class="dz__badge-name">${escapeHtml(file.name)}</span>` : ''}
                ${showPart(p, 'action') ? renderRowActionButton(file, 'dz__badge-action', label, opts.isDisabled) : ''}
                ${showPart(p, 'cancel') ? renderCancelButton(file, 'dz__badge-action', opts) : ''}
                ${showPart(p, 'status') ? renderStatusPill(file, 'dz__badge-status', label) : ''}
            </span>
            ${showPart(p, 'remove') ? renderRemoveButton(file, 'dz__badge-remove', removable, opts.removeIcon, label, opts.isDisabled) : ''}
        </span>
    `;
}
