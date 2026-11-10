# Accessibility — `@keenmate/web-dropzone`

Keyboard, ARIA and focus behaviour of `<web-dropzone>` and its satellites. Every visible string an
assistive technology announces comes from `labels` (see [usage.md](./usage.md#labels-i18n)), so
accessible names are localised together with the UI. Color contrast follows the theme tokens — see
[theming.md](./theming.md).

## Keyboard

| Surface | Keys | What happens |
|---|---|---|
| Card selector (`selector-appearance="card"`, the default) | <kbd>Tab</kbd> | One tab stop: the visually-hidden native `<input type="file">` inside the card. The card shows a `:focus-within` ring. |
| | <kbd>Enter</kbd> / <kbd>Space</kbd> | Opens the native file dialog. |
| Button / minimal / native selector | <kbd>Tab</kbd>, <kbd>Enter</kbd> / <kbd>Space</kbd> | The selector's own `<button>` is the tab stop (the hidden input leaves the tab order) and always opens the file dialog — also with a popover list that has files (the popover opens from its summary line / indicator chip). |
| Row buttons (Cancel ⊘, Remove ✕, pause / resume / retry) | <kbd>Tab</kbd>, <kbd>Enter</kbd> / <kbd>Space</kbd> | Native `<button>`s. A button that doesn't apply to the row's state is hidden with `tabindex="-1"` + `aria-hidden="true"`, so it is never a dead tab stop. |
| "Show N more" / "Show less", rolling queue button | <kbd>Tab</kbd>, <kbd>Enter</kbd> / <kbd>Space</kbd> | Native `<button>`s. |
| Compact summary line (`display-mode="compact"`, `list-appearance="popover"`) | <kbd>Tab</kbd>, <kbd>Enter</kbd> / <kbd>Space</kbd> | `role="button"`, `tabindex="0"`: opens the file popover (on `<web-dropzone-list>` alone it fires `summary-activate`). |
| Compact popover | <kbd>Esc</kbd> | Closes the popover and returns focus to the trigger; an outside click (decided when the click ends) closes it too, and so does opening another Keenmate overlay (a dropdown, a menu, another popover). |
| Drag overlay (`overlay-target`) | <kbd>Esc</kbd> | Dismisses the full-viewport drag overlay. |
| Armed page drag (`highlight-on-page-drag`) | <kbd>Esc</kbd> | Disarms. |
| Indicator chip (`<web-dropzone-indicator drawer="auto">`) | <kbd>Tab</kbd>, <kbd>Enter</kbd> / <kbd>Space</kbd> | A native `<button>` (`aria-expanded`) toggling the drawer; opening moves focus to the drawer's Close button. |
| Indicator drawer | <kbd>Esc</kbd>, or its Close button | Closes the drawer and returns focus to the chip; an outside click closes it too, and so does opening another Keenmate overlay (core overlay tree, topmost overlay first). |
| `<web-dropzone-progress>` bulk buttons | <kbd>Tab</kbd>, <kbd>Enter</kbd> / <kbd>Space</kbd> | Native `<button>`s (Pause all / Resume all / Cancel all / Retry all). |

## Disabled and read-only

The pair follows native form-control semantics (web-components-core SPEC §6.4):

- **`disabled`** (or an ancestor `<fieldset disabled>`) — every control gets the native `disabled`
  attribute: the selector, the row buttons (pause / resume / retry, cancel, remove), Show more / less,
  the rolling queue button, the popover actions and the bulk buttons (Pause all, Cancel all, …); the
  summary line (`role="button"`) gets `aria-disabled="true"` and leaves the tab order. No interaction,
  not focusable, no drops; the form value isn't submitted.
- **`readonly`** — the user can't change the selection, but the controls stay focusable and are marked
  `aria-disabled="true"` (never the native `disabled`), and they never open the file dialog; the files
  can still be looked at (the summary line that opens the popover list stays active) and are submitted
  with the form.

`<web-dropzone-picker>` has the same pair (`disabled` / `readonly`, presence attributes —
`disabled="false"` is disabled, like a native control); a disabled or read-only store makes its
pickers disabled / read-only too. The list, progress strip and indicator follow their store: under a
disabled store their buttons (rows, bulk actions, the drawer chip) are disabled too; under a read-only
store the list offers no row Remove.

Calls from code (`addFiles()`, `removeFile()`, …) work under both.

## ARIA roles and states

| Element | Role / attribute | Accessible name / value |
|---|---|---|
| Card file input | native `input[type=file]` | `aria-label` = the `prompt` label |
| Minimal selector button | native `button` | `aria-label` = the `prompt` label |
| Row status glyph | `aria-label` | `statusAria` label, e.g. "Status: Uploading" |
| Row root while its file uploads | `aria-busy="true"` | — (the inline loader is `aria-hidden`) |
| Row Cancel / Remove / action buttons | native `button` | `cancelFile` / `removeFile` / `pauseFile` / `resumeFile` / `retryFile` labels with `{name}` = the file name |
| "Show more" toggle | native `button` | `showMore` / `showLess` label |
| Overall progress bar | `role="progressbar"` | `aria-valuenow` (0–100), `aria-valuemin="0"`, `aria-valuemax="100"` |
| Compact summary line | `role="button"` | `viewFiles` label |
| Indicator chip, `drawer="auto"` | native `button` | `indicatorStatus` label |
| Indicator chip, `drawer="off"` | `role="status"` | `indicatorStatus` label |
| Indicator drawer | `role="dialog"` | `aria-label` = the `indicatorQueue` label; its close button = the `close` label |
| Indicator upload loader | `role="status"` container (core `renderLoader()`) | — |

Disabled / read-only state on the selector: native `disabled` / `aria-disabled="true"` (above).
Form validity (`min-file-count`) uses the native constraint API — `valueMissing` with the
`errorMinFileCount` message — so the browser announces it on submit.

## Screen-reader notes

- File rows, status glyphs and the progress bar update in place (no re-render of the whole list), so a
  focused row button keeps its focus while the upload progresses.
- The chip of `drawer="off"` is a `role="status"` region: its text changes ("2 uploading", "1 failed")
  are announced politely.
- Labels are text: they are always inserted escaped, never as HTML.

## Focus management

- Opening the file dialog returns focus to the control that opened it (browser behaviour).
- The compact popover keeps focus on its trigger when it opens; when it closes on <kbd>Esc</kbd> while
  focus is inside it, focus returns to the trigger (core `createPopover()`). On a phone-width viewport
  it is a full-screen sheet with a Close button, which also gives focus back to the trigger.
- The indicator drawer (`role="dialog"`) moves focus to its Close button when it opens (it doesn't
  trap it); <kbd>Esc</kbd> or the Close button closes it and focus returns to the chip, an outside
  click closes it without moving focus. On a phone-width viewport the open drawer is a full-screen
  sheet — see [theming.md](./theming.md#phone-presentation).
- A DOM move of the element keeps its UI state (no rebuild), so focus inside it is not reset by a
  re-parent.

## Contrast

The default palette is the `@keenmate/base-css-variables` contract (light and dark via `color-scheme`);
`e2e/contract-parity.spec.ts` keeps the component's fallbacks equal to the contract. Status colors
(success / warning / error) are always paired with a glyph and a text label, never color alone.
