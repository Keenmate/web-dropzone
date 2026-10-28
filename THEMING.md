# Theming Reference — `@keenmate/web-dropzone`

Every visual of `<web-dropzone>` and its satellites (`<web-dropzone-picker>`, `-list`, `-indicator`, `-progress`) is a CSS custom property. Set them on `<web-dropzone>`, on any ancestor, or on `:root`; they inherit into the satellites the element mounts internally (bulk render mode).

This file is generated from [`packages/web-dropzone/component-variables.manifest.json`](packages/web-dropzone/component-variables.manifest.json) (also exported as `@keenmate/web-dropzone/manifest`). Usage-oriented guidance — quick themes, `--dz-rem` sizing, dark mode, the `@layer` cascade, RTL — lives in [`ai/styling-theming.txt`](ai/styling-theming.txt) and the README's *Styling* section.

## Quick theme

```css
web-dropzone {
  --dz-accent-color: #10b981;
  --dz-dropzone-border-radius: 1rem;
  --dz-rem: 12px; /* scale the whole instance (default 10px) */
}
```

## Host state hooks

| Hook | When |
|---|---|
| `[ready]` / `:state(ready)` | After the first build (core) — FOUC guard: `web-dropzone:not([ready]) { visibility: hidden }` |
| `[disabled]` / `:disabled` | Disabled (also via an ancestor `<fieldset disabled>`) |
| `[readonly]` | Read-only (surface modifier `.dz__dropzone--readonly`) |
| `[data-context-theme]` | Page theme mirrored by web-components-core (dark / light) |

## Shared theme layer (`--base-*`)

The `--dz-*` tokens read [`@keenmate/base-css-variables`](https://www.npmjs.com/package/@keenmate/base-css-variables), so a page theme (Theme Designer / pure-admin) themes the dropzone without any `--dz-*` override. Without the contract on the page the fallbacks give the same colors: inputs fall back to the contract defaults (accent `#3b82f6`), derived tokens (hover, tints, text levels, borders, text on the accent) to the contract's formula on the `--dz-*` input — so `--dz-accent-color` alone re-colors its hover, tint and text. `npm run check:contract` and `e2e/contract-parity.spec.ts` keep it that way.

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
| `--base-success-color` | Completed-upload borders + status icon. |
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

## Component variables (`--dz-*`)

- [accent](#accent)
- [surface](#surface)
- [badges](#badges)
- [radius](#radius)
- [selector](#selector)
- [state](#state)
- [dropzone](#dropzone)
- [dropzone-card](#dropzone-card)
- [motion](#motion)
- [empty-state](#empty-state)
- [semantic](#semantic)
- [file-list](#file-list)
- [typography](#typography)
- [icons](#icons)
- [file-item](#file-item)
- [progress](#progress)
- [overlay](#overlay)
- [popover](#popover)
- [preview-grid](#preview-grid)
- [rolling](#rolling)
- [show-more](#show-more)
- [summary](#summary)
- [text](#text)

### accent

| Variable | Usage |
|---|---|
| `--dz-accent-bg` | accent bg |
| `--dz-accent-color` | accent color |
| `--dz-accent-color-active` | accent color active |
| `--dz-accent-color-hover` | accent color hover |
| `--dz-accent-color-light` | accent color light |
| `--dz-accent-color-light-hover` | accent color light hover |

### surface

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

### badges

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

### radius

| Variable | Usage |
|---|---|
| `--dz-border-radius-lg` | border radius lg |
| `--dz-border-radius-md` | border radius md |
| `--dz-border-radius-sm` | border radius sm |

### selector

| Variable | Usage |
|---|---|
| `--dz-button-badge-border-radius` | button badge border radius |
| `--dz-button-font-size` | button font size |
| `--dz-button-padding` | button padding |
| `--dz-minimal-icon-size` | minimal icon size |
| `--dz-minimal-size` | minimal size |

### state

| Variable | Usage |
|---|---|
| `--dz-disabled-opacity` | disabled opacity |

### dropzone

| Variable | Usage |
|---|---|
| `--dz-dropzone-bg` | dropzone bg |
| `--dz-dropzone-bg-active` | dropzone bg active |
| `--dz-dropzone-bg-hover` | dropzone bg hover |
| `--dz-dropzone-border` | dropzone border |
| `--dz-dropzone-border-active` | dropzone border active |
| `--dz-dropzone-border-radius` | dropzone border radius |
| `--dz-dropzone-hint-color` | dropzone hint color |
| `--dz-dropzone-hint-font-size` | dropzone hint font size |
| `--dz-dropzone-icon-color` | dropzone icon color |
| `--dz-dropzone-icon-size` | dropzone icon size |
| `--dz-dropzone-min-height` | dropzone min height |
| `--dz-dropzone-padding` | dropzone padding |
| `--dz-dropzone-text-color` | dropzone text color |
| `--dz-dropzone-text-font-size` | dropzone text font size |

### dropzone-card

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

### motion

| Variable | Usage |
|---|---|
| `--dz-easing-snappy` | easing snappy |
| `--dz-transition-fast` | transition fast |
| `--dz-transition-normal` | transition normal |

### empty-state

| Variable | Usage |
|---|---|
| `--dz-empty-color` | empty color |
| `--dz-empty-font-size` | empty font size |
| `--dz-empty-padding` | empty padding |

### semantic

| Variable | Usage |
|---|---|
| `--dz-error-bg` | error bg |
| `--dz-error-color` | error color |
| `--dz-success-bg` | success bg |
| `--dz-success-color` | success color |
| `--dz-warning-bg` | warning bg |
| `--dz-warning-color` | warning color |

### file-list

| Variable | Usage |
|---|---|
| `--dz-file-list-gap` | file list gap |
| `--dz-file-list-margin-top` | file list margin top |

### typography

| Variable | Usage |
|---|---|
| `--dz-font-size-base` | font size base |
| `--dz-font-size-lg` | font size lg |
| `--dz-font-size-sm` | font size sm |
| `--dz-font-size-xs` | font size xs |
| `--dz-font-weight-medium` | font weight medium |
| `--dz-font-weight-normal` | font weight normal |
| `--dz-font-weight-semibold` | font weight semibold |
| `--dz-line-height-normal` | line height normal |
| `--dz-line-height-tight` | line height tight |

### icons

| Variable | Usage |
|---|---|
| `--dz-icon-remove` | icon remove |
| `--dz-status-icon-size` | status icon size |
| `--dz-status-spin-duration` | status spin duration |

### file-item

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

### progress

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

### overlay

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

### popover

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

### preview-grid

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
| `--dz-preview-scrim-bg` | preview scrim bg |

### rolling

| Variable | Usage |
|---|---|
| `--dz-rolling-animation-duration` | rolling animation duration |
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

### show-more

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

### summary

| Variable | Usage |
|---|---|
| `--dz-summary-bg` | summary bg |
| `--dz-summary-bg-hover` | summary bg hover |
| `--dz-summary-border-radius` | summary border radius |
| `--dz-summary-color` | summary color |
| `--dz-summary-font-size` | summary font size |
| `--dz-summary-padding` | summary padding |

### text

| Variable | Usage |
|---|---|
| `--dz-text-color-1` | text color 1 |
| `--dz-text-color-2` | text color 2 |
| `--dz-text-color-3` | text color 3 |
| `--dz-text-color-4` | text color 4 |
| `--dz-text-on-accent` | text on accent |
