import { test, expect, dz } from './fixtures';

/**
 * Responsive rules (web-components-core SPEC §6.7) on `<web-dropzone>`:
 * a per-tag page rule applies to every instance on the matching device class,
 * an attribute written on the instance beats it, and overrides never reflect.
 *
 * Fixture: test/reactivity.html (`#caps` has `display-mode="list"` written on it).
 * Viewport 390×844 → device class `mobile`.
 */

const PAGE = '/test/reactivity.html';
const RULE = { mobile: { displayMode: 'compact', maxVisibleFileCount: 3 } };

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });


test('a per-tag page rule applies; an instance attribute beats it; nothing reflects', async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);

    // Assigning the per-tag rule re-evaluates the live instances.
    await page.evaluate((rule) => { (window as any).components['web-dropzone'].responsive = rule; }, RULE);
    const caps = await dz(page, 'caps').evaluate(async (el: any) => {
        await el.whenSettled();
        return { displayMode: el.displayMode, maxVisibleFileCount: el.maxVisibleFileCount,
            displayAttr: el.getAttribute('display-mode'), maxAttr: el.getAttribute('max-visible-file-count') };
    });
    // `display-mode="list"` is written on #caps → the page rule must not override it.
    expect(caps).toEqual({ displayMode: 'list', maxVisibleFileCount: 3, displayAttr: 'list', maxAttr: null });

    // A fresh instance without attributes takes the whole rule on its first build.
    const fresh = await page.evaluate(async () => {
        const el: any = document.createElement('web-dropzone');
        el.id = 'fresh';
        document.body.append(el);
        await el.whenReady();
        return { displayMode: el.displayMode, maxVisibleFileCount: el.maxVisibleFileCount,
            displayAttr: el.getAttribute('display-mode'), maxAttr: el.getAttribute('max-visible-file-count') };
    });
    expect(fresh).toEqual({ displayMode: 'compact', maxVisibleFileCount: 3, displayAttr: null, maxAttr: null });

    // Removing the rule restores the base values.
    const restored = await dz(page, 'fresh').evaluate(async (el: any) => {
        (window as any).components['web-dropzone'].responsive = undefined;
        await el.whenSettled();
        return [el.displayMode, el.maxVisibleFileCount];
    });
    expect(restored).toEqual(['list', 7]);
});

test('a per-tag rule set before the script loaded is adopted', async ({ page }) => {
    await page.addInitScript((rule) => {
        (window as any).components = { 'web-dropzone': { responsive: rule } };
    }, RULE);
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
    const flip = await dz(page, 'flip').evaluate(async (el: any) => {
        await el.whenReady();
        return [el.displayMode, el.maxVisibleFileCount, typeof (window as any).components['web-dropzone'].version];
    });
    expect(flip).toEqual(['compact', 3, 'function']);
});
