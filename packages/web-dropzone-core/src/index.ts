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
    BeforeFileCancelContext,
    FileIconContext,
    FileUploadContext,
    PersistStateContext,
    LoadStateContext,
    FileItemRenderContext,
    ListWrapperRenderContext,
    PromptRenderContext,
    SummaryRenderContext,
    CustomStylesContext,
    FileAddEventDetail,
    FileRemoveEventDetail,
    FilesChangeEventDetail,
    ChangeEventDetail,
    FilesRejectEventDetail,
    FileRetryEventDetail,
    FileUploadCompleteEventDetail,
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

// ---- Icons (shared SVG family + spinner factory) -----------------------
export {
    STATUS_ICONS,
    STATUS_LABELS,
    ACTION_ICONS,
    ACTION_LABELS,
    actionForStatus,
    createDropzoneSpinner,
    FILE_TYPE_ICONS,
    UI_ICONS
} from './icons';
export type { RowAction } from './icons';

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
    DropzoneMode,
    DropzoneState,
    DisplayMode,
    FileStatus,
    CancelTimeoutBehavior,
    FileCancelResult,
    ValueFormat,
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
    LOGGING_CATEGORIES,
    initLogger,
    fileLogger,
    uiLogger,
    interactionLogger
} from './logger';

// ---- DOM helpers shared with renderers ---------------------------------
// Tiny + zero-project-dependency, so they live in core to avoid a renderer
// → core cycle. Pure DOM primitives — safe to use from either side.
export { escapeHtml } from './dom-utils';
