// Import styles
import './css/main.css';

// The element classes. Nothing is defined as a side effect of importing a
// module: the tags are defined below by core's registerComponent(), satellites
// first (see the registration block at the end of this file).
import { DropzonePickerElement } from './web-component-picker';
import { DropzoneListElement } from './web-component-list';
import { DropzoneIndicatorElement } from './web-component-indicator';
import { DropzoneProgressElement } from './web-component-progress';
import { DropzoneElement } from './web-component';

// Export the web component + satellite renderers (see ARCHITECTURE.md)
export {
    DropzoneElement,
    DropzonePickerElement,
    DropzoneListElement,
    DropzoneIndicatorElement,
    DropzoneProgressElement
};

// Public surface for users writing custom status-surface templates
// (indicator + rolling block share this contract). See ARCHITECTURE.md.
export type {
    StatusSurfaceArgs,
    StatusSurfaceCallback,
    StatusSurfaceResult,
    StatusAggregate
} from '@keenmate/web-dropzone-core';
export { STATUS_ICONS, ACTION_ICONS, CANCEL_ICON, actionForStatus } from '@keenmate/web-dropzone-core';
// UI strings — the `labels` input (one lookup: resolveLabel).
export { DEFAULT_LABELS, resolveLabel, createLabelFn } from '@keenmate/web-dropzone-core';
export type { DropzoneLabels, DropzoneLabelKey, LabelFn } from '@keenmate/web-dropzone-core';
export type { RowAction } from '@keenmate/web-dropzone-core';
// Shared loader (renderLoadingCallback / window.components.renderLoadingCallback)
export type { LoaderRenderContext, RenderLoaderCallback } from '@keenmate/web-components-core';

// The renderer class, for standalone use without the custom element (it
// extends the headless `DropzoneEngine`; `<web-dropzone>` never exposes it —
// the element's public API is `el.controller`).
export { WebDropzone } from './dropzone';
export { formatFileSize, getFileTypeCategory, getFileIcon, isImageFile, createImagePreview } from '@keenmate/web-dropzone-core';

// Export types
export type {
    DisplayMode,
    DropzoneRenderMode,
    FileStatus,
    CancelTimeoutBehavior,
    FileCancelResult,
    ValueFormat,
    FileState,
    ValidationResult,
    RejectedFile,
    DropzoneConfig,
    FileTypeCategory,
    FileIconOverrides,
    AddFilesOptions,
    OverallProgress,
    DropzoneControl,
    FileItemPart,
    FileUploadHandler,
    FileUploadResult,
    // Interaction model — controller, callback contexts, event details
    DropzoneController,
    DropzoneContext,
    ValidateContext,
    BeforeFilesAddContext,
    BeforeFilesRemoveContext,
    BeforeFilesCancelContext,
    FileIconContext,
    FileUploadContext,
    PersistStateContext,
    LoadStateContext,
    FileItemRenderContext,
    ListWrapperRenderContext,
    PromptRenderContext,
    SummaryRenderContext,
    CustomStylesContext,
    DropzoneEventMap,
    DropzoneListEventMap,
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
    QueueOpenEventDetail
} from '@keenmate/web-dropzone-core';

export { FILE_TYPE_ICONS, UI_ICONS } from '@keenmate/web-dropzone-core';

// Export logging utilities for runtime control
export {
    setLogLevel,
    enableLogging,
    disableLogging,
    resetLogging,
    setCategoryLevel,
    LOGGING_CATEGORIES,
    initLogger,
    fileLogger,
    uiLogger,
    interactionLogger
} from '@keenmate/web-dropzone-core';

// Type declarations for build-time constants
declare const __VERSION__: string;
declare const __PACKAGE_NAME__: string;
declare const __AUTHOR__: string;
declare const __LICENSE__: string;
declare const __REPOSITORY__: string;
declare const __HOMEPAGE__: string;
declare const __CORE_VERSION__: string;
declare const __CORE_PACKAGE_NAME__: string;

// The `window.components` registry is declared (and typed) by
// `@keenmate/web-components-core` (SPEC §12.3): `Record<string,
// RegisteredComponent>`; `registerComponent()` below publishes the entries and
// core tracks the live instances (`getInstances()`). (No local `declare global`
// for `Window.components` — that would clash with core's augmentation.)
import { registerComponent } from '@keenmate/web-components-core';
import type { ResponsiveMap, ResponsiveCallback } from '@keenmate/web-components-core';

/** Every `<web-dropzone>` input, keyed by `configKey` (the element's typed properties). */
export type { DropzoneElementConfig } from './web-component';
import type { DropzoneElementConfig } from './web-component';

/** Responsive rules map for `<web-dropzone>` (core SPEC §6.7): device class → partial config. */
export type DropzoneResponsiveMap = ResponsiveMap<DropzoneElementConfig>;

/** Responsive rules callback for `<web-dropzone>` (core SPEC §6.7): context → partial config. */
export type DropzoneResponsiveCallback = ResponsiveCallback<DropzoneElementConfig>;

import { logging } from '@keenmate/web-dropzone-core';

// Registration (rule: the tags are defined by core's registerComponent() only).
// `registerComponent` publishes `window.components[tag]` (adopting an object the
// page created before this script loaded), attaches the logger bundle (its
// controls on `.logging`, the per-instance `el.log`), installs the per-tag
// `responsive` / `customStyles` hooks, and defines the tag.
//
// Order: the four satellites BEFORE `<web-dropzone>`. Defining `web-dropzone`
// upgrades the store elements already in the page, and a convenience-form
// store mounts its own picker / list / indicator during its first build — those
// must already be defined (else `document.createElement('web-dropzone-picker')`
// returns a plain element with no `bindToStore`). The reverse race (a satellite
// in the page before its store is defined) is handled by `whenStoreReady`.
// (The build defines the `__*__` constants; a bare TS run — unit tests — doesn't.)
const COMPONENT_CONFIG = {
    name: typeof __PACKAGE_NAME__ !== 'undefined' ? __PACKAGE_NAME__ : '@keenmate/web-dropzone',
    version: typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0',
    author: typeof __AUTHOR__ !== 'undefined' ? __AUTHOR__ : 'Keenmate',
    license: typeof __LICENSE__ !== 'undefined' ? __LICENSE__ : 'MIT',
    repository: typeof __REPOSITORY__ !== 'undefined' ? __REPOSITORY__ : '',
    homepage: typeof __HOMEPAGE__ !== 'undefined' ? __HOMEPAGE__ : '',
    core: {
        name: typeof __CORE_PACKAGE_NAME__ !== 'undefined' ? __CORE_PACKAGE_NAME__ : '@keenmate/web-dropzone-core',
        version: typeof __CORE_VERSION__ !== 'undefined' ? __CORE_VERSION__ : '0.0.0'
    }
};
registerComponent('web-dropzone-picker', DropzonePickerElement as unknown as CustomElementConstructor, { config: COMPONENT_CONFIG, logging });
registerComponent('web-dropzone-list', DropzoneListElement as unknown as CustomElementConstructor, { config: COMPONENT_CONFIG, logging });
registerComponent('web-dropzone-indicator', DropzoneIndicatorElement as unknown as CustomElementConstructor, { config: COMPONENT_CONFIG, logging });
registerComponent('web-dropzone-progress', DropzoneProgressElement as unknown as CustomElementConstructor, { config: COMPONENT_CONFIG, logging });
registerComponent('web-dropzone', DropzoneElement as unknown as CustomElementConstructor, { config: COMPONENT_CONFIG, logging });

declare global {
    interface HTMLElementTagNameMap {
        'web-dropzone': DropzoneElement;
        'web-dropzone-picker': DropzonePickerElement;
        'web-dropzone-list': DropzoneListElement;
        'web-dropzone-indicator': DropzoneIndicatorElement;
        'web-dropzone-progress': DropzoneProgressElement;
    }
}
