# Theming — `@keenmate/web-dropzone-core`

This package ships **no CSS and renders nothing**, so it has no theme container, no CSS variables and
no color-scheme handling of its own — your renderer owns all of that. See [usage.md](./usage.md) for the
API.

What the package gives a renderer to stay visually consistent with `<web-dropzone>`:

- **Icons** — `STATUS_ICONS` (one glyph per `FileStatus`), `ACTION_ICONS` + `actionForStatus(status)`
  (pause / resume / retry per status), `CANCEL_ICON`, `FILE_TYPE_ICONS` / `getFileIcon()` (per file-type
  category), `UI_ICONS`. All are Lucide SVG strings drawn in `currentColor`, so they take the color of
  the surrounding text — theme them with `color`.
- **Status vocabulary** — `FileStatus` and the status-surface `StatusAggregate.overallStatus`
  (`error` > `uploading` > `paused` > `pending` > `complete`, `idle` when empty) — the priority the
  rendered element uses to pick its status color.
- **Labels** — `DEFAULT_LABELS` / `resolveLabel()` / `createLabelFn()`: the same UI strings (and
  their per-key overrides) as the element.

To reuse the rendered element's look instead, use `@keenmate/web-dropzone` — its theming contract
(`--dz-*` on the `--base-*` taxonomy, dark mode, cascade layers) is documented in
[its theming.md](https://github.com/keenmate/web-dropzone/blob/main/packages/web-dropzone/docs/theming.md).
