import { test, expect, dz, addNamed, type Page } from './fixtures';

/**
 * Persistence of UI state (today: the user-resized popover size) keyed by
 * `storage-key` (core `createStateStore()`, SPEC §12.17). Default sink is
 * localStorage `km-state:web-dropzone:<key>`; a `saveStateCallback` /
 * `loadStateCallback` pair replaces it and gets the WHOLE state.
 *
 * Fixture: test/persistence.html — `#ls` (localStorage), `#cb` (callbacks,
 * in-memory sink pre-seeded with 333×222 + a foreign key `note`), `#none` (no storage-key).
 * The resize is simulated by setting the popover's inline size (what the
 * native resize handle does); a ResizeObserver debounces the save (250 ms).
 */

const PAGE = '/test/persistence.html';

async function openPopover(page: Page, id: string) {
    await addNamed(page, id, ['a.txt']);
    await dz(page, id).locator('.dz__summary-line').click();
    await expect(dz(page, id).locator('.dz__popover')).toBeVisible();
}

async function resizePopover(page: Page, id: string, w: number, h: number) {
    await dz(page, id).locator('.dz__popover').evaluate((el: HTMLElement, { w, h }) => {
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
    }, { w, h });
}

const stored = (page: Page, key: string) =>
    page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test.describe('localStorage (default sink)', () => {
    test('a popover resize writes km-state:web-dropzone:<storage-key>', async ({ page }) => {
        await openPopover(page, 'ls');
        await resizePopover(page, 'ls', 410, 260);
        await expect.poll(() => stored(page, 'km-state:web-dropzone:docs')).toEqual({ popoverWidth: 410, popoverHeight: 260 });
    });

    test('after a reload the popover opens at the persisted size', async ({ page }) => {
        await openPopover(page, 'ls');
        await resizePopover(page, 'ls', 410, 260);
        await expect.poll(() => stored(page, 'km-state:web-dropzone:docs')).toEqual({ popoverWidth: 410, popoverHeight: 260 });

        await page.reload();
        await page.waitForFunction(() => (window as any).__ready === true);
        await openPopover(page, 'ls');
        await expect.poll(() => dz(page, 'ls').locator('.dz__popover').evaluate((el: HTMLElement) =>
            [el.style.width, el.style.height])).toEqual(['410px', '260px']);
    });

    test('no storage-key → nothing is written', async ({ page }) => {
        await openPopover(page, 'none');
        await resizePopover(page, 'none', 400, 250);
        await page.waitForTimeout(500);
        const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('km-state:') || k.startsWith('dz-state:')));
        expect(keys).toEqual([]);
    });
});

test.describe('saveStateCallback / loadStateCallback', () => {
    test('loadStateCallback gets { key } and its state sizes the popover', async ({ page }) => {
        await openPopover(page, 'cb');
        await expect.poll(() => dz(page, 'cb').locator('.dz__popover').evaluate((el: HTMLElement) =>
            [el.style.width, el.style.height])).toEqual(['333px', '222px']);
        const loads = await page.evaluate(() => (window as any).__loadCalls);
        expect(loads[0]).toEqual({ key: 'cb' });
    });

    test('saveStateCallback gets { key, state } with the WHOLE state; localStorage is untouched', async ({ page }) => {
        await openPopover(page, 'cb');
        await resizePopover(page, 'cb', 380, 240);
        await expect.poll(() => page.evaluate(() => (window as any).__saveCalls.at(-1)))
            .toEqual({ key: 'cb', state: { popoverWidth: 380, popoverHeight: 240, note: 'kept' }, hasContext: true });
        const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes(':cb')));
        expect(keys).toEqual([]);
    });

    test('after a reload the callback state sizes the popover again', async ({ page }) => {
        await openPopover(page, 'cb');
        await resizePopover(page, 'cb', 380, 240);
        await expect.poll(() => page.evaluate(() => (window as any).__saveCalls.length)).toBeGreaterThan(0);
        const saved = await page.evaluate(() => (window as any).__sink);
        await page.reload();
        await page.waitForFunction(() => (window as any).__ready === true);
        await page.evaluate((s) => { (window as any).__sink = s; }, saved);
        await openPopover(page, 'cb');
        await expect.poll(() => dz(page, 'cb').locator('.dz__popover').evaluate((el: HTMLElement) =>
            [el.style.width, el.style.height])).toEqual(['380px', '240px']);
    });
});
