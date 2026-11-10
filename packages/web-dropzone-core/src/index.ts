/**
 * Barrel export for the core public surface — the non-rendering substrate.
 *
 * Phase B · Step 5 of the core/renderer split (see ARCHITECTURE.md).
 * Everything re-exported from here is what survives the eventual package
 * split into `@keenmate/dropzone-core` (Step 6) — no DOM, no CSS, no
 * web-component / satellite element classes.
 *
 * The top-level `src/index.ts` re-exports `*` from here plus the renderer
 * surface, so consumers of the published package keep their existing
 * import paths.
 */

// ---- Engine (standalone / headless use) + public controller facade -------
export { DropzoneEngine } from './dropzone-engine';
export type { DropzoneEngineHost } from './dropzone-engine';
export { createDropzoneController } from './controller';
export type { DropzoneController } from './controller';

// ---- Interaction model: callback contexts, event details, event map -----
export type {
    DropzoneContext,
    ValidateContext,
    BeforeFilesAddContext,
    BeforeFilesRemoveContext,
    BeforeFilesCancelContext,
    FileIconContext,
    FileUploadContext,
    FileItemRenderContext,
    ListWrapperRenderContext,
    PromptRenderContext,
    SummaryRenderContext,
    CustomStylesContext,
    FileAddEventDetail,
    FileRemoveEventDetail,
    FilesChangeEventDetail,
    ChangeEventDetail,
    FileRejectEventDetail,
    FileRetryEventDetail,
    FileUploadEventDetail,
    FileDeleteEventDetail,
    FileCancelEventDetail,
    FileProgressEventDetail,
    FileStatusChangeEventDetail,
    FileUpdateEventDetail,
    OverlayEventDetail,
    ReadyEventDetail,
    FileRowUpdateEventDetail,
    SummaryActivateEventDetail,
    QueueOpenEventDetail,
    DropzoneEventMap,
    DropzoneListEventMap,
    DropzoneEngineEventName,
    EngineEventDetail
} from './interaction';

// ---- Pure helpers + default config -------------------------------------
export {
    DEFAULT_CONFIG,
    formatFileSize,
    getFileTypeCategory,
    getFileIcon,
    isImageFile,
    createImagePreview,
    generateFileId,
    FILE_ICONS
} from './dropzone-shared';

// ---- File-pipeline helpers (stateless validators) ----------------------
export {
    validateFile,
    isFileTypeAccepted,
    dedupeKeyFor,
    createFileState
} from './file-pipeline';
export type { ValidationConfig } from './file-pipeline';

// ---- Icons (shared SVG family) -----------------------
export {
    STATUS_ICONS,
    ACTION_ICONS,
    actionForStatus,
    CANCEL_ICON,
    FILE_TYPE_ICONS,
    UI_ICONS
} from './icons';
export type { RowAction } from './icons';

// ---- UI strings (`labels`) ----------------------------------------------
export {
    DEFAULT_LABELS,
    resolveLabel,
    createLabelFn,
    defaultLabel,
    statusLabel,
    fileStatusLabel,
    isLabelsValue,
    countLabel
} from './labels';
export type { DropzoneLabels, DropzoneLabelKey, LabelFn, LabelVars, LabelSources, CountedLabelKey } from './labels';

// ---- Status-surface types ----------------------------------------------
export type {
    StatusAggregate,
    StatusSurfaceArgs,
    StatusSurfaceCallback,
    StatusSurfaceResult
} from './store-api';

// ---- Domain types ------------------------------------------------------
export type {
    DropzoneConfig,
    DropzoneRenderMode,
    DropzoneState,
    DisplayMode,
    FileStatus,
    CancelTimeoutBehavior,
    FileCancelResult,
    FileState,
    FileUploadHandler,
    FileUploadResult,
    ValidationResult,
    RejectedFile,
    FileTypeCategory,
    FileIconOverrides,
    AddFilesOptions,
    OverallProgress,
    DedupeMode,
    ProgressMode,
    RetryPolicy,
    SelectorAppearance,
    ListAppearance,
    DropzoneControl,
    FileItemPart,
    RollingRotation,
    CardSize,
    GridLayout,
    GridStatus
} from './types';

// ---- Logging utilities (runtime control) -------------------------------
export {
    setLogLevel,
    enableLogging,
    disableLogging,
    setCategoryLevel,
    resetLogging,
    LOGGING_CATEGORIES,
    logging,
    initLogger,
    fileLogger,
    uiLogger,
    interactionLogger
} from './logger';

// ---- DOM helpers shared with renderers ---------------------------------
// HTML escaping is core's `escapeHtml(value)` (any value: null / undefined →
// ''), re-exported so renderers and template callbacks keep one import path.
export { escapeHtml } from '@keenmate/web-components-core';
