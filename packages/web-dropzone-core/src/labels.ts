/**
 * UI strings — the `labels` input (KeenMate cross-component i18n model).
 *
 * Every user-visible string the dropzone renders by itself comes from ONE
 * lookup, {@link resolveLabel}: the element's `labels` overrides (a partial
 * object, merged per key) → the built-in English {@link DEFAULT_LABELS}.
 * Placeholders in `{braces}` (`{name}`, `{count}`, `{status}`) are filled
 * from the call's `vars`.
 *
 * Seam for page-wide localisation: a future web-components-core `/locale`
 * layer slots in between the element overrides and the defaults inside
 * `resolveLabel` — callers don't change.
 */

import type { FileState, FileStatus } from './types';

/** Every UI string `<web-dropzone>` and its satellites render by themselves. */
export interface DropzoneLabels {
    /** Card prompt; also the accessible name of the card / minimal selectors. */
    prompt: string;
    /** Secondary hint under the prompt. Empty = none on the card; the popover then derives a limits line. */
    hint: string;
    /** Card text while a drag is over it. */
    dragActive: string;
    /** Browse / select-files action (button + native selectors, big card). */
    selectFiles: string;
    /** Native selector text when nothing is chosen. */
    noFileChosen: string;
    /** Drag-overlay text (`overlay-target`). */
    overlay: string;

    /** Status names — the per-row status pill's tooltip / accessible name. */
    statusPending: string;
    statusUploading: string;
    statusPaused: string;
    statusCancelling: string;
    statusComplete: string;
    statusError: string;
    statusCancelled: string;
    /** Status pill accessible name; `{status}` is one of the status names. */
    statusAria: string;
    /** Status of an `error` file whose cancel timed out (`file.error === 'cancel-timeout'`). */
    cancelTimeout: string;
    /** Text next to the progress bar while a cancel waits for the handler. */
    cancelling: string;

    /** Row buttons (`{name}` = the file name) — accessible name + tooltip. */
    pauseFile: string;
    resumeFile: string;
    retryFile: string;
    cancelFile: string;
    removeFile: string;

    /** Bulk actions in the overall-progress strip. */
    pauseAll: string;
    resumeAll: string;
    retryAll: string;
    cancelAll: string;
}

export type DropzoneLabelKey = keyof DropzoneLabels;

/** Built-in English strings. */
export const DEFAULT_LABELS: Readonly<DropzoneLabels> = Object.freeze({
    prompt: 'Drop files here or click to browse',
    hint: '',
    dragActive: 'Drop files here',
    selectFiles: 'Select files',
    noFileChosen: 'No file chosen',
    overlay: 'Drop files here',

    statusPending: 'Pending',
    statusUploading: 'Uploading',
    statusPaused: 'Paused',
    statusCancelling: 'Cancelling…',
    statusComplete: 'Complete',
    statusError: 'Error',
    statusCancelled: 'Cancelled',
    statusAria: 'Status: {status}',
    cancelTimeout: 'Cancel timed out',
    cancelling: 'Cancelling…',

    pauseFile: 'Pause {name}',
    resumeFile: 'Resume {name}',
    retryFile: 'Retry {name}',
    cancelFile: 'Cancel {name}',
    removeFile: 'Remove {name}',

    pauseAll: 'Pause all',
    resumeAll: 'Resume all',
    retryAll: 'Retry all',
    cancelAll: 'Cancel all'
});

/** Placeholder values for {@link resolveLabel}. */
export type LabelVars = Readonly<Record<string, string | number>>;

/** A bound label lookup — `(key, vars) => string`. */
export type LabelFn = (key: DropzoneLabelKey, vars?: LabelVars) => string;

/**
 * THE label lookup: `overrides[key]` (the element's `labels`) → (future:
 * page-wide `/locale`) → {@link DEFAULT_LABELS}; then `{placeholder}`s are
 * filled from `vars` (unknown placeholders are left as written).
 */
export function resolveLabel(
    overrides: Partial<DropzoneLabels> | null | undefined,
    key: DropzoneLabelKey,
    vars?: LabelVars
): string {
    const own = overrides?.[key];
    const template = typeof own === 'string' ? own : DEFAULT_LABELS[key];
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match);
}

/** Bind {@link resolveLabel} to a labels source (read on every call, so live changes apply). */
export function createLabelFn(getOverrides: () => Partial<DropzoneLabels> | null | undefined): LabelFn {
    return (key, vars) => resolveLabel(getOverrides(), key, vars);
}

/** The built-in English lookup (no overrides). */
export const defaultLabel: LabelFn = (key, vars) => resolveLabel(undefined, key, vars);

const STATUS_KEYS: Record<FileStatus, DropzoneLabelKey> = {
    pending: 'statusPending',
    uploading: 'statusUploading',
    paused: 'statusPaused',
    cancelling: 'statusCancelling',
    complete: 'statusComplete',
    error: 'statusError',
    cancelled: 'statusCancelled'
};

/** The status name of a status (aggregate surfaces have no file). */
export function statusLabel(label: LabelFn, status: FileStatus): string {
    return label(STATUS_KEYS[status]);
}

/** The status name shown for a file — a timed-out cancel reads "Cancel timed out". */
export function fileStatusLabel(label: LabelFn, file: Pick<FileState, 'status' | 'error'>): string {
    if (file.status === 'error' && file.error === 'cancel-timeout') return label('cancelTimeout');
    return statusLabel(label, file.status);
}

/** Is `value` an acceptable `labels` value (a plain object of strings)? */
export function isLabelsValue(value: unknown): value is Partial<DropzoneLabels> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.values(value as Record<string, unknown>).every(v => typeof v === 'string');
}
