/**
 * Converters shared by `<web-dropzone>` and its satellites (core input rows).
 */
import { toCustom, type Converter } from '@keenmate/web-components-core';
import { isLabelsValue } from '@keenmate/web-dropzone-core';
import type { DropzoneLabels } from '@keenmate/web-dropzone-core';

/**
 * `labels` input: a partial `DropzoneLabels` object (property), or the same as
 * a JSON attribute (`labels='{"cancelFile":"Zrušit {name}"}'`). Absent → null
 * (built-in English). A malformed attribute is reported and the previous value
 * kept (core's invalid-attribute rule). Merged per key at lookup time.
 */
export const labelsConverter: Converter<Partial<DropzoneLabels> | null> = toCustom<Partial<DropzoneLabels> | null>(
    (raw, reportInvalid) => {
        if (raw == null || raw.trim() === '') return null;
        try {
            const parsed: unknown = JSON.parse(raw);
            if (isLabelsValue(parsed)) return parsed;
        } catch { /* reported below */ }
        reportInvalid?.('expected a JSON object of strings');
        return null;
    },
    { validate: (v): v is Partial<DropzoneLabels> | null => v == null || isLabelsValue(v) },
);

