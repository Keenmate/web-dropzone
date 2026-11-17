/**
 * UI strings — the `labels` input (Keenmate cross-component i18n model).
 *
 * Every user-visible string the dropzone renders by itself comes from ONE
 * lookup, core `/locale` (SPEC §12.24): the element's `labels` overrides (a
 * partial object, merged per key; a satellite: its own, the page-wide labels of
 * its own tag, then its store's) → the page-wide
 * `window.components.locale.labels['web-dropzone']` → the built-in English
 * {@link DEFAULT_LABELS}. Placeholders in `{braces}` (`{name}`, `{count}`,
 * `{status}`) are filled from the call's `vars` — or by the page's
 * `formatLabelCallback` (ICU / i18next). Labels are TEXT: every renderer
 * escapes them where it builds HTML.
 */

import { createLabels, formatLabel, getPageLocale, resolveLabel as resolveCoreLabel, type Labels } from '@keenmate/web-components-core/locale';
import type { FileState, FileStatus } from './types';

/** The tag the page-wide labels of the whole dropzone family are keyed by. */
export const LABELS_TAG = 'web-dropzone';

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

    /** Empty file list. */
    noData: string;
    /** Compact summary line (`{count}`, `{size}` = total size). */
    summary: string;
    /** Accessible name of the compact summary line (opens the popover). */
    viewFiles: string;
    /** Native selector text for 2+ files (`{count}`). */
    filesChosen: string;
    /** File count (`{count}`); `fileCountOne` for exactly one. Popover header + footer. */
    fileCount: string;
    fileCountOne: string;
    /** Popover header buttons. */
    addMore: string;
    clearAll: string;
    /** List cap toggle (`max-visible-file-count`): `{count}` = hidden rows. */
    showMore: string;
    showLess: string;
    /** Rolling list queue button — accessible name + tooltip (`{count}`). */
    showQueue: string;
    /** Type column fallback for a file without a MIME type. */
    unknownType: string;

    /** Popover limits line parts (auto-derived when `hint` is empty), joined with " · ". `{size}` / `{count}` = the limit. */
    limitMaxFileSize: string;
    limitMinFileSize: string;
    limitMaxTotalSize: string;
    /** `{left}` = remaining size. */
    limitMaxTotalSizeLeft: string;
    limitMaxFileCount: string;
    /** `{left}` = remaining slots. */
    limitMaxFileCountLeft: string;
    limitMinFileCount: string;

    /** Overall-progress strip: `{completed}`, `{total}`, `{uploadedSize}`, `{totalSize}`; paused / failed segments `{count}`. */
    progressCounts: string;
    progressPaused: string;
    progressFailed: string;

    /** `<web-dropzone-indicator>`: drawer title, idle chip text, chip / drawer accessible names, drawer close button. */
    indicatorTitle: string;
    indicatorIdle: string;
    indicatorStatus: string;
    indicatorQueue: string;
    close: string;
    /** Indicator chip text by aggregate state (`{count}`). */
    indicatorFailed: string;
    indicatorUploading: string;
    indicatorPaused: string;
    indicatorQueued: string;
    indicatorDone: string;

    /** Validation messages (`validation.error` in `file-reject`; `{size}` / `{count}` / `{name}`). */
    errorMaxFileSize: string;
    errorMinFileSize: string;
    errorFileType: string;
    /** `beforeFilesAddCallback` returned `false` (code `rejected`). */
    errorRejected: string;
    errorMaxFileCount: string;
    errorMaxFileCountOne: string;
    errorDuplicate: string;
    errorMaxTotalSize: string;
    /** A failed upload's `error` when the handler threw something that isn't an `Error`. */
    errorUpload: string;
    /** Form validity message (`min-file-count`). */
    errorMinFileCount: string;
    errorMinFileCountOne: string;

    /**
     * Screen-reader announcements (core `announce()`, the page's one polite live
     * region). `''` silences one. Files added — ONE per drop / pick (`{count}`);
     * `announceAddedOne` for exactly one.
     */
    announceAdded: string;
    announceAddedOne: string;
    /** A file was rejected (`{name}`, `{reason}` = the validation message). */
    announceRejected: string;
    /** An upload batch finished, all succeeded (`{count}`); `announceUploadDoneOne` for exactly one. */
    announceUploadDone: string;
    announceUploadDoneOne: string;
    /** An upload batch finished with failures (`{done}`, `{failed}`). */
    announceUploadFailed: string;
    /** A file removed by the user — row ✕, Clear all (`{name}`). */
    announceRemoved: string;
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
    cancelAll: 'Cancel all',

    noData: 'No files selected',
    summary: '{count} file(s), {size}',
    viewFiles: 'Click to view files',
    filesChosen: '{count} files chosen',
    fileCount: '{count} files',
    fileCountOne: '1 file',
    addMore: 'Add more',
    clearAll: 'Clear all',
    showMore: 'Show {count} more',
    showLess: 'Show less',
    showQueue: 'Show all {count} files',
    unknownType: 'Unknown',

    limitMaxFileSize: 'max {size} each',
    limitMinFileSize: 'min {size} each',
    limitMaxTotalSize: 'up to {size} total',
    limitMaxTotalSizeLeft: 'up to {size} total · {left} left',
    limitMaxFileCount: 'up to {count} files',
    limitMaxFileCountLeft: 'up to {count} files · {left} left',
    limitMinFileCount: 'at least {count} files',

    progressCounts: '{completed} of {total} · {uploadedSize} / {totalSize}',
    progressPaused: '{count} paused',
    progressFailed: '{count} failed',

    indicatorTitle: 'Uploads',
    indicatorIdle: 'No uploads',
    indicatorStatus: 'Upload status',
    indicatorQueue: 'Upload queue',
    close: 'Close',
    indicatorFailed: '{count} failed',
    indicatorUploading: '{count} uploading',
    indicatorPaused: '{count} paused',
    indicatorQueued: '{count} queued',
    indicatorDone: '{count} done',

    errorMaxFileSize: 'File is too large. Maximum size is {size}',
    errorMinFileSize: 'File is too small. Minimum size is {size}',
    errorFileType: 'File type not accepted',
    errorRejected: 'File rejected',
    errorMaxFileCount: 'Maximum {count} files allowed',
    errorMaxFileCountOne: 'Maximum 1 file allowed',
    errorDuplicate: 'Duplicate file: {name}',
    errorMaxTotalSize: 'Total size would exceed {size}',
    errorUpload: 'Upload failed',
    errorMinFileCount: 'At least {count} files required',
    errorMinFileCountOne: 'At least 1 file required',

    announceAdded: '{count} files added',
    announceAddedOne: '1 file added',
    announceRejected: '{name} was rejected: {reason}',
    announceUploadDone: 'Upload complete: {count} files',
    announceUploadDoneOne: 'Upload complete: 1 file',
    announceUploadFailed: '{done} uploaded, {failed} failed',
    announceRemoved: '{name} removed'
});

/** Placeholder values for {@link resolveLabel}. */
export type LabelVars = Readonly<Record<string, string | number>>;

/** A bound label lookup — `(key, vars) => string`. */
export type LabelFn = (key: DropzoneLabelKey, vars?: LabelVars) => string;

/** A labels source, or several — most specific first (a satellite's own `labels`, then its store's). */
export type LabelSources =
    | Partial<DropzoneLabels>
    | null
    | undefined
    | ReadonlyArray<Partial<DropzoneLabels> | null | undefined>;

/** The sources merged into one partial (the first source that has a key wins). */
function mergeSources(overrides: LabelSources): Partial<DropzoneLabels> | null {
    const sources = (Array.isArray(overrides) ? overrides : [overrides]) as ReadonlyArray<Partial<DropzoneLabels> | null | undefined>;
    let merged: Partial<DropzoneLabels> | null = null;
    for (let i = sources.length - 1; i >= 0; i--) {
        const source = sources[i];
        if (source && typeof source === 'object') merged = { ...(merged ?? {}), ...source };
    }
    return merged;
}

/**
 * THE label lookup without an element: the first source that has `key` (the
 * element's `labels`; for a satellite its own `labels`, then its store's) →
 * the page-wide `window.components.locale.labels['web-dropzone']` →
 * {@link DEFAULT_LABELS}; then `{placeholder}`s are filled from `vars`
 * (unknown placeholders are left as written). Elements go through
 * {@link createLabelFn} (adds the page's `formatLabelCallback`).
 */
export function resolveLabel(
    overrides: LabelSources,
    key: DropzoneLabelKey,
    vars?: LabelVars
): string {
    return formatLabel(resolveCoreLabel(LABELS_TAG, DEFAULT_LABELS, mergeSources(overrides), key), vars);
}

/**
 * Bind the lookup to a labels source (read on every call, so live changes
 * apply) and the element it renders for (core `createLabels`: the page-wide
 * labels + `formatLabelCallback`, the element's locale). `getHost` is read
 * lazily — an engine creates its label function before its element is set.
 */
export function createLabelFn(getOverrides: () => LabelSources, getHost?: () => Element | null | undefined): LabelFn {
    let labels: Labels<DropzoneLabels> | null = null;
    let labelsHost: Element | null = null;
    return (key, vars) => {
        const host = getHost?.() ?? (typeof document !== 'undefined' ? document.documentElement : null);
        if (!host) return resolveLabel(getOverrides(), key, vars);
        if (!labels || labelsHost !== host) {
            labels = createLabels(host, DEFAULT_LABELS, () => mergeSources(getOverrides()), { tag: LABELS_TAG });
            labelsHost = host;
        }
        return labels.text(key, vars);
    };
}

/**
 * The raw template of `key` (no placeholders filled) — `''` when the consumer
 * silenced it (an announcement label set to `''` never reaches `announce()`,
 * even through a page-wide `formatLabelCallback`).
 */
export function labelTemplate(overrides: LabelSources, key: DropzoneLabelKey): string {
    return resolveCoreLabel(LABELS_TAG, DEFAULT_LABELS, mergeSources(overrides), key);
}

/** The page-wide labels of a satellite's own tag (`window.components.locale.labels[tag]`). */
export function pageLabelsFor(tag: string): Partial<DropzoneLabels> | undefined {
    return getPageLocale()?.labels?.[tag] as Partial<DropzoneLabels> | undefined;
}

/** The built-in English lookup (no overrides). */
export const defaultLabel: LabelFn = (key, vars) => resolveLabel(undefined, key, vars);

/** Keys with a singular variant `<key>One`, used when `count === 1`. */
export type CountedLabelKey = 'fileCount' | 'errorMaxFileCount' | 'errorMinFileCount' | 'announceAdded' | 'announceUploadDone';

/** A count label: `<key>One` for exactly one, else `<key>` with `{count}` filled. */
export function countLabel(label: LabelFn, key: CountedLabelKey, count: number): string {
    return count === 1 ? label(`${key}One` as DropzoneLabelKey, { count }) : label(key, { count });
}

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
