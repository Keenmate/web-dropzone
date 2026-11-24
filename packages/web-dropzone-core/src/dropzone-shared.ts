/**
 * Shared module-level helpers + the default config object — referenced by
 * BOTH `dropzone-engine.ts` (validation + add pipeline) and
 * `dropzone.ts` (renderer methods). Extracted into its own module so the
 * core and the renderer can import them without circular dependencies.
 *
 * Phase A · Step 1 of the core/renderer split (see ARCHITECTURE.md). The
 * pure helpers don't depend on any class state — they're purely
 * `(File) → result` transforms — so moving them out of the class file is
 * an entirely structural change.
 */

import type {
    DropzoneEngineOptions,
    FileTypeCategory,
    FileIconOverrides
} from './types';
import type { FileIconContext } from './interaction';
import { createId } from '@keenmate/web-components-core';
import { formatNumber } from '@keenmate/web-components-core/locale';
import { FILE_TYPE_ICONS, fileTypeIconName } from './icons';

/**
 * Default configuration values — the ONE source of the defaults: the engine
 * merges them under its config, and `<web-dropzone>`'s input rows (and the
 * satellites' rows for the same keys) read their `default` from here, so a
 * standalone engine and the element behave the same (rulebook C-CA-37). The
 * `Required<Omit<…>>` shape lists every config key that has a sensible static
 * default — anything excluded here is either a callback (no default), an
 * "unset = decide at render time" key (`selectorAppearance`, `cardSize`,
 * `isThumbnailsShown`, `controls`, …) or a runtime-resolved reference
 * (`container`, `hostElement`, `overlayTarget`).
 */
export const DEFAULT_CONFIG: Required<Omit<DropzoneEngineOptions, 'fileIcons' | 'getFileIconCallback' | 'renderIconCallback' | 'icons' | 'translateCallback' | 'validateCallback' | 'beforeFilesAddCallback' | 'beforeFilesRemoveCallback' | 'beforeFilesCancelCallback' | 'beforeActionCallback' | 'labels' | 'cancelIcon' | 'removeIcon' | 'uploadFileCallback' | 'renderFileItemCallback' | 'renderListWrapperCallback' | 'renderPromptCallback' | 'renderSummaryCallback' | 'getCustomStylesCallback' | 'saveStateCallback' | 'loadStateCallback' | 'storageKey' | 'container' | 'hostElement' | 'customStylesOptions' | 'overlayTarget' | 'selectorAppearance' | 'listAppearance' | 'controls' | 'itemControls' | 'cardSize' | 'isThumbnailsShown' | 'retryPolicy' | 'isHeadless' | 'renderRollingBodyCallback' | 'renderRollingFileInfoCallback' | 'renderRollingProgressCallback'>> = {
    isMultiple: true,
    accept: '',
    maxFileSize: 0,
    minFileSize: 0,
    maxTotalSize: 0,
    maxFileCount: 0,
    minFileCount: 0,
    maxVisibleFileCount: 7,
    dedupeMode: 'name',
    isDisabled: false,
    isReadonly: false,
    // Default for programmatic (non-web-component) usage. The web-component
    // wrapper always resolves an explicit mode in `buildConfig` before
    // construction reaches here.
    renderMode: 'bulk',
    progressThrottle: 0,
    displayMode: 'list',
    gridLayout: 'uniform',
    gridStatus: 'badge',
    rollingRotation: 'slide-in',
    isFilesInside: false,
    icon: 'prompt',
    popoverPlacement: 'bottom-start',
    overlayIcon: 'overlay',
    shouldHighlightOnPageDrag: false,
    name: '',
    concurrency: 1,
    cancelTimeout: 2000,
    cancelTimeoutBehavior: 'error',
    shouldAutoUpload: true,
    isUploadedFileRemovalAllowed: true,
    shouldSinkCompleted: false,
    sinkCompletedDelay: 1500,
    progressMode: 'optimistic',
    // Unset = the page-wide `window.components.locale`, else the browser (core `resolveLocale`).
    locale: null
};

/**
 * File-type icons used by `getFileIcon` to render a glyph based on the file's
 * MIME type / extension; the renderer reaches for this directly inside its row
 * templates. Aliases the canonical Lucide set in `icons.ts` — kept exported
 * under this historical name so existing `FILE_ICONS` imports keep resolving.
 */
export const FILE_ICONS: Record<FileTypeCategory, string> = FILE_TYPE_ICONS;

/**
 * Generate a page-unique ID for a file (core `createId`: a counter + random
 * suffix — no `Date.now()` / `Math.random()` collisions in a burst).
 */
export function generateFileId(): string {
    return createId('file');
}

/**
 * Format a file size for people: `1.5 MB`, with the locale's decimal separator
 * (core `formatNumber`: `locale` — the dropzone's `locale` input — else
 * `window.components.locale`, else the browser — `1,5 MB` in Czech). Binary
 * steps (1024), one decimal above bytes, no grouping.
 */
export function formatFileSize(bytes: number, locale?: string | null): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    const size = bytes / Math.pow(k, i);
    const digits = i > 0 ? 1 : 0;
    return `${formatNumber(size, { locale: locale ?? undefined, minimumFractionDigits: digits, maximumFractionDigits: digits, shouldGroup: false })} ${units[i]}`;
}

/**
 * Format a progress percent for people: `12.5%` / `12,5%` — the number through
 * core `formatNumber` (`locale` — the dropzone's `locale` input — else
 * `window.components.locale`, else the browser) with fixed fraction digits, no
 * grouping, then a plain `%` (not the Intl percent style).
 */
export function formatPercent(value: number, fractionDigits: number, locale?: string | null): string {
    return `${formatNumber(value, { locale: locale ?? undefined, minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits, shouldGroup: false })}%`;
}

/**
 * Get file type category from MIME type or extension
 */
export function getFileTypeCategory(file: File): FileTypeCategory {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();

    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return 'doc';
    if (type.includes('spreadsheet') || type.includes('excel') || name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv')) return 'spreadsheet';
    if (type.includes('zip') || type.includes('rar') || type.includes('tar') || type.includes('7z') || name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.tar') || name.endsWith('.gz')) return 'archive';
    if (type.includes('javascript') || type.includes('typescript') || type.includes('json') || type.includes('html') || type.includes('css') || name.match(/\.(js|ts|jsx|tsx|json|html|css|scss|py|java|cpp|c|h|rb|go|rs|php)$/)) return 'code';
    if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) return 'text';

    return 'default';
}

/** Lowercased extension without the dot (`photo.PNG` → `png`); '' if none. */
function fileExtension(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/**
 * Case- and leading-dot-insensitive lookup in a user icon map. Maps are tiny
 * (a handful of keys), so the linear scan is cheaper than pre-normalizing.
 */
function lookupIconMap(map: Record<string, string>, probe: string): string | undefined {
    if (!probe) return undefined;
    for (const key in map) {
        if (key.replace(/^\./, '').toLowerCase() === probe) return map[key];
    }
    return undefined;
}

/**
 * Resolve the icon value for a file. Resolution order, first hit wins:
 *   1. `overrides.getFileIconCallback({ file })` (non-null return)
 *   2. `overrides.fileIcons[<extension>]`  (e.g. `psd`)
 *   3. `overrides.fileIcons[<category>]`   (e.g. `archive`)
 *   4. the category's icon NAME (`fileImage`, `filePdf`, … — `DEFAULT_ICONS`):
 *      the `icons` maps / hooks may replace it, else the built-in Lucide glyph
 *
 * `overrides` is any object exposing `fileIcons` / `getFileIconCallback` — a
 * full `DropzoneEngineOptions` qualifies, so renderers pass `this.config` directly.
 * `contextBase` (a store's context prototype — `controller` / `element` as
 * inherited getters) becomes the callback ctx's prototype, so the ctx carries
 * them non-enumerably without a per-row allocation of its own. Returns the
 * icon VALUE (markup, a built-in / hook name, an icon-font class list, text);
 * the renderers draw it through core `renderIcon` (see
 * `DropzoneEngineOptions.fileIcons` for the forms and the XSS caveat).
 */
export function getFileIcon(file: File, overrides?: FileIconOverrides, contextBase?: object): string {
    const callback = overrides?.getFileIconCallback;
    if (callback) {
        const ctx = Object.assign(Object.create(contextBase ?? Object.prototype) as object, { file }) as FileIconContext;
        const fromCallback = callback(ctx);
        if (fromCallback != null) return fromCallback;
    }

    const map = overrides?.fileIcons;
    if (map) {
        const byExt = lookupIconMap(map, fileExtension(file.name));
        if (byExt !== undefined) return byExt;
        const byCategory = lookupIconMap(map, getFileTypeCategory(file));
        if (byCategory !== undefined) return byCategory;
    }

    return fileTypeIconName(getFileTypeCategory(file));
}

/**
 * Check if file is an image
 */
export function isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
}

/**
 * Create image preview URL using FileReader
 */
export function createImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!isImageFile(file)) {
            reject(new Error('Not an image file'));
            return;
        }

        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}
