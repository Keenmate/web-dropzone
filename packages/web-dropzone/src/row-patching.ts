/**
 * In-place DOM patchers for row chrome — progress bar fill, percent text,
 * status icon, action button. Used by both the core store's render path
 * (`dropzone.ts`, list / detailed / grid / badges / popover modes) and the
 * standalone `<web-dropzone-list>` satellite. Same DOM shape on both sides,
 * so the patchers don't care which call site invoked them.
 *
 * Each helper takes a row (or button) element plus the CSS class that
 * identifies the slot to patch. The class is passed explicitly rather than
 * derived from the row because callers always know their own row kind
 * up-front (the satellite reads `resolveAppearance()`; the core reads
 * `resolveDisplayConfig(this.config)`). Keeping the class as a parameter
 * means the helpers stay pure functions of `(element, slot, value)` — no
 * branching on row type, easy to unit-test.
 *
 * The status-icon patcher unifies a previously-inconsistent path: the
 * satellite used to set only `title` while the core set both `title` AND
 * `aria-label`. The unified helper always sets both, so satellite-only
 * setups gain the same screen-reader announcement the core had.
 */

import {
    ACTION_ICONS,
    actionForStatus,
    defaultLabel,
    fileStatusLabel
} from '@keenmate/web-dropzone-core';
import type { FileState, LabelFn } from '@keenmate/web-dropzone-core';
import { progressLabel, isCancelOffered, ACTION_LABEL_KEYS, statusGlyph } from './row-templates';

/**
 * Set the progress-bar fill's width. Idempotent — assigning the same
 * percent twice is cheap (the browser short-circuits a no-op style write).
 */
export function patchProgressFill(
    row: HTMLElement,
    fillClass: string,
    percent: number
): void {
    const el = row.querySelector<HTMLElement>(`.${fillClass}`);
    if (el) el.style.width = `${percent}%`;
}

/**
 * Set the progress-text node's content — the rounded percent, or
 * "Cancelling…" while a cancel is pending (`progressLabel`). Used by
 * list / detailed / popover where a label sits next to the bar; grid omits
 * the text and only patches the fill.
 */
export function patchProgressText(
    row: HTMLElement,
    textClass: string,
    file: FileState,
    label: LabelFn = defaultLabel
): void {
    const el = row.querySelector(`.${textClass}`);
    if (el) el.textContent = progressLabel(file, label);
}

/**
 * Swap the status-icon slot's class modifier, glyph, and a11y labels when
 * the file's status changes. Gated on `dataset.status` so a 50 ms upload
 * tick with no status change is a no-op (avoids re-injecting SVG strings
 * each frame).
 */
export function patchStatusIcon(
    row: HTMLElement,
    statusClass: string,
    file: FileState,
    label: LabelFn = defaultLabel
): void {
    const status = file.status;
    // The row is busy while its file uploads (the inline loader has no role="status").
    if (status === 'uploading') row.setAttribute('aria-busy', 'true');
    else row.removeAttribute('aria-busy');
    const el = row.querySelector<HTMLElement>(`.${statusClass}`);
    if (!el || el.dataset.status === status) return;
    el.dataset.status = status;
    el.className = `${statusClass} ${statusClass}--${status}`;
    const name = fileStatusLabel(label, file);
    el.title = name;
    el.setAttribute('aria-label', label('statusAria', { status: name }));
    el.innerHTML = statusGlyph(status);
}

/**
 * Show / hide a row's remove button (`removable` false: the `--hidden`
 * modifier, out of the tab order, hidden from AT). The button stays in the
 * DOM so the row's layout doesn't shift.
 */
export function patchRemoveButton(
    btn: HTMLElement | null,
    removable: boolean,
    baseClass: string,
    isCancelling = false,
    isDisabled = false
): void {
    if (!btn) return;
    (btn as HTMLButtonElement).disabled = isCancelling || isDisabled;
    btn.classList.toggle(`${baseClass}--hidden`, !removable);
    if (removable) {
        btn.removeAttribute('tabindex');
        btn.removeAttribute('aria-hidden');
    } else {
        btn.setAttribute('tabindex', '-1');
        btn.setAttribute('aria-hidden', 'true');
    }
}

/**
 * In-place patch the per-row Cancel button: `--hidden` (inert) when there is
 * nothing to cancel, disabled while `cancelling` or while the store is disabled.
 */
export function patchCancelButton(
    btn: HTMLElement | null,
    file: FileState,
    baseClass: string,
    hasUploadHandler: boolean,
    isDisabled = false
): void {
    if (!btn) return;
    const offered = isCancelOffered(file, hasUploadHandler);
    btn.classList.toggle(`${baseClass}--hidden`, !offered);
    if (offered) {
        btn.removeAttribute('tabindex');
        btn.removeAttribute('aria-hidden');
    } else {
        btn.setAttribute('tabindex', '-1');
        btn.setAttribute('aria-hidden', 'true');
    }
    (btn as HTMLButtonElement).disabled = file.status === 'cancelling' || isDisabled;
}

/**
 * In-place patch the per-row action button (pause / resume / retry) as the
 * file's status transitions. Slot stays in the DOM at all times so column
 * widths don't shift across status changes; this function toggles the
 * `--hidden` modifier and swaps the glyph + a11y attributes when the
 * applicable action changes. Gated on `dataset.rowAction` so the live
 * button isn't disrupted while a user click is in flight between ticks.
 */
export function patchActionButton(
    btn: HTMLElement | null,
    file: FileState,
    baseClass: string,
    label: LabelFn = defaultLabel
): void {
    if (!btn) return;
    const action = actionForStatus(file.status);
    const current = btn.dataset.rowAction || '';
    const target = action ?? '';
    if (current === target) return;

    btn.dataset.rowAction = target;
    const hidden = !action;
    btn.className = hidden ? `${baseClass} ${baseClass}--hidden` : baseClass;
    btn.innerHTML = action ? ACTION_ICONS[action] : '';

    if (action) {
        const text = label(ACTION_LABEL_KEYS[action], { name: file.name });
        btn.setAttribute('aria-label', text);
        btn.title = text;
        btn.removeAttribute('tabindex');
        btn.removeAttribute('aria-hidden');
    } else {
        btn.setAttribute('aria-label', '');
        btn.title = '';
        btn.tabIndex = -1;
        btn.setAttribute('aria-hidden', 'true');
    }
}

/**
 * Re-sync a kept row's action / cancel / remove buttons with the store's
 * disabled state (a row that survives a config re-render — the rolling front
 * row). Disabled store → all three `disabled` (core SPEC §6.4); cancel /
 * remove also stay disabled while the file is `cancelling`.
 */
export function syncRowButtonsDisabled(row: ParentNode, file: FileState, isDisabled: boolean): void {
    row.querySelectorAll<HTMLButtonElement>('[data-dz-action="row-action"]').forEach((btn) => { btn.disabled = isDisabled; });
    row.querySelectorAll<HTMLButtonElement>('[data-dz-action="cancel"], [data-dz-action="remove"]').forEach((btn) => {
        btn.disabled = isDisabled || file.status === 'cancelling';
    });
}
