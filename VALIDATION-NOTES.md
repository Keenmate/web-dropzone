# Validation notes — accepted deviations

This file records deviations from the BlissFramework component guidelines
that the team has accepted as the correct outcome for this repository.
Each entry explains *why the deviation is correct here*; future
`/validate-web-component` runs (and `kmwc doctor`) read this file and
downgrade matching flags from ❌ Fail to ⚠️ Exception (or ✅ Pass),
removing them from the punch-list.

Deferrals ("we'll fix this later") are **not** valid entries — they get
re-promoted to Fails on every run by design. Only architectural
decisions belong here.

The repo is a monorepo (`packages/web-dropzone` = the `<web-dropzone>`
renderer + four satellites, `packages/web-dropzone-core` = the headless
store); the entries below concern `packages/web-dropzone` unless stated.

## C-CST-4 — five element classes sharing render helpers and a satellite base

`packages/web-dropzone/src` holds five custom elements, not one Logic class:
`<web-dropzone>` (the store + its built-in renderer `dropzone.ts`) and four
satellites (`web-component-picker / -list / -indicator / -progress.ts`). The
imports the auto-script pairs as "service → service" are:

- the satellites' shared `BlissElement` base class and binding helpers
  (`satellite-base.ts`, with the shared input converters in `inputs.ts` and the
  internal store link in `store-link.ts`) — a base class, not a Service;
- pure, stateless row / status renderers shared by the store's renderer and the
  list / indicator satellites (`row-templates.ts`, `row-patching.ts`,
  `status-surface.ts`) — Side-layer helpers, so the rows look the same in every
  element;
- `page-file-drag.ts`, the one shared page-wide drag tracker every armed
  element subscribes to.

None of these holds per-instance business state; the store's state lives in
`@keenmate/web-dropzone-core`. Same shape as web-treeview's subsystem split
(its VALIDATION-NOTES → C-CST-4). PASS with note; the regex can't tell a base
class or a pure helper from a Service.

## C-CSS-5 — `indicator.css` is loaded by `<web-dropzone-indicator>` only

`main.css` is inlined into the shadow root of **every** element in the
package (`<web-dropzone>` and the four satellites). `indicator.css` holds
the chip + slide-out drawer of `<web-dropzone-indicator>`, a satellite-only
surface with no counterpart inside `<web-dropzone>` or the other
satellites, so it is imported (`?inline`) next to `main.css` by
`src/web-component-indicator.ts` alone instead of being bundled into
`main.css`. Importing it from `main.css` would ship the drawer chrome to
every satellite shadow root. It sits in the same cascade (layer-less
partial, loaded after `main.css`) and follows every other CSS rule
(banners, BEM, `--dz-*` only). Its rules sit in an `@layer component { … }`
block (adopted after `main.css`, so they still win inside that layer) so the
phone sheet in `sheet.css` — imported by `main.css` into `overrides`, shared
with the compact popover — restyles the drawer without a second copy.
PASS with note.

## C-TC-7 — `display: contents` on the fixed-edge `<web-dropzone-indicator>` host

The container of `<web-dropzone>` and of the picker / list / progress
satellites is `:host { display: block }` (`variables.css`). The one
`display: contents` is `<web-dropzone-indicator>`'s `:host` in its
**fixed-edge** positions (`right` / `left` / `top` / `bottom`,
`indicator.css`): there the element renders nothing in flow — the chip and
the drawer are `position: fixed` children — so the host is a pure mount
point. `contents` keeps that zero-footprint element out of the consumer's
layout (no flex / grid gap, no line box) wherever it is dropped. The host
is still the theme container: custom properties set on it inherit to the
chip and drawer exactly as with a block host. In **inline** mode
(`position="inline"`) the host is the visible box and becomes
`display: inline-block` + `position: relative` (the drawer anchors to it).
The rule title allows a documented exception ("display: block (or
documented exception)"); this is it. PASS with note.

## C-CS-5 — the dark-mode fixtures live at the repo root

The auto-check looks for a fixture inside the package directory
(`packages/web-dropzone/{docs/test,test,e2e}/…`, `examples-theming.html`).
In this monorepo the test fixtures, the Playwright suite and the example
pages live at the **repo root** (one shared devkit / Playwright setup for
both packages): `test/theme-context.html` + `e2e/theme-context.spec.ts`
mount the element under every supported signal (`data-theme`,
`data-bs-theme`, `.dark` / `.light` on `<html>` and `<body>`, OS
preference, per-instance `data-theme`) and assert the resolved scheme;
`test/theming.html` + `e2e/theming.spec.ts` and
`e2e/contract-parity.spec.ts` cover the token values; `examples-theming.html`
shows the dark card. Rulebook gap: the check doesn't look at the monorepo
root. PASS with note.

## C-BV-6 — input variables listed in the manifest but not declared

`--dz-rem`, `--dz-font-family` and `--dz-file-list-max-height` are
**input** variables: they are deliberately not declared on `:host`, and
every read carries its fallback (`var(--dz-rem, 10px)`,
`var(--dz-font-family, var(--base-font-family, inherit))`,
`var(--dz-file-list-max-height, none)`). The same stylesheet is injected
into the store host *and* every satellite shadow root, so a `:host`
declaration would re-declare the value on each satellite and mask the one
the consumer set on `<web-dropzone>` (or any ancestor) — see the note at
the top of `variables.css`. They are listed in
`component-variables.manifest.json` because that is where a consumer finds
them (`kmwc doctor`'s `[vars]` check also requires every `--dz-*` the CSS
reads to be there). Same decision as web-treeview's `C-BV-3 / C-BV-6`
entry. Rulebook gap: a manifest marker for "input variable" (the
`rulebook-gaps-from-devkit.md` #1 item). PASS with note.
