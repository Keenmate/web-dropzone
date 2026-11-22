/**
 * `@keenmate/web-dropzone-core` — the public surface of the headless store:
 * `DropzoneEngine` (the "Build your own UI" seam, rulebook C-CA-37; see the
 * README), the `DropzoneController` facade, contexts / event details, pure
 * helpers, `DEFAULT_CONFIG` (the one source of option defaults — the
 * element's input rows read it), labels, icons and logging. No DOM
 * rendering, no CSS, no custom elements; `@keenmate/web-dropzone`
 * re-exports the types / helpers an element user needs.
 */

// ---- Engine (standalone / headless use) + public controller facade -------
export { DropzoneEngine } from './dropzone-engine';
export type { DropzoneEngineHost, DropzoneActionRequest } from './dropzone-engine';
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
    DropzoneAction,
    DropzoneActionContext,
    DropzoneActionItem,
    DropzoneActionEventDetail,
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
    formatPercent,
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
    pageLabelsFor,
    LABELS_TAG,
    defaultLabel,
    statusLabel,
    fileStatusLabel,
    isLabelsValue,
    fileLabelContext
} from './labels';
export type { DropzoneLabels, DropzoneLabelKey, DropzoneLabelOverrides, LabelFn, LabelParams, LabelSources } from './labels';
export type {
    FileLabelContext,
    RejectedFileLabelContext,
    StatusLabelContext,
    FileCountLabelContext,
    SummaryLabelContext,
    SizeLimitLabelContext,
    CountLimitLabelContext,
    ProgressCountsLabelContext,
    UploadResultLabelContext
} from './types';

// ---- Status-surface types ----------------------------------------------
export type {
    StatusAggregate,
    StatusSurfaceArgs,
    StatusSurfaceCallback,
    StatusSurfaceResult,
    RenderCallbackResult
} from './store-api';

// ---- Domain types ------------------------------------------------------
export type {
    DropzoneEngineOptions,
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
