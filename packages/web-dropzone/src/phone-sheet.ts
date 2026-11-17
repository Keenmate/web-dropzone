/**
 * The phone presentation of the overlay panels (the indicator drawer and the
 * compact popover): core's device classification decides it (SPEC §12.9,
 * `resolvePresentation('auto', env)` → `'fullscreen'` on a phone), not a width
 * literal — a narrowed desktop window keeps the anchored panel. The sheet look
 * is `css/sheet.css`, keyed on the `--sheet` modifier classes the panels get
 * while they are presented as a sheet.
 */
import { getEnvironment, observeEnvironment, resolvePresentation } from '@keenmate/web-components-core';

/** Whether an overlay panel opened now is a full-screen phone sheet. */
export function isPhoneSheet(): boolean {
    return resolvePresentation('auto', getEnvironment()) === 'fullscreen';
}

/**
 * Follow the phone presentation while a panel is open: `listener(isSheet)` on
 * every device / breakpoint change (not called on subscribe). Returns the
 * unsubscribe.
 */
export function observePhoneSheet(listener: (isSheet: boolean) => void): () => void {
    return observeEnvironment((env) => listener(resolvePresentation('auto', env) === 'fullscreen'), {
        shouldFireImmediately: false,
    });
}
