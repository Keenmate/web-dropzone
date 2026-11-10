# Theming — `@keenmate/web-dropzone`

Every visual of `<web-dropzone>` and its satellites (`<web-dropzone-picker>`, `-list`, `-indicator`,
`-progress`) is a CSS custom property. Each color resolves through a `--base-*` design-system token
(set once for the page) and then a `--dz-*` component token (set per instance or per subtree). See
[usage.md](./usage.md) for the API surface and [examples.md](./examples.md) for a themed instance.

## Quick theme

```css
/* Design-system level — every KeenMate component on the page */
:root {
  --base-primary-color: #14b8a6;
  --base-main-bg: #ffffff;
}

/* Component level — this dropzone (and everything it mounts) */
web-dropzone {
  --dz-accent-color: #10b981;
  --dz-dropzone-border-radius: 1rem;
  --dz-rem: 12px; /* scale the whole instance (default 10px) */
}
```

## Container contract

- **The theme container is `:host`.** Set variables on the element, on any ancestor, or on `:root`;
  they inherit into the shadow root. `<web-dropzone>`, `<web-dropzone-picker>`, `<web-dropzone-list>`
  and `<web-dropzone-progress>` are `display: block`, `position: relative`, `box-sizing: border-box`.
  `<web-dropzone-indicator>` is a zero-footprint mount point in its fixed-edge positions
  (`display: contents` — the chip and drawer are `position: fixed`) and an `inline-block` box with
  `position="inline"`.
- **Satellites inherit from their store.** In the default bulk render mode `<web-dropzone>` mounts its
  picker / list / progress as satellite elements tagged `managed`. The token defaults are declared on
  `:host(:not([managed]))`, so a managed satellite declares nothing and inherits every `--dz-*` set on
  `<web-dropzone>`. A standalone satellite (`<web-dropzone-list for="…">` placed by you) carries the
  defaults and themes independently.
- **The host is transparent** (no `:host { background }`). The visible chrome — the card
  (`.dz__dropzone--card`), the file rows (`.dz__file-item`), the indicator chip — paints its own
  surface, so a headless store and the satellites sit inline in your layout without a background
  rectangle. This is the documented exception to theme-container.md → "Default background".
- **Sizing unit.** `--dz-rem` (default `10px`) scales every size. It is an *input* variable — read as
  `var(--dz-rem, 10px)`, never declared on `:host` — so a value set on `<web-dropzone>` or any ancestor
  reaches every satellite. The same holds for `--dz-font-family` and `--dz-file-list-max-height`.

```html
<web-dropzone style="--dz-rem: 8px"></web-dropzone>   <!-- 80% -->
<web-dropzone style="--dz-rem: 12px"></web-dropzone>  <!-- 120% -->
```

## Host state hooks

| Hook | When |
|---|---|
| `[ready]` / `:state(ready)` | After the first build (core). FOUC guard for a page: `web-dropzone:not([ready]) { visibility: hidden }` |
| `[disabled]` / `:disabled` | Disabled (also via an ancestor `<fieldset disabled>`) |
| `[readonly]` | Read-only (surface modifier `.dz__dropzone--readonly`) |
| `[armed]` / `:state(armed)` | Files are dragged over the page (`highlight-on-page-drag`) |
| `[data-context-theme]` | Page theme mirrored by web-components-core (`dark` / `light`) |
| `[data-motion]` | The element's own motion level (core `motion` attribute) |

Before the element is defined, the light-DOM rule in `main.css` (`web-dropzone:not(:defined)`,
and the same for the four satellite tags) hides any child text and reserves the card's
minimum height, so there is no flash before the upgrade.

## Color scheme (dark mode)

Light / dark values follow `color-scheme` (`light-dark()` fallbacks). The component never declares
`color-scheme` on `:host` — that would block the page's scheme from inheriting into the shadow root.
Signals, any of which flips it:

```html
<!-- OS / page preference (declare color-scheme once, anywhere): -->
<html style="color-scheme: light dark">

<!-- Bootstrap 5.3+ -->
<body data-bs-theme="dark">

<!-- Tailwind / generic -->
<body class="dark">
<body data-theme="dark">

<!-- Per-instance override (highest precedence): -->
<web-dropzone data-theme="dark"></web-dropzone>
<web-dropzone data-theme="light"></web-dropzone>  <!-- forces light on a dark page -->
```

The page signal (`data-theme`, `data-bs-theme`, `.dark` / `.light` on `<html>` then `<body>`, or the
element named by the core `theme-source` attribute) is mirrored onto the host as `data-context-theme`,
which `dark-mode.css` reads — a replacement for `:host-context()`, which Firefox and Safari don't support.

The `overlay-target` drag overlay lives on `<body>`, outside the shadow root, and takes the
**host's** resolved `color-scheme` (kept live while it's shown) — a `data-theme="dark"` dropzone on a
light page gets a dark overlay.

## Shared theme layer (`--base-*`)

The `--dz-*` tokens read [`@keenmate/base-css-variables`](https://www.npmjs.com/package/@keenmate/base-css-variables),
so a page theme (Theme Designer / Pure Admin) themes the dropzone without any `--dz-*` override.
Without the contract on the page the fallbacks give the same colors: inputs fall back to the contract
defaults (accent `#3b82f6`), derived tokens (hover, tints, text levels, borders, text on the accent) to
the contract's formula on the `--dz-*` input — so `--dz-accent-color` alone re-colors its hover, tint
and text. `npm run check:contract` and `e2e/contract-parity.spec.ts` keep it that way.

## Cascade layers

`main.css` declares `@layer variables, component, overrides;`:

- `variables` — the `:host { --dz-* }` declarations;
- `component` — the base + feature rules;
- `overrides` — dark mode, framework themes.

Any **unlayered** consumer rule beats every rule in `@layer component` — no `!important` needed — and a
`:root { --base-X }` declaration trivially beats the `variables` layer.

**Footgun:** a global, unlayered universal reset (Bootstrap reboot, Tailwind preflight, a hand-rolled
`* { margin: 0; padding: 0; box-sizing: border-box }`) beats *every* rule in the component's
`@layer component` per the cascade spec. Wrap the reset in a layer so the library's layered defaults win:

```css
@layer reset, page;
@layer reset {
  * { margin: 0; padding: 0; box-sizing: border-box; }
}
/* The rest of your overrides stay unlayered — they still win. */
```

## Extra CSS for the shadow root

Page CSS can't reach inside a shadow root (except through the `--dz-*` variables and the parts below).
For anything else, every element of the family takes extra CSS the same way (web-components-core
`createCustomStyles()`), in two layers — the instance layer comes after the page layer, so it
overrides it:

| Layer | Where | How |
|---|---|---|
| Page (per tag) | every instance of that tag on the page | `window.components['web-dropzone'].customStyles = '…'` or `.getCustomStylesCallback = (ctx) => '…'` |
| Instance | one element | `custom-styles="…"` attribute / `el.customStyles` property, or `el.getCustomStylesCallback = (ctx) => '…'` |

```js
// every <web-dropzone> on the page (the compact popover lives in the store's own shadow root)
window.components['web-dropzone'].customStyles = `.dz__popover { border-radius: 0; }`;
// every <web-dropzone-picker> (also the ones a <web-dropzone> mounts itself)
window.components['web-dropzone-picker'].customStyles = `.dz__dropzone-text { font-weight: 600; }`;
```

```html
<web-dropzone display-mode="compact" custom-styles=".dz__popover-header { font-weight: 700; }"></web-dropzone>
<web-dropzone-list for="uploads" custom-styles=".dz__file-item-name { font-style: italic; }"></web-dropzone-list>
```

- In each layer the callback wins over the string. Both are re-applied on every build and when they
  change (assigning the page layer later restyles live instances); removing `custom-styles` falls back
  to the page layer. The callback's `ctx` carries `controller` / `element`.
- An `@import` (an icon font) is also linked once in the document `<head>`, because Chromium ignores
  `@font-face` inside a shadow root (`window.components.shouldHoistImports = false` turns that off).
- The value is raw CSS and is **not** sanitized — see the XSS notice in
  [usage.md](./usage.md#html-injection-xss-notice).
- **One shadow root each.** A `<web-dropzone>`'s custom CSS reaches its **own** shadow root only. In
  bulk mode (the default when display attributes are set) the picker / list / progress it shows are
  satellite elements it mounts itself, each with its own shadow root — the store's own shadow root
  holds only the layout container and the compact popover — so the store's `custom-styles` does not
  style the card or the rows (in `render-mode="structural"` the store renders everything itself, and
  it does); style those with the
  satellite tags' page layer — `window.components['web-dropzone-picker'].customStyles`,
  `['web-dropzone-list']`, `['web-dropzone-progress']` (the indicator's drawer list is a
  `<web-dropzone-list>` too). The page layer is page-wide: scope a rule to one store by a host
  attribute if you need to (`:host([managed]) …` targets only mounted satellites).
- Selectors: the flat BEM classes below (`.dz__file-item-name`, never `.dz__file-item__name`).

## Shadow parts and BEM hooks

| Element | Part | What |
|---|---|---|
| `<web-dropzone-indicator>` | `chip` | The status chip (strip the pill: `::part(chip) { border: 0; background: none; padding: 0 }`) |
| `<web-dropzone-indicator>` | `drawer` | The slide-out drawer |
| `<web-dropzone-progress>` | `root` | The overall-progress strip wrapper |

Inside the shadow root every class is flat BEM under the `dz__` prefix (`.dz__dropzone`,
`.dz__dropzone--card`, `.dz__file-item`, `.dz__preview-item`, `.dz__popover`, `.dz__summary-line`,
`.dz__indicator-chip`, `.dz__indicator-drawer`, …) — reachable from `custom-styles`.

## Motion

Every transition and animation uses the contract's four speeds (`--dz-transition-fast|normal|medium|slow`
→ `--base-duration-*`, 0.1 / 0.15 / 0.25 / 0.3s) and easings (`--dz-easing-snappy` / `--dz-easing-out` →
`--base-ease-*`), including the drag overlay on `<body>` (timed from the host's variables). Turn it off
with CSS, or with the core `motion` attribute / `window.components.motion`:

```css
web-dropzone { --dz-transition-fast: 0s; --dz-transition-normal: 0s;
               --dz-transition-medium: 0s; --dz-transition-slow: 0s; }  /* one dropzone */
:root { --base-duration-fast: 0s; --base-duration-normal: 0s;
        --base-duration-medium: 0s; --base-duration-slow: 0s; }         /* the whole page */
```

`prefers-reduced-motion: reduce` sets them to `0s` (and the uploading-row pulse). The loader keeps
turning — it shows that an upload is running; the contract slows it (`--base-loader-duration` 1.5s).

## Loader

One loader look for every KeenMate component (the `--base-loader-*` contract): a single-colour mask
shape in `currentColor`.

| Token | Default |
|---|---|
| `--dz-loader-icon` | `var(--base-loader-icon, <arc SVG>)` |
| `--dz-loader-rotate` | `var(--base-loader-rotate, 1turn)` (`0` = the SVG animates itself) |
| `--dz-loader-duration` | `var(--base-loader-duration, 0.8s)` |
| `--dz-loader-size` | `var(--base-loader-size, 1.25em)` — the indicator chip's upload loader |
| `--dz-loader-inline-size` | `calc(var(--dz-loader-size) * 0.75)` — the tiny per-row / summary loader |

The indicator chip's upload loader is drawn by core `renderLoader()` into a `role="status"` container:
the store's `renderLoadingCallback`, else the page-wide `window.components.renderLoadingCallback`, else
the default `<span class="dz__loader">` (`ctx.context` = `'upload'`). The per-row status and the summary
icon show the CSS-only `.dz__loader--inline` while uploading (the row carries `aria-busy="true"`).

## Phone presentation

On a phone-width viewport (`@media (max-width: 600px)`) the `<web-dropzone-indicator>` drawer becomes
an edge-to-edge full-screen sheet (`100dvw` × `100dvh`, no border / radius / shadow), with
`env(safe-area-inset-*)` padding on all four edges and a close button of at least
`--dz-touch-target-min` (`--base-touch-target-min`, 44px). Its list and the compact-mode popover's
list use `overscroll-behavior: contain`, so a fling at the list edge doesn't scroll the page behind.

## Popover gap

The compact-mode popover opens `--base-dropdown-offset` away from its trigger (the summary line /
selector; `@keenmate/base-css-variables` 2.0.1+, `4px` when unset) — the one field → panel gap every
KeenMate component shares; core reads it on the trigger when the popover opens. Set it page-wide, per
section, or per component: `web-dropzone { --base-dropdown-offset: 8px; }`.

## Variable reference

Generated from [`component-variables.manifest.json`](../component-variables.manifest.json) (also exported
as `@keenmate/web-dropzone/manifest`).

### Base variables read (`--base-*`)

| Variable | Usage |
|---|---|
| `--base-primary-color` | Primary brand / focus color. Card border on drag-over, focus outline, progress fill. |
| `--base-primary-color-hover` | Hover state for accent surfaces. |
| `--base-primary-color-active` | Pressed state for accent surfaces. |
| `--base-primary-bg-subtle` | Light tint of accent — selected-row backgrounds, range highlights. |
| `--base-primary-bg-subtle-hover` | Hover on the accent tint. |
| `--base-text-color-1` | Primary body text — file names, dropzone prompt. |
| `--base-text-color-2` | Secondary text — file metadata, summary line. |
| `--base-shadow-color` | Shadow colour for the popover, drag indicator and overlay hover (one tone with pure-admin) |
| `--base-text-color-3` | Muted text — hints, empty state, file-size labels. |
| `--base-text-color-4` | Faint text — decorative, disabled. |
| `--base-on-primary-text-color` | Text laid over accent surfaces — progress fill labels. |
| `--base-main-bg` | Primary surface — dropzone card, popover body, file-item background. |
| `--base-elevated-bg` | Elevated surface — popover header/footer, secondary buttons. |
| `--base-hover-bg` | Hover overlay — preview-tile and button hover (standalone: the contract formula on --dz-main-bg). |
| `--base-border-color` | Default border / separator color — dropzone dashed border, item separator. |
| `--base-danger-color` | Validation errors, error-state borders, remove-button hover. |
| `--base-success-color` | Completed-upload borders + status icon; standalone fallback of the drop-target look. |
| `--base-success-bg-subtle` | Fallback of --dz-dropzone-bg-armed when the contract has no --base-drop-target-bg. |
| `--base-success-bg-subtle-hover` | Fallback of --dz-dropzone-bg-active when the contract has no --base-drop-target-bg-active. |
| `--base-drop-target-bg` | Card background while files are dragged anywhere over the page (--dz-dropzone-bg-armed, highlight-on-page-drag). |
| `--base-drop-target-bg-active` | Card background while files are dragged over it (--dz-dropzone-bg-active). |
| `--base-drop-target-border-color` | Card border colour while files are dragged over it (--dz-dropzone-border-active). |
| `--base-warning-color` | Warning-state borders + status icon. |
| `--base-font-family` | Font family for all component text. |
| `--base-font-size-xs` | Smallest text — hints, badge font, popover limits. |
| `--base-font-size-sm` | Standard text — prompts, item names, buttons. |
| `--base-font-size-base` | Body text size. |
| `--base-font-weight-normal` | Normal text weight. |
| `--base-font-weight-semibold` | Header / emphasis weight — popover header, item name. |
| `--base-line-height-normal` | Default line-height multiplier. |
| `--base-border-radius-sm` | Tight corners — buttons, summary line, file items. |
| `--base-border-radius-md` | Standard corners — preview tiles. |
| `--base-border-radius-lg` | Large corners — dropzone card, popover. |
| `--base-duration-fast` | Motion speed fast (0.1s) — drag-overlay hover. 0s turns it off. |
| `--base-duration-normal` | Motion speed normal (0.15s) — hovers, fades, progress-bar width, drawer. 0s turns it off. |
| `--base-duration-medium` | Motion speed medium (0.25s). 0s turns it off. |
| `--base-duration-slow` | Motion speed slow (0.3s) — rolling rotation, overall progress. 0s turns it off. |
| `--base-ease-standard` | Standard easing — every transition. |
| `--base-ease-out` | Ease-out — fade-ins, progress-fill growth. |
| `--base-disabled-opacity` | Disabled dimming of the dropzone and its buttons. |
| `--base-loader-icon` | Loader shape (drives --dz-loader-icon). |
| `--base-loader-rotate` | Loader rotation per cycle (drives --dz-loader-rotate). |
| `--base-loader-duration` | Loader cycle 0.8s, 1.5s under reduced motion (drives --dz-loader-duration). |
| `--base-loader-size` | Loader size (drives --dz-loader-size). |
| `--base-touch-target-min` | Minimum tap size of phone-mode controls (drives --dz-touch-target-min). |

### Component variables (`--dz-*`)

- [accent](#accent-tokens)
- [surface](#surface-tokens)
- [badges](#badges-tokens)
- [radius](#radius-tokens)
- [selector](#selector-tokens)
- [state](#state-tokens)
- [dropzone](#dropzone-tokens)
- [dropzone-card](#dropzone-card-tokens)
- [motion](#motion-tokens)
- [empty-state](#empty-state-tokens)
- [semantic](#semantic-tokens)
- [file-list](#file-list-tokens)
- [typography](#typography-tokens)
- [icons](#icons-tokens)
- [file-item](#file-item-tokens)
- [progress](#progress-tokens)
- [overlay](#overlay-tokens)
- [popover](#popover-tokens)
- [preview-grid](#preview-grid-tokens)
- [sizing](#sizing-tokens)
- [rolling](#rolling-tokens)
- [show-more](#show-more-tokens)
- [loader](#loader-tokens)
- [summary](#summary-tokens)
- [text](#text-tokens)

#### accent tokens

| Variable | Usage |
|---|---|
| `--dz-accent-bg` | accent bg |
| `--dz-accent-color` | accent color |
| `--dz-accent-color-active` | accent color active |
| `--dz-accent-color-hover` | accent color hover |
| `--dz-accent-color-light` | accent color light |
| `--dz-accent-color-light-hover` | accent color light hover |

#### surface tokens

| Variable | Usage |
|---|---|
| `--dz-background` | background |
| `--dz-border-color` | border color |
| `--dz-hover-bg` | hover bg |
| `--dz-main-bg` | main bg — the contract input surfaces, text levels and borders derive from |
| `--dz-primary-bg` | primary bg |
| `--dz-primary-bg-hover` | primary bg hover |
| `--dz-shadow-color` | shadow color — popover, drag indicator, overlay hover |
| `--dz-surface-color` | surface color |

#### badges tokens

| Variable | Usage |
|---|---|
| `--dz-badge-action-size` | badge action size |
| `--dz-badge-border-radius` | badge border radius |
| `--dz-badge-font-size` | badge font size |
| `--dz-badge-font-weight` | badge font weight |
| `--dz-badge-height` | badge height |
| `--dz-badge-icon-bg` | badge icon bg |
| `--dz-badge-icon-border-radius` | badge icon border radius |
| `--dz-badge-icon-font-size` | badge icon font size |
| `--dz-badge-icon-size` | badge icon size |
| `--dz-badge-max-width` | badge max width |
| `--dz-badge-more-bg` | badge more bg |
| `--dz-badge-more-bg-hover` | badge more bg hover |
| `--dz-badge-more-color` | badge more color |
| `--dz-badge-remove-bg` | badge remove bg |
| `--dz-badge-remove-bg-hover` | badge remove bg hover |
| `--dz-badge-remove-border` | badge remove border |
| `--dz-badge-remove-box-shadow-focus` | badge remove box shadow focus |
| `--dz-badge-remove-color` | badge remove color |
| `--dz-badge-remove-color-hover` | badge remove color hover |
| `--dz-badge-remove-icon-size` | badge remove icon size |
| `--dz-badge-remove-width` | badge remove width |
| `--dz-badge-status-icon-size` | badge status icon size |
| `--dz-badge-text-bg` | badge text bg |
| `--dz-badge-text-bg-hover` | badge text bg hover |
| `--dz-badge-text-border` | badge text border |
| `--dz-badge-text-color` | badge text color |
| `--dz-badge-text-color-hover` | badge text color hover |
| `--dz-badge-text-padding` | badge text padding |
| `--dz-badges-gap` | badges gap |

#### radius tokens

| Variable | Usage |
|---|---|
| `--dz-border-radius-lg` | border radius lg |
| `--dz-border-radius-md` | border radius md |
| `--dz-border-radius-sm` | border radius sm |

#### selector tokens

| Variable | Usage |
|---|---|
| `--dz-button-badge-border-radius` | button badge border radius |
| `--dz-button-font-size` | button font size |
| `--dz-button-padding` | button padding |
| `--dz-minimal-icon-size` | minimal icon size |
| `--dz-minimal-size` | minimal size |

#### state tokens

| Variable | Usage |
|---|---|
| `--dz-disabled-opacity` | disabled dimming (base: --base-disabled-opacity, 0.65) |

#### dropzone tokens

| Variable | Usage |
|---|---|
| `--dz-dropzone-bg` | dropzone bg |
| `--dz-dropzone-bg-active` | Drop-target background while dragging over — chains --base-drop-target-bg-active (success 15% light / 30% dark) |
| `--dz-dropzone-bg-armed` | Armed drop-target background while files are dragged anywhere over the page (highlight-on-page-drag) — chains --base-drop-target-bg (success 10% light / 20% dark) |
| `--dz-dropzone-bg-hover` | dropzone bg hover |
| `--dz-dropzone-border` | dropzone border |
| `--dz-dropzone-border-active` | Drop-target border while dragging over — 2px solid --base-drop-target-border-color (success) |
| `--dz-dropzone-border-radius` | dropzone border radius |
| `--dz-dropzone-hint-color` | dropzone hint color |
| `--dz-dropzone-hint-font-size` | dropzone hint font size |
| `--dz-dropzone-icon-color` | dropzone icon color |
| `--dz-dropzone-icon-size` | dropzone icon size |
| `--dz-dropzone-min-height` | dropzone min height |
| `--dz-dropzone-padding` | dropzone padding |
| `--dz-dropzone-text-color` | dropzone text color |
| `--dz-dropzone-text-font-size` | dropzone text font size |

#### dropzone-card tokens

| Variable | Usage |
|---|---|
| `--dz-dropzone-card-big-icon-size` | dropzone card big icon size |
| `--dz-dropzone-card-big-min-height` | dropzone card big min height |
| `--dz-dropzone-card-big-padding` | dropzone card big padding |
| `--dz-dropzone-card-big-text-font-size` | dropzone card big text font size |
| `--dz-dropzone-card-minimal-icon-size` | dropzone card minimal icon size |
| `--dz-dropzone-card-minimal-min-height` | dropzone card minimal min height |
| `--dz-dropzone-card-minimal-padding` | dropzone card minimal padding |
| `--dz-dropzone-card-minimal-text-font-size` | dropzone card minimal text font size |

#### motion tokens

| Variable | Usage |
|---|---|
| `--dz-easing-out` | ease-out (base: --base-ease-out) — fade-ins, progress fill |
| `--dz-easing-snappy` | standard easing (base: --base-ease-standard) |
| `--dz-transition-fast` | speed fast 0.1s (base: --base-duration-fast); 0s = motion off |
| `--dz-transition-medium` | speed medium 0.25s (base: --base-duration-medium); 0s = motion off |
| `--dz-transition-normal` | speed normal 0.15s (base: --base-duration-normal); 0s = motion off |
| `--dz-transition-slow` | speed slow 0.3s (base: --base-duration-slow); 0s = motion off |
| `--dz-uploading-pulse-duration` | uploading-row pulse loop (1.5s; 0s under reduced motion) |

#### empty-state tokens

| Variable | Usage |
|---|---|
| `--dz-empty-color` | empty color |
| `--dz-empty-font-size` | empty font size |
| `--dz-empty-padding` | empty padding |

#### semantic tokens

| Variable | Usage |
|---|---|
| `--dz-error-bg` | error bg |
| `--dz-error-color` | error color |
| `--dz-success-bg` | success bg |
| `--dz-success-color` | success color |
| `--dz-warning-bg` | warning bg |
| `--dz-warning-color` | warning color |

#### file-list tokens

| Variable | Usage |
|---|---|
| `--dz-file-list-gap` | file list gap |
| `--dz-file-list-margin-top` | file list margin top |
| `--dz-file-list-max-height` | inline file-list max height; unset = none (grows with content). Input variable: not declared on :host, read as var(--dz-file-list-max-height, none) so a value on <web-dropzone> reaches the satellite list |

#### typography tokens

| Variable | Usage |
|---|---|
| `--dz-font-family` | component font family (overrides --base-font-family). Input variable: read as var(--dz-font-family, var(--base-font-family, inherit)) |
| `--dz-font-size-base` | font size base |
| `--dz-font-size-lg` | font size lg |
| `--dz-font-size-sm` | font size sm |
| `--dz-font-size-xs` | font size xs |
| `--dz-font-weight-medium` | font weight medium |
| `--dz-font-weight-normal` | font weight normal |
| `--dz-font-weight-semibold` | font weight semibold |
| `--dz-line-height-normal` | line height normal |
| `--dz-line-height-tight` | line height tight |

#### icons tokens

| Variable | Usage |
|---|---|
| `--dz-icon-remove` | icon remove |
| `--dz-status-icon-size` | status icon size |

#### file-item tokens

| Variable | Usage |
|---|---|
| `--dz-item-action-bg` | item action bg |
| `--dz-item-action-bg-hover` | item action bg hover |
| `--dz-item-action-color` | item action color |
| `--dz-item-action-color-hover` | item action color hover |
| `--dz-item-action-icon-size` | item action icon size |
| `--dz-item-action-size` | item action size |
| `--dz-item-bg` | item bg |
| `--dz-item-bg-hover` | item bg hover |
| `--dz-item-border` | item border |
| `--dz-item-border-radius` | item border radius |
| `--dz-item-icon-bg` | item icon bg |
| `--dz-item-icon-color` | item icon color |
| `--dz-item-icon-font-size` | item icon font size |
| `--dz-item-icon-size` | item icon size |
| `--dz-item-meta-color` | item meta color |
| `--dz-item-meta-font-size` | item meta font size |
| `--dz-item-name-color` | item name color |
| `--dz-item-name-font-size` | item name font size |
| `--dz-item-name-font-weight` | item name font weight |
| `--dz-item-padding` | item padding |
| `--dz-item-progress-text-width` | item progress text width |
| `--dz-item-progress-width` | item progress width |
| `--dz-item-remove-bg` | item remove bg |
| `--dz-item-remove-bg-hover` | item remove bg hover |
| `--dz-item-remove-color` | item remove color |
| `--dz-item-remove-color-hover` | item remove color hover |
| `--dz-item-remove-icon-size` | item remove icon size |
| `--dz-item-remove-size` | item remove size |
| `--dz-item-status-width` | item status width |

#### progress tokens

| Variable | Usage |
|---|---|
| `--dz-overall-progress-action-bg-hover` | overall progress action bg hover |
| `--dz-overall-progress-action-border-radius` | overall progress action border radius |
| `--dz-overall-progress-action-color` | overall progress action color |
| `--dz-overall-progress-action-font-size` | overall progress action font size |
| `--dz-overall-progress-action-font-weight` | overall progress action font weight |
| `--dz-overall-progress-action-padding` | overall progress action padding |
| `--dz-overall-progress-bar-height` | overall progress bar height |
| `--dz-overall-progress-gap` | overall progress gap |
| `--dz-overall-progress-padding` | overall progress padding |
| `--dz-overall-progress-percent-color` | overall progress percent color |
| `--dz-overall-progress-percent-font-weight` | overall progress percent font weight |
| `--dz-overall-progress-percent-min-width` | overall progress percent min width |
| `--dz-overall-progress-stats-color` | overall progress stats color |
| `--dz-overall-progress-stats-font-size` | overall progress stats font size |
| `--dz-progress-bg` | progress bg |
| `--dz-progress-border-radius` | progress border radius |
| `--dz-progress-fill-bg` | progress fill bg |
| `--dz-progress-height` | progress height |
| `--dz-progress-transition` | progress transition |

#### overlay tokens

| Variable | Usage |
|---|---|
| `--dz-overlay-bg` | overlay bg |
| `--dz-overlay-border` | overlay border |
| `--dz-overlay-border-radius` | overlay border radius |
| `--dz-overlay-color` | overlay color |
| `--dz-overlay-gap` | overlay gap |
| `--dz-overlay-icon-size` | overlay icon size |
| `--dz-overlay-text-font-size` | overlay text font size |
| `--dz-overlay-text-font-weight` | overlay text font weight |
| `--dz-overlay-z-index` | overlay z index |

#### popover tokens

| Variable | Usage |
|---|---|
| `--dz-popover-action-bg-hover` | popover action bg hover |
| `--dz-popover-action-border-radius` | popover action border radius |
| `--dz-popover-action-color` | popover action color |
| `--dz-popover-action-font-size` | popover action font size |
| `--dz-popover-action-font-weight` | popover action font weight |
| `--dz-popover-action-padding` | popover action padding |
| `--dz-popover-actions-gap` | popover actions gap |
| `--dz-popover-bg` | popover bg |
| `--dz-popover-body-padding` | popover body padding |
| `--dz-popover-border` | popover border |
| `--dz-popover-border-radius` | popover border radius |
| `--dz-popover-box-shadow` | popover box shadow |
| `--dz-popover-cell-padding` | popover cell padding |
| `--dz-popover-footer-bg` | popover footer bg |
| `--dz-popover-footer-border-top` | popover footer border top |
| `--dz-popover-footer-color` | popover footer color |
| `--dz-popover-footer-font-size` | popover footer font size |
| `--dz-popover-footer-padding` | popover footer padding |
| `--dz-popover-header-bg` | popover header bg |
| `--dz-popover-header-border-bottom` | popover header border bottom |
| `--dz-popover-header-color` | popover header color |
| `--dz-popover-header-font-size` | popover header font size |
| `--dz-popover-header-font-weight` | popover header font weight |
| `--dz-popover-header-gap` | popover header gap |
| `--dz-popover-header-padding` | popover header padding |
| `--dz-popover-icon-bg` | popover icon bg |
| `--dz-popover-icon-border-radius` | popover icon border radius |
| `--dz-popover-icon-font-size` | popover icon font size |
| `--dz-popover-icon-size` | popover icon size |
| `--dz-popover-limits-color` | popover limits color |
| `--dz-popover-limits-font-size` | popover limits font size |
| `--dz-popover-limits-line-height` | popover limits line height |
| `--dz-popover-limits-padding` | popover limits padding |
| `--dz-popover-max-height` | popover max height |
| `--dz-popover-max-width` | popover max width |
| `--dz-popover-min-height` | popover min height |
| `--dz-popover-min-width` | popover min width |
| `--dz-popover-remove-bg` | popover remove bg |
| `--dz-popover-remove-bg-hover` | popover remove bg hover |
| `--dz-popover-remove-color` | popover remove color |
| `--dz-popover-remove-color-hover` | popover remove color hover |
| `--dz-popover-remove-icon-size` | popover remove icon size |
| `--dz-popover-remove-size` | popover remove size |
| `--dz-popover-resize` | popover resize |
| `--dz-popover-row-hover-bg` | popover row hover bg |
| `--dz-popover-table-font-size` | popover table font size |
| `--dz-popover-width` | popover width |
| `--dz-popover-z-index` | popover z index |

#### preview-grid tokens

| Variable | Usage |
|---|---|
| `--dz-preview-action-bg-hover` | preview action bg hover |
| `--dz-preview-action-button-border-radius` | preview action button border radius |
| `--dz-preview-action-button-size` | preview action button size |
| `--dz-preview-action-gap` | preview action gap |
| `--dz-preview-action-icon-size` | preview action icon size |
| `--dz-preview-grid-columns` | preview grid columns |
| `--dz-preview-grid-gap` | preview grid gap |
| `--dz-preview-item-aspect-ratio` | preview item aspect ratio |
| `--dz-preview-item-bg` | preview item bg |
| `--dz-preview-item-border` | preview item border |
| `--dz-preview-item-border-radius` | preview item border radius |
| `--dz-preview-item-object-fit` | how the thumbnail fills its tile in the uniform grid (cover \| contain; forced to contain in grid-layout="natural") |
| `--dz-preview-item-size` | in-card grid tile width + height (files-inside); auto = sized to content |
| `--dz-preview-overlay-bg` | preview overlay bg |
| `--dz-preview-overlay-color` | preview overlay color |
| `--dz-preview-overlay-font-size` | preview overlay font size |
| `--dz-preview-overlay-padding` | preview overlay padding |
| `--dz-preview-remove-bg` | preview remove bg |
| `--dz-preview-remove-bg-hover` | preview remove bg hover |
| `--dz-preview-remove-color` | preview remove color |
| `--dz-preview-remove-icon-size` | preview remove icon size |
| `--dz-preview-remove-offset` | preview remove offset |
| `--dz-preview-remove-size` | preview remove size |
| `--dz-preview-row-height` | row height for grid-layout="natural" (tile widths follow each image ratio) |
| `--dz-preview-scrim-bg` | preview scrim bg |
| `--dz-preview-status-overlay-bg` | veil over a finished thumbnail in grid-status="overlay" |
| `--dz-preview-status-overlay-icon-size` | centred status glyph size in grid-status="overlay" |

#### sizing tokens

| Variable | Usage |
|---|---|
| `--dz-rem` | base sizing unit for proportional scaling (default 10px). Input variable: not declared on :host, read as var(--dz-rem, 10px) so a value on <web-dropzone> or any ancestor reaches every satellite |
| `--dz-touch-target-min` | minimum tap size of phone-mode controls — the indicator drawer close in the full-screen sheet, 44px (base: --base-touch-target-min) |

#### rolling tokens

| Variable | Usage |
|---|---|
| `--dz-rolling-animation-duration` | rolling rotation duration (default --dz-transition-slow) |
| `--dz-rolling-queue-bg` | rolling queue bg |
| `--dz-rolling-queue-bg-hover` | rolling queue bg hover |
| `--dz-rolling-queue-border` | rolling queue border |
| `--dz-rolling-queue-border-radius` | rolling queue border radius |
| `--dz-rolling-queue-color` | rolling queue color |
| `--dz-rolling-queue-color-hover` | rolling queue color hover |
| `--dz-rolling-queue-count-bg` | rolling queue count bg |
| `--dz-rolling-queue-count-color` | rolling queue count color |
| `--dz-rolling-queue-font-size` | rolling queue font size |
| `--dz-rolling-queue-offset` | rolling queue offset |
| `--dz-rolling-queue-padding` | rolling queue padding |

#### show-more tokens

| Variable | Usage |
|---|---|
| `--dz-show-more-bg` | show more bg |
| `--dz-show-more-bg-hover` | show more bg hover |
| `--dz-show-more-border` | show more border |
| `--dz-show-more-border-radius` | show more border radius |
| `--dz-show-more-color` | show more color |
| `--dz-show-more-font-size` | show more font size |
| `--dz-show-more-font-weight` | show more font weight |
| `--dz-show-more-margin-top` | show more margin top |
| `--dz-show-more-padding` | show more padding |

#### loader tokens

| Variable | Usage |
|---|---|
| `--dz-loader-icon` | loader shape, a mask image in currentColor (base: --base-loader-icon) |
| `--dz-loader-rotate` | loader rotation per cycle, 1turn; 0 = the SVG animates itself (base: --base-loader-rotate) |
| `--dz-loader-duration` | loader cycle 0.8s; 1.5s under reduced motion (base: --base-loader-duration) |
| `--dz-loader-size` | indicator-chip upload loader size, 1.25em (base: --base-loader-size) |
| `--dz-loader-inline-size` | tiny per-row / summary loader (0.75x --dz-loader-size) |

#### summary tokens

| Variable | Usage |
|---|---|
| `--dz-summary-bg` | summary bg |
| `--dz-summary-bg-hover` | summary bg hover |
| `--dz-summary-border-radius` | summary border radius |
| `--dz-summary-color` | summary color |
| `--dz-summary-font-size` | summary font size |
| `--dz-summary-padding` | summary padding |

#### text tokens

| Variable | Usage |
|---|---|
| `--dz-text-color-1` | text color 1 |
| `--dz-text-color-2` | text color 2 |
| `--dz-text-color-3` | text color 3 |
| `--dz-text-color-4` | text color 4 |
| `--dz-text-on-accent` | text on accent |
