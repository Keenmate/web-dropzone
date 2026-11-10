/**
 * The phone line of the overlay panels (responsive-overlay.md D-RO-3 = A, 600px).
 * Below it the indicator drawer and the compact popover are full-screen sheets —
 * drawn by `css/sheet.css` (`@media (max-width: 600px)`, the same literal); the
 * popover reads this query to un-anchor itself so the sheet CSS places it.
 */
export const PHONE_MEDIA_QUERY = '(max-width: 600px)';

/** The phone-line media query list, or `null` without `matchMedia` (SSR, old jsdom). */
export function getPhoneMediaQuery(): MediaQueryList | null {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(PHONE_MEDIA_QUERY)
        : null;
}
