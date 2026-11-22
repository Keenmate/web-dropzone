/**
 * Converters shared by `<web-dropzone>` and its satellites (core input rows).
 */
import { toBool, toObject, type Converter } from '@keenmate/web-components-core';
import { DEFAULT_CONFIG, isLabelsValue } from '@keenmate/web-dropzone-core';
import type { DropzoneLabelOverrides } from '@keenmate/web-dropzone-core';

/** The boolean `DropzoneEngineOptions` keys that have a default in `DEFAULT_CONFIG`. */
type DefaultedFlag = { [K in keyof typeof DEFAULT_CONFIG]: (typeof DEFAULT_CONFIG)[K] extends boolean ? K : never }[keyof typeof DEFAULT_CONFIG];

/**
 * Boolean input whose absent value is the engine's own default
 * (`DEFAULT_CONFIG[key]` → core `toBool('default-true' | 'default-false')`):
 * the defaults live once, in `@keenmate/web-dropzone-core`, so a standalone
 * `DropzoneEngine` and `<web-dropzone>` agree (rulebook C-CA-37). Value rows
 * read `default: DEFAULT_CONFIG.<key>` the same way.
 */
export const defaultFlag = (key: DefaultedFlag): Converter<boolean> =>
    toBool(DEFAULT_CONFIG[key] ? 'default-true' : 'default-false');

/**
 * `labels` input: core `toObject()` with the labels shape check — a partial
 * `DropzoneLabels` object (property), or the same as a JSON attribute
 * (`labels='{"ariaLabels.cancelFile":"Zrušit {ctx.name}"}'`). Absent / `undefined` → the
 * built-in English. A malformed attribute or a non-object / non-string value is
 * refused (core's rule: warning, `input-rejected`, previous value kept). Merged
 * per key at lookup time.
 */
export const labelsConverter: Converter<DropzoneLabelOverrides> = toObject<DropzoneLabelOverrides>({ validate: isLabelsValue });
