/**
 * UI strings — the `labels` input (Keenmate cross-component i18n model).
 *
 * Every user-visible string the dropzone renders by itself comes from ONE
 * lookup, core `/locale` (SPEC §12.24). Keys are flat `<elementType>.<name>`
 * (`buttons.selectFiles`, `ariaLabels.cancelFile`); the full key prefixes the
 * component name: `web-dropzone.buttons.selectFiles`. Per key: the element's
 * `labels` overrides (short or full keys; a satellite: its own, the page-wide
 * `<satellite tag>.<key>` entries, then its store's) → the page-wide flat
 * dictionary `window.components.locale.labels['web-dropzone.<key>']` → the
 * built-in English {@link DEFAULT_LABELS}. Placeholders in `{braces}`
 * (`{name}`, `{count}`, `{status}`) are filled from the call's `vars` — or by
 * the page's `translateCallback` (i18next / ICU). Labels are TEXT: every
 * renderer escapes them where it builds HTML.
 */

import { createLabels, formatLabel, getPageLocale, resolveLabel as resolveCoreLabel, type Labels, type TranslateCallback } from '@keenmate/web-components-core/locale';
import type { FileState, FileStatus } from './types';

/** The component name — the prefix of the full label keys of the whole dropzone family. */
export const LABELS_TAG = 'web-dropzone';

/**
 * Every UI string `<web-dropzone>` and its satellites render by themselves.
 * Keys are flat `<elementType>.<name>` (core `/locale`, rulebook D-NC-24) —
 * the element type says where the text is SHOWN: `buttons` (visible caption),
 * `tooltips` (`title`), `ariaLabels` (screen-reader only: `aria-label`, live
 * announcements), `headers`, `labels` (other visible text), `messages`
 * (empty state / progress), `errors` (validation / failure). A text shown on
 * two surfaces has two keys sharing `<name>` (`ariaLabels.pauseFile` +
 * `tooltips.pauseFile`).
 */
export interface DropzoneLabels {
    /** Card prompt text. */
    'labels.prompt': string;
    /**
     * Accessible name of the icon-only minimal selector button, and of the card's file input when
     * `renderPromptCallback` replaces / hides the prompt text. The default card input is named by the
     * visible prompt (`labels.prompt`, `aria-labelledby`). Unset, it follows a customized `labels.prompt`.
     */
    'ariaLabels.prompt': string;
    /** Secondary hint under the prompt. Empty = none on the card; the popover then derives a limits line. */
    'labels.hint': string;
    /** Card text while a drag is over it. */
    'labels.dragActive': string;
    /** Browse / select-files button (button + native selectors, big card). */
    'buttons.selectFiles': string;
    /** Native selector text when nothing is chosen. */
    'labels.noFileChosen': string;
    /** Drag-overlay text (`overlay-target`). */
    'labels.overlay': string;

    /** Status names — the status pill's / indicator icon's tooltip, and `{status}` in `ariaLabels.status`. */
    'labels.statusPending': string;
    'labels.statusUploading': string;
    'labels.statusPaused': string;
    'labels.statusCancelling': string;
    'labels.statusComplete': string;
    'labels.statusError': string;
    'labels.statusCancelled': string;
    /** Status name of an `error` file whose cancel timed out (`file.error === 'cancel-timeout'`). */
    'labels.cancelTimeout': string;
    /** Status pill / summary icon accessible name; `{status}` is one of the status names. */
    'ariaLabels.status': string;
    /** Accessible name of the indicator's upload loader. */
    'ariaLabels.uploading': string;
    /** Text next to the progress bar while a cancel waits for the handler. */
    'messages.cancelling': string;

    /** Row buttons (`{name}` = the file name): accessible name + tooltip. */
    'ariaLabels.pauseFile': string;
    'tooltips.pauseFile': string;
    'ariaLabels.resumeFile': string;
    'tooltips.resumeFile': string;
    'ariaLabels.retryFile': string;
    'tooltips.retryFile': string;
    'ariaLabels.cancelFile': string;
    'tooltips.cancelFile': string;
    /** Row remove (✕) button accessible name. */
    'ariaLabels.removeFile': string;

    /** Bulk actions in the overall-progress strip. */
    'buttons.pauseAll': string;
    'buttons.resumeAll': string;
    'buttons.retryAll': string;
    'buttons.cancelAll': string;

    /** Empty file list. */
    'messages.noData': string;
    /** Compact summary line (`{count}`, `{size}` = total size). */
    'labels.summary': string;
    /** Accessible name of the compact summary line (opens the popover). */
    'ariaLabels.viewFiles': string;
    /** Native selector text for 2+ files (`{count}`). */
    'labels.filesChosen': string;
    /** File count (`{count}`); `labels.fileCountOne` for exactly one. Popover header + footer. */
    'labels.fileCount': string;
    'labels.fileCountOne': string;
    /** Popover header buttons. */
    'buttons.addMore': string;
    'buttons.clearAll': string;
    /** List cap toggle (`max-visible-file-count`, `{count}` = hidden rows): the text toggle's caption; the `+N` / `−` badge's accessible name. */
    'buttons.showMore': string;
    'ariaLabels.showMore': string;
    'buttons.showLess': string;
    'ariaLabels.showLess': string;
    /** Rolling list queue button (`{count}`): accessible name + tooltip. */
    'ariaLabels.showQueue': string;
    'tooltips.showQueue': string;
    /** Type column fallback for a file without a MIME type. */
    'labels.unknownType': string;

    /** Popover limits line parts (auto-derived when `labels.hint` is empty), joined with " · ". `{size}` / `{count}` = the limit. */
    'labels.limitMaxFileSize': string;
    'labels.limitMinFileSize': string;
    'labels.limitMaxTotalSize': string;
    /** `{left}` = remaining size. */
    'labels.limitMaxTotalSizeLeft': string;
    'labels.limitMaxFileCount': string;
    /** `{left}` = remaining slots. */
    'labels.limitMaxFileCountLeft': string;
    'labels.limitMinFileCount': string;

    /** Overall-progress strip: `{completed}`, `{total}`, `{uploadedSize}`, `{totalSize}`; paused / failed segments `{count}`. */
    'messages.progressCounts': string;
    'messages.progressPaused': string;
    'messages.progressFailed': string;

    /** `<web-dropzone-indicator>` drawer title — also the drawer dialog's accessible name (`aria-labelledby`). */
    'headers.indicator': string;
    /** Indicator chip accessible name; the drawer + popover close button. */
    'ariaLabels.indicatorStatus': string;
    'ariaLabels.close': string;
    /** Indicator chip text: idle, then by aggregate state (`{count}`). */
    'messages.indicatorIdle': string;
    'messages.indicatorFailed': string;
    'messages.indicatorUploading': string;
    'messages.indicatorPaused': string;
    'messages.indicatorQueued': string;
    'messages.indicatorDone': string;

    /** Validation messages (`validation.error` in `file-reject`; `{size}` / `{count}` / `{name}`). */
    'errors.maxFileSize': string;
    'errors.minFileSize': string;
    'errors.fileType': string;
    /** `beforeFilesAddCallback` returned `false` (code `rejected`). */
    'errors.rejected': string;
    'errors.maxFileCount': string;
    'errors.maxFileCountOne': string;
    'errors.duplicate': string;
    'errors.maxTotalSize': string;
    /** A failed upload's `error` when the handler threw something that isn't an `Error`. */
    'errors.upload': string;
    /** Form validity message (`min-file-count`). */
    'errors.minFileCount': string;
    'errors.minFileCountOne': string;

    /**
     * Screen-reader announcements (core `announce()`, the page's one polite live
     * region). `''` silences one. Files added — ONE per drop / pick (`{count}`);
     * `ariaLabels.announceAddedOne` for exactly one.
     */
    'ariaLabels.announceAdded': string;
    'ariaLabels.announceAddedOne': string;
    /** A file was rejected (`{name}`, `{reason}` = the validation message). */
    'ariaLabels.announceRejected': string;
    /** An upload batch finished, all succeeded (`{count}`); `…One` for exactly one. */
    'ariaLabels.announceUploadDone': string;
    'ariaLabels.announceUploadDoneOne': string;
    /** An upload batch finished with failures (`{done}`, `{failed}`). */
    'ariaLabels.announceUploadFailed': string;
    /** A file removed by the user — row ✕, Clear all (`{name}`). */
    'ariaLabels.announceRemoved': string;
}

export type DropzoneLabelKey = keyof DropzoneLabels;

/**
 * The `labels` input: short keys (`buttons.selectFiles`) and / or full keys
 * (`web-dropzone.buttons.selectFiles`); the short key wins when both are set.
 */
export type DropzoneLabelOverrides =
    & { [K in DropzoneLabelKey]?: string }
    & { [K in DropzoneLabelKey as `web-dropzone.${K}`]?: string };

/** Built-in English strings. */
export const DEFAULT_LABELS: Readonly<DropzoneLabels> = Object.freeze({
    'labels.prompt': 'Drop files here or click to browse',
    'ariaLabels.prompt': 'Drop files here or click to browse',
    'labels.hint': '',
    'labels.dragActive': 'Drop files here',
    'buttons.selectFiles': 'Select files',
    'labels.noFileChosen': 'No file chosen',
    'labels.overlay': 'Drop files here',

    'labels.statusPending': 'Pending',
    'labels.statusUploading': 'Uploading',
    'labels.statusPaused': 'Paused',
    'labels.statusCancelling': 'Cancelling…',
    'labels.statusComplete': 'Complete',
    'labels.statusError': 'Error',
    'labels.statusCancelled': 'Cancelled',
    'labels.cancelTimeout': 'Cancel timed out',
    'ariaLabels.status': 'Status: {status}',
    'ariaLabels.uploading': 'Uploading',
    'messages.cancelling': 'Cancelling…',

    'ariaLabels.pauseFile': 'Pause {name}',
    'tooltips.pauseFile': 'Pause {name}',
    'ariaLabels.resumeFile': 'Resume {name}',
    'tooltips.resumeFile': 'Resume {name}',
    'ariaLabels.retryFile': 'Retry {name}',
    'tooltips.retryFile': 'Retry {name}',
    'ariaLabels.cancelFile': 'Cancel {name}',
    'tooltips.cancelFile': 'Cancel {name}',
    'ariaLabels.removeFile': 'Remove {name}',

    'buttons.pauseAll': 'Pause all',
    'buttons.resumeAll': 'Resume all',
    'buttons.retryAll': 'Retry all',
    'buttons.cancelAll': 'Cancel all',

    'messages.noData': 'No files selected',
    'labels.summary': '{count} file(s), {size}',
    'ariaLabels.viewFiles': 'Click to view files',
    'labels.filesChosen': '{count} files chosen',
    'labels.fileCount': '{count} files',
    'labels.fileCountOne': '1 file',
    'buttons.addMore': 'Add more',
    'buttons.clearAll': 'Clear all',
    'buttons.showMore': 'Show {count} more',
    'ariaLabels.showMore': 'Show {count} more',
    'buttons.showLess': 'Show less',
    'ariaLabels.showLess': 'Show less',
    'ariaLabels.showQueue': 'Show all {count} files',
    'tooltips.showQueue': 'Show all {count} files',
    'labels.unknownType': 'Unknown',

    'labels.limitMaxFileSize': 'max {size} each',
    'labels.limitMinFileSize': 'min {size} each',
    'labels.limitMaxTotalSize': 'up to {size} total',
    'labels.limitMaxTotalSizeLeft': 'up to {size} total · {left} left',
    'labels.limitMaxFileCount': 'up to {count} files',
    'labels.limitMaxFileCountLeft': 'up to {count} files · {left} left',
    'labels.limitMinFileCount': 'at least {count} files',

    'messages.progressCounts': '{completed} of {total} · {uploadedSize} / {totalSize}',
    'messages.progressPaused': '{count} paused',
    'messages.progressFailed': '{count} failed',

    'headers.indicator': 'Uploads',
    'ariaLabels.indicatorStatus': 'Upload status',
    'ariaLabels.close': 'Close',
    'messages.indicatorIdle': 'No uploads',
    'messages.indicatorFailed': '{count} failed',
    'messages.indicatorUploading': '{count} uploading',
    'messages.indicatorPaused': '{count} paused',
    'messages.indicatorQueued': '{count} queued',
    'messages.indicatorDone': '{count} done',

    'errors.maxFileSize': 'File is too large. Maximum size is {size}',
    'errors.minFileSize': 'File is too small. Minimum size is {size}',
    'errors.fileType': 'File type not accepted',
    'errors.rejected': 'File rejected',
    'errors.maxFileCount': 'Maximum {count} files allowed',
    'errors.maxFileCountOne': 'Maximum 1 file allowed',
    'errors.duplicate': 'Duplicate file: {name}',
    'errors.maxTotalSize': 'Total size would exceed {size}',
    'errors.upload': 'Upload failed',
    'errors.minFileCount': 'At least {count} files required',
    'errors.minFileCountOne': 'At least 1 file required',

    'ariaLabels.announceAdded': '{count} files added',
    'ariaLabels.announceAddedOne': '1 file added',
    'ariaLabels.announceRejected': '{name} was rejected: {reason}',
    'ariaLabels.announceUploadDone': 'Upload complete: {count} files',
    'ariaLabels.announceUploadDoneOne': 'Upload complete: 1 file',
    'ariaLabels.announceUploadFailed': '{done} uploaded, {failed} failed',
    'ariaLabels.announceRemoved': '{name} removed'
});

/** Placeholder values for {@link resolveLabel}. */
export type LabelVars = Readonly<Record<string, string | number>>;

/** A bound label lookup — `(key, vars) => string`. */
export type LabelFn = (key: DropzoneLabelKey, vars?: LabelVars) => string;

/** A labels source, or several — most specific first (a satellite's own `labels`, then its store's). */
export type LabelSources =
    | DropzoneLabelOverrides
    | null
    | undefined
    | ReadonlyArray<DropzoneLabelOverrides | null | undefined>;

const FULL_PREFIX = `${LABELS_TAG}.`;

/** One source with its full keys (`web-dropzone.<key>`) folded to short keys; a short key wins. */
function normalizeSource(source: Readonly<Record<string, unknown>>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
        if (key.startsWith(FULL_PREFIX)) out[key.slice(FULL_PREFIX.length)] = value;
    }
    for (const [key, value] of Object.entries(source)) {
        if (!key.startsWith(FULL_PREFIX)) out[key] = value;
    }
    return out;
}

/** The sources merged into one partial of short keys (the first source that has a key wins). */
function mergeSources(overrides: LabelSources): Partial<DropzoneLabels> | null {
    const sources = (Array.isArray(overrides) ? overrides : [overrides]) as ReadonlyArray<DropzoneLabelOverrides | null | undefined>;
    let merged: Record<string, unknown> | null = null;
    for (let i = sources.length - 1; i >= 0; i--) {
        const source = sources[i];
        if (source && typeof source === 'object') merged = { ...(merged ?? {}), ...normalizeSource(source) };
    }
    return merged as Partial<DropzoneLabels> | null;
}

/**
 * THE label lookup without an element: the first source that has `key` (the
 * element's `labels`; for a satellite its own `labels`, then its store's) →
 * the page-wide `window.components.locale.labels['web-dropzone.<key>']` →
 * {@link DEFAULT_LABELS}; then `{placeholder}`s are filled from `vars`
 * (unknown placeholders are left as written). Elements go through
 * {@link createLabelFn} (adds the page's `translateCallback`).
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
 * apply) and the element it renders for (core `createLabels` with
 * `tag: 'web-dropzone'`: the page-wide labels + `translateCallback`, the
 * element's locale). `getHost` is read lazily — an engine creates its label
 * function before its element is set. `getTranslateCallback` = the element's
 * own `translateCallback` (asked before the page-wide one) — passed explicitly
 * so a standalone engine / a satellite uses the store's; unset → core reads
 * `host.translateCallback`.
 */
export function createLabelFn(
    getOverrides: () => LabelSources,
    getHost?: () => Element | null | undefined,
    getTranslateCallback?: () => TranslateCallback | null | undefined
): LabelFn {
    let labels: Labels<DropzoneLabels> | null = null;
    let labelsHost: Element | null = null;
    return (key, vars) => {
        const host = getHost?.() ?? (typeof document !== 'undefined' ? document.documentElement : null);
        if (!host) return resolveLabel(getOverrides(), key, vars);
        if (!labels || labelsHost !== host) {
            labels = createLabels(host, DEFAULT_LABELS, () => mergeSources(getOverrides()), getTranslateCallback ? { tag: LABELS_TAG, getTranslateCallback } : { tag: LABELS_TAG });
            labelsHost = host;
        }
        return labels.text(key, vars);
    };
}

/**
 * The raw template of `key` (no placeholders filled) — `''` when the consumer
 * silenced it (an announcement label set to `''` never reaches `announce()`,
 * even through a page-wide `translateCallback`).
 */
export function labelTemplate(overrides: LabelSources, key: DropzoneLabelKey): string {
    return resolveCoreLabel(LABELS_TAG, DEFAULT_LABELS, mergeSources(overrides), key);
}

/**
 * A satellite's own page-wide labels: the entries of the flat page dictionary
 * keyed by the satellite's tag (`'web-dropzone-indicator.headers.indicator'`),
 * as short keys. Applies to that satellite only (`web-dropzone.*` keys apply to
 * the whole family).
 */
export function pageLabelsFor(tag: string): DropzoneLabelOverrides | undefined {
    const page = getPageLocale()?.labels;
    if (!page) return undefined;
    const prefix = `${tag}.`;
    let out: Record<string, string> | undefined;
    for (const [key, value] of Object.entries(page)) {
        if (key.startsWith(prefix) && typeof value === 'string') (out ??= {})[key.slice(prefix.length)] = value;
    }
    return out as DropzoneLabelOverrides | undefined;
}

/** The built-in English lookup (no overrides). */
export const defaultLabel: LabelFn = (key, vars) => resolveLabel(undefined, key, vars);

/** Keys with a singular variant `<key>One`, used when `count === 1`. */
export type CountedLabelKey =
    | 'labels.fileCount'
    | 'errors.maxFileCount'
    | 'errors.minFileCount'
    | 'ariaLabels.announceAdded'
    | 'ariaLabels.announceUploadDone';

/** A count label: `<key>One` for exactly one, else `<key>` with `{count}` filled. */
export function countLabel(label: LabelFn, key: CountedLabelKey, count: number): string {
    return count === 1 ? label(`${key}One` as DropzoneLabelKey, { count }) : label(key, { count });
}

const STATUS_KEYS: Record<FileStatus, DropzoneLabelKey> = {
    pending: 'labels.statusPending',
    uploading: 'labels.statusUploading',
    paused: 'labels.statusPaused',
    cancelling: 'labels.statusCancelling',
    complete: 'labels.statusComplete',
    error: 'labels.statusError',
    cancelled: 'labels.statusCancelled'
};

/** The status name of a status (aggregate surfaces have no file). */
export function statusLabel(label: LabelFn, status: FileStatus): string {
    return label(STATUS_KEYS[status]);
}

/** The status name shown for a file — a timed-out cancel reads "Cancel timed out". */
export function fileStatusLabel(label: LabelFn, file: Pick<FileState, 'status' | 'error'>): string {
    if (file.status === 'error' && file.error === 'cancel-timeout') return label('labels.cancelTimeout');
    return statusLabel(label, file.status);
}

/** Is `value` an acceptable `labels` value (a plain object of strings)? */
export function isLabelsValue(value: unknown): value is DropzoneLabelOverrides {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.values(value as Record<string, unknown>).every(v => typeof v === 'string');
}
