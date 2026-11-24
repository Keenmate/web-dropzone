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
 * built-in English {@link DEFAULT_LABELS}. A dynamic text passes its text
 * spot's context as `{ ctx }` (rulebook D-NC-24): a template reads
 * `{ctx.<path>}` (`{ctx.count}`, `{ctx.name}`; numbers locale-formatted), the
 * page's `translateCallback` (i18next / ICU) gets it as `params.ctx` (raw
 * numbers; `ctx.count` = the number the noun agrees with, for plural rules —
 * core never pluralizes). Labels are TEXT: every renderer escapes them where
 * it builds HTML.
 */

import { escapeHtml } from '@keenmate/web-components-core';
import { createLabels, createLabelsView, formatLabel, getPageLocale, resolveLabel as resolveCoreLabel, type Labels, type LabelsView, type TranslateCallback } from '@keenmate/web-components-core/locale';
import type { FileState, FileStatus, FileLabelContext } from './types';

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
 *
 * Each dynamic key names its context type (`ctx: …`) and what `ctx.count` is. English defaults put no
 * plural noun right after a number (`Files: {ctx.count}`), so one template fits every count; an app
 * pluralizes through `translateCallback` (`params.ctx.count`).
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

    /** Status names — the status pill's / indicator icon's tooltip, and `{ctx.statusName}` in `ariaLabels.status`. */
    'labels.statusPending': string;
    'labels.statusUploading': string;
    'labels.statusPaused': string;
    'labels.statusCancelling': string;
    'labels.statusComplete': string;
    'labels.statusError': string;
    'labels.statusCancelled': string;
    /** Status name of an `error` file whose cancel timed out (`file.error === 'cancel-timeout'`). */
    'labels.cancelTimeout': string;
    /** Status pill / summary icon accessible name. ctx: `StatusLabelContext` — `{ctx.statusName}` (one of the status names), `{ctx.status}`; no `ctx.count`. */
    'ariaLabels.status': string;
    /** Accessible name of the indicator's upload loader. */
    'ariaLabels.uploading': string;
    /** Text next to the progress bar while a cancel waits for the handler. */
    'messages.cancelling': string;

    /** Row buttons: accessible name + tooltip. ctx: `FileLabelContext` — `{ctx.name}` = the file name; no `ctx.count`. */
    'ariaLabels.pauseFile': string;
    'tooltips.pauseFile': string;
    'ariaLabels.resumeFile': string;
    'tooltips.resumeFile': string;
    'ariaLabels.retryFile': string;
    'tooltips.retryFile': string;
    'ariaLabels.cancelFile': string;
    'tooltips.cancelFile': string;
    /** Row remove (✕) button accessible name. ctx: `FileLabelContext` — `{ctx.name}`. */
    'ariaLabels.removeFile': string;

    /** Bulk actions in the overall-progress strip. */
    'buttons.pauseAll': string;
    'buttons.resumeAll': string;
    'buttons.retryAll': string;
    'buttons.cancelAll': string;

    /** Empty file list. */
    'messages.noData': string;
    /** Compact summary line. ctx: `SummaryLabelContext` — `ctx.count` = the files, `{ctx.size}` = total size. */
    'labels.summary': string;
    /** Accessible name of the compact summary line (opens the popover). */
    'ariaLabels.viewFiles': string;
    /** Native selector text for 2+ files. ctx: `FileCountLabelContext` — `ctx.count` = the chosen files. */
    'labels.filesChosen': string;
    /** File count — popover header + footer. ctx: `FileCountLabelContext` — `ctx.count` = the files. */
    'labels.fileCount': string;
    /** Popover header buttons. */
    'buttons.addMore': string;
    'buttons.clearAll': string;
    /** List cap toggle (`max-visible-file-count`): the text toggle's caption; the `+N` / `−` badge's accessible name. `showMore` ctx: `FileCountLabelContext` — `ctx.count` = the hidden rows. */
    'buttons.showMore': string;
    'ariaLabels.showMore': string;
    'buttons.showLess': string;
    'ariaLabels.showLess': string;
    /** Rolling list queue button: accessible name + tooltip. ctx: `FileCountLabelContext` — `ctx.count` = all files. */
    'ariaLabels.showQueue': string;
    'tooltips.showQueue': string;
    /** Type column fallback for a file without a MIME type. */
    'labels.unknownType': string;

    /** Popover limits line parts (auto-derived when `labels.hint` is empty), joined with " · ". Size parts — ctx: `SizeLimitLabelContext` (`{ctx.size}` = the limit; no `ctx.count`); count parts — ctx: `CountLimitLabelContext` (`ctx.count` = the limit). */
    'labels.limitMaxFileSize': string;
    'labels.limitMinFileSize': string;
    'labels.limitMaxTotalSize': string;
    /** `{ctx.left}` = remaining size. */
    'labels.limitMaxTotalSizeLeft': string;
    'labels.limitMaxFileCount': string;
    /** `{ctx.left}` = remaining slots. */
    'labels.limitMaxFileCountLeft': string;
    'labels.limitMinFileCount': string;

    /** Overall-progress strip. Counts — ctx: `ProgressCountsLabelContext` (`{ctx.completed}`, `{ctx.total}`, `{ctx.uploadedSize}`, `{ctx.totalSize}`; `ctx.count` = `ctx.total`); paused / failed segments — ctx: `FileCountLabelContext` (`ctx.count` = those files). */
    'messages.progressCounts': string;
    'messages.progressPaused': string;
    'messages.progressFailed': string;

    /** `<web-dropzone-indicator>` drawer title — also the drawer dialog's accessible name (`aria-labelledby`). */
    'headers.indicator': string;
    /** Indicator chip accessible name; the drawer + popover close button. */
    'ariaLabels.indicatorStatus': string;
    'ariaLabels.close': string;
    /** Indicator chip text: idle, then by aggregate state. ctx: `FileCountLabelContext` — `ctx.count` = the files in that state. */
    'messages.indicatorIdle': string;
    'messages.indicatorFailed': string;
    'messages.indicatorUploading': string;
    'messages.indicatorPaused': string;
    'messages.indicatorQueued': string;
    'messages.indicatorDone': string;

    /** Validation messages (`validation.error` in `file-reject`). Size errors — ctx: `SizeLimitLabelContext` (`{ctx.size}` = the limit); `errors.duplicate` — ctx: `FileLabelContext` (`{ctx.name}`). */
    'errors.maxFileSize': string;
    'errors.minFileSize': string;
    'errors.fileType': string;
    /** `beforeFilesAddCallback` returned `false` (code `rejected`). */
    'errors.rejected': string;
    /** Also the form validity message for more files than `max-file-count` (`rangeOverflow`). ctx: `CountLimitLabelContext` — `ctx.count` = the limit. */
    'errors.maxFileCount': string;
    'errors.duplicate': string;
    'errors.maxTotalSize': string;
    /** A failed upload's `error` when the handler threw something that isn't an `Error`. */
    'errors.upload': string;
    /** Form validity message (`min-file-count` → `rangeUnderflow`). ctx: `CountLimitLabelContext` — `ctx.count` = the limit. */
    'errors.minFileCount': string;
    /** Form validity message (`required` → `valueMissing`): no file selected. */
    'errors.required': string;

    /**
     * Screen-reader announcements (core `announce()`, the page's one polite live
     * region). `''` silences one. Files added — ONE per drop / pick. ctx:
     * `FileCountLabelContext` — `ctx.count` = the added files.
     */
    'ariaLabels.announceAdded': string;
    /** A file was rejected. ctx: `RejectedFileLabelContext` — `{ctx.name}`, `{ctx.reason}` = the validation message; no `ctx.count`. */
    'ariaLabels.announceRejected': string;
    /** An upload batch finished, all succeeded. ctx: `FileCountLabelContext` — `ctx.count` = the uploaded files. */
    'ariaLabels.announceUploadDone': string;
    /** An upload batch finished with failures. ctx: `UploadResultLabelContext` — `{ctx.done}`, `{ctx.failed}`; `ctx.count` = `done + failed`. */
    'ariaLabels.announceUploadFailed': string;
    /** A file removed by the user — row ✕, Clear all. ctx: `FileLabelContext` — `{ctx.name}`. */
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
    'ariaLabels.status': 'Status: {ctx.statusName}',
    'ariaLabels.uploading': 'Uploading',
    'messages.cancelling': 'Cancelling…',

    'ariaLabels.pauseFile': 'Pause {ctx.name}',
    'tooltips.pauseFile': 'Pause {ctx.name}',
    'ariaLabels.resumeFile': 'Resume {ctx.name}',
    'tooltips.resumeFile': 'Resume {ctx.name}',
    'ariaLabels.retryFile': 'Retry {ctx.name}',
    'tooltips.retryFile': 'Retry {ctx.name}',
    'ariaLabels.cancelFile': 'Cancel {ctx.name}',
    'tooltips.cancelFile': 'Cancel {ctx.name}',
    'ariaLabels.removeFile': 'Remove {ctx.name}',

    'buttons.pauseAll': 'Pause all',
    'buttons.resumeAll': 'Resume all',
    'buttons.retryAll': 'Retry all',
    'buttons.cancelAll': 'Cancel all',

    'messages.noData': 'No files selected',
    'labels.summary': 'Files: {ctx.count}, {ctx.size}',
    'ariaLabels.viewFiles': 'Click to view files',
    'labels.filesChosen': 'Files chosen: {ctx.count}',
    'labels.fileCount': 'Files: {ctx.count}',
    'buttons.addMore': 'Add more',
    'buttons.clearAll': 'Clear all',
    'buttons.showMore': 'Show {ctx.count} more',
    'ariaLabels.showMore': 'Show {ctx.count} more',
    'buttons.showLess': 'Show less',
    'ariaLabels.showLess': 'Show less',
    'ariaLabels.showQueue': 'Show all files ({ctx.count})',
    'tooltips.showQueue': 'Show all files ({ctx.count})',
    'labels.unknownType': 'Unknown',

    'labels.limitMaxFileSize': 'max {ctx.size} each',
    'labels.limitMinFileSize': 'min {ctx.size} each',
    'labels.limitMaxTotalSize': 'up to {ctx.size} total',
    'labels.limitMaxTotalSizeLeft': 'up to {ctx.size} total · {ctx.left} left',
    'labels.limitMaxFileCount': 'files: up to {ctx.count}',
    'labels.limitMaxFileCountLeft': 'files: up to {ctx.count} · {ctx.left} left',
    'labels.limitMinFileCount': 'files: at least {ctx.count}',

    'messages.progressCounts': '{ctx.completed} of {ctx.total} · {ctx.uploadedSize} / {ctx.totalSize}',
    'messages.progressPaused': '{ctx.count} paused',
    'messages.progressFailed': '{ctx.count} failed',

    'headers.indicator': 'Uploads',
    'ariaLabels.indicatorStatus': 'Upload status',
    'ariaLabels.close': 'Close',
    'messages.indicatorIdle': 'No uploads',
    'messages.indicatorFailed': '{ctx.count} failed',
    'messages.indicatorUploading': '{ctx.count} uploading',
    'messages.indicatorPaused': '{ctx.count} paused',
    'messages.indicatorQueued': '{ctx.count} queued',
    'messages.indicatorDone': '{ctx.count} done',

    'errors.maxFileSize': 'File is too large. Maximum size is {ctx.size}',
    'errors.minFileSize': 'File is too small. Minimum size is {ctx.size}',
    'errors.fileType': 'File type not accepted',
    'errors.rejected': 'File rejected',
    'errors.maxFileCount': 'Too many files. Maximum: {ctx.count}',
    'errors.duplicate': 'Duplicate file: {ctx.name}',
    'errors.maxTotalSize': 'Total size would exceed {ctx.size}',
    'errors.upload': 'Upload failed',
    'errors.minFileCount': 'Too few files. Minimum: {ctx.count}',
    'errors.required': 'Add a file.',

    'ariaLabels.announceAdded': 'Files added: {ctx.count}',
    'ariaLabels.announceRejected': '{ctx.name} was rejected: {ctx.reason}',
    'ariaLabels.announceUploadDone': 'Upload complete. Files: {ctx.count}',
    'ariaLabels.announceUploadFailed': 'Uploaded: {ctx.done}, failed: {ctx.failed}',
    'ariaLabels.announceRemoved': '{ctx.name} removed'
});

/**
 * The values of a label call: the text spot's context as `{ ctx }` (one of the `*LabelContext` types);
 * templates read `{ctx.<path>}`. Static labels take none.
 */
export type LabelParams = Readonly<{ ctx: object }>;

/** A bound label lookup — `(key, { ctx }) => string`. */
export type LabelFn = (key: DropzoneLabelKey, params?: LabelParams) => string;

/**
 * The UI strings a render callback reads (`ctx.labels`, core `createLabelsView`): `ctx.labels.text(key, params)` /
 * `ctx.labels.html(key, params)` — instance `labels` → own / page-wide `translateCallback` → page-wide labels →
 * built-in English, `{ctx.*}` numbers locale-formatted.
 */
export type DropzoneLabelsView = LabelsView<DropzoneLabels>;

/** A {@link LabelFn} bound by {@link createLabelFn}, plus the same lookup as a {@link DropzoneLabelsView} (`view`). */
export interface BoundLabelFn extends LabelFn {
    /** The same lookup for a render callback's `ctx.labels` (stable object, reads live). */
    readonly view: DropzoneLabelsView;
}

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
 * {@link DEFAULT_LABELS}; then `{ctx.<path>}` placeholders are filled from
 * `params` (unknown placeholders are left as written). Elements go through
 * {@link createLabelFn} (adds the page's `translateCallback`).
 */
export function resolveLabel(
    overrides: LabelSources,
    key: DropzoneLabelKey,
    params?: LabelParams
): string {
    return formatLabel(resolveCoreLabel(LABELS_TAG, DEFAULT_LABELS, mergeSources(overrides), key), params);
}

/**
 * Bind the lookup to a labels source (read on every call, so live changes
 * apply) and the element it renders for (core `createLabels` with
 * `tag: 'web-dropzone'`: the page-wide labels + `translateCallback`, the
 * element's locale). `getHost` is read lazily — an engine creates its label
 * function before its element is set. `getTranslateCallback` = the element's
 * own `translateCallback` (asked before the page-wide one) — passed explicitly
 * so a standalone engine / a satellite uses the store's; unset → core reads
 * `host.translateCallback`. `getLocale` = the `locale` setting (the engine's /
 * the store's for a satellite): the numbers in `{ctx.*}` placeholders and `translateCallback`'s
 * `ctx.locale`; unset → the page-wide locale, else the browser.
 */
export function createLabelFn(
    getOverrides: () => LabelSources,
    getHost?: () => Element | null | undefined,
    getTranslateCallback?: () => TranslateCallback | null | undefined,
    getLocale?: () => string | null | undefined
): BoundLabelFn {
    let labels: Labels<DropzoneLabels> | null = null;
    let labelsHost: Element | null = null;
    /** The core labels for the current host — null without a document (SSR / a bare engine). */
    const current = (): Labels<DropzoneLabels> | null => {
        const host = getHost?.() ?? (typeof document !== 'undefined' ? document.documentElement : null);
        if (!host) return null;
        if (!labels || labelsHost !== host) {
            labels = createLabels(host, DEFAULT_LABELS, () => mergeSources(getOverrides()), {
                tag: LABELS_TAG,
                ...(getTranslateCallback ? { getTranslateCallback } : {}),
                ...(getLocale ? { getLocale } : {})
            });
            labelsHost = host;
        }
        return labels;
    };
    const fn = ((key, params) => current()?.text(key, params) ?? resolveLabel(getOverrides(), key, params)) as LabelFn;
    const view = createLabelsView<DropzoneLabels>({
        text: (key, params, options) => current()?.text(key, params, options) ?? resolveLabel(getOverrides(), key as DropzoneLabelKey, params as LabelParams | undefined),
        html: (key, params, options) => current()?.html(key, params, options) ?? escapeHtml(resolveLabel(getOverrides(), key as DropzoneLabelKey, params as LabelParams | undefined)),
    } as Labels<DropzoneLabels>);
    return Object.assign(fn, { view }) as BoundLabelFn;
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
export const defaultLabel: LabelFn = (key, params) => resolveLabel(undefined, key, params);

/** The {@link FileLabelContext} of a file (a `FileState` or a native `File`). */
export function fileLabelContext(file: Pick<FileState, 'name' | 'size' | 'type'>): FileLabelContext {
    return { name: file.name, size: file.size, type: file.type ?? '' };
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
