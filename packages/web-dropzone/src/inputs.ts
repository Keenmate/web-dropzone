/**
 * Converters shared by `<web-dropzone>` and its satellites (core input rows).
 */
import { toObject, type Converter } from '@keenmate/web-components-core';
import { isLabelsValue } from '@keenmate/web-dropzone-core';
import type { DropzoneLabels } from '@keenmate/web-dropzone-core';

/**
 * `labels` input: core `toObject()` with the labels shape check — a partial
 * `DropzoneLabels` object (property), or the same as a JSON attribute
 * (`labels='{"cancelFile":"Zrušit {name}"}'`). Absent / `undefined` → the
 * built-in English. A malformed attribute or a non-object / non-string value is
 * refused (core's rule: warning, `input-rejected`, previous value kept). Merged
 * per key at lookup time.
 */
export const labelsConverter: Converter<Partial<DropzoneLabels>> = toObject<Partial<DropzoneLabels>>({ validate: isLabelsValue });
