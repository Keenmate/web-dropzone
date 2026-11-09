# Accessibility — `@keenmate/web-dropzone-core`

This package renders nothing, so keyboard handling, ARIA, focus and contrast are the **renderer's**
job. See [usage.md](./usage.md) for the API.

What a renderer built on the store should cover — the contract the official `<web-dropzone>` follows
([its accessibility.md](https://github.com/keenmate/web-dropzone/blob/main/packages/web-dropzone/docs/accessibility.md)):

- **A keyboard path to the file dialog.** Drag and drop is pointer-only; a focusable control
  (a native `<input type="file">` or a `<button>` that clicks it) must open the dialog with
  <kbd>Enter</kbd> / <kbd>Space</kbd>, and feed `controller.addFiles(input.files)`.
- **Named row controls.** Remove / cancel / pause / resume / retry buttons named per file — the label
  helpers produce them: `resolveLabel` / `createLabelFn` with `removeFile`, `cancelFile`, … and
  `{ name: file.name }`.
- **Status as text, not color alone.** `statusLabel()` / `fileStatusLabel()` give the localised status
  word (`statusAria` for an `aria-label` such as "Status: Uploading").
- **Progress semantics.** `role="progressbar"` with `aria-valuenow` from `file.progress` /
  `getOverallProgress().percent`; mark a row `aria-busy="true"` while its file uploads.
- **Announcements.** Render rejected files (`file-reject`, `validation.error` is already a localised
  message) where a screen reader reaches them, e.g. a `role="status"` region.
- **Disabled vs read-only.** If your control can be disabled, follow native semantics: disabled = not
  focusable and nothing submitted; read-only = focusable, no changes (`aria-disabled="true"`).
- **Escaping.** File names are user data — insert them as text (`textContent`) or through
  `escapeHtml()`.
