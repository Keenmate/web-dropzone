import { test, expect, dz, dragFiles, type Page } from './fixtures';

/**
 * File icons in the rows. Resolution order (first hit wins):
 *   1. getFileIconCallback({ file }) non-null return
 *   2. fileIcons[extension] (case- and leading-dot-insensitive)
 *   3. fileIcons[category]  (image, pdf, doc, text, …)
 *   4. built-in category icon
 *
 * Fixture: test/icons.html — `#plain`, `#map` (fileIcons), `#cb`
 * (getFileIconCallback + fileIcons fallback). `__addTyped(id, [{name, type}])`.
 */

const PAGE = '/test/icons.html';

const add = (page: Page, id: string, specs: { name: string; type?: string }[]) =>
    page.evaluate(({ id, specs }) => (window as any).__addTyped(id, specs), { id, specs });
const icon = (page: Page, id: string, name: string) =>
    dz(page, id).locator(`.dz__file-item:has(.dz__file-item-name:text-is("${name}")) .dz__file-item-icon`);

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test('default: the icon slot carries the category modifier and built-in markup', async ({ page }) => {
    await add(page, 'plain', [{ name: 'a.pdf', type: 'application/pdf' }, { name: 'b.txt', type: 'text/plain' }]);
    await expect(icon(page, 'plain', 'a.pdf')).toHaveClass(/dz__file-item-icon--pdf/);
    await expect(icon(page, 'plain', 'b.txt')).toHaveClass(/dz__file-item-icon--text/);
    expect((await icon(page, 'plain', 'a.pdf').innerHTML()).trim().length).toBeGreaterThan(0);
});

test('fileIcons: extension key (".PDF" matches a.pdf) and category key ("text")', async ({ page }) => {
    await add(page, 'map', [
        { name: 'a.pdf', type: 'application/pdf' },
        { name: 'notes.md', type: 'text/markdown' },
        { name: 'z.zip', type: 'application/zip' },
    ]);
    await expect(icon(page, 'map', 'a.pdf').locator('i.ico-pdf')).toHaveText('P');
    await expect(icon(page, 'map', 'notes.md').locator('i.ico-text')).toHaveText('T');
    // No key matches → built-in icon (no override markup).
    await expect(icon(page, 'map', 'z.zip').locator('i')).toHaveCount(0);
});

test('getFileIconCallback wins; returning null falls back to fileIcons; ctx carries file + controller + element', async ({ page }) => {
    await add(page, 'cb', [{ name: 'data.csv', type: 'text/csv' }, { name: 'readme.txt', type: 'text/plain' }]);
    await expect(icon(page, 'cb', 'data.csv').locator('i.ico-csv')).toHaveText('C');
    await expect(icon(page, 'cb', 'readme.txt').locator('i.ico-text')).toHaveText('T');
    const ctx = await page.evaluate(() => (window as any).__iconCtx);
    expect(ctx).toEqual(expect.arrayContaining([{ name: 'data.csv', hasController: true, isElement: true }]));
});

test('assigning fileIcons after rows exist re-renders them', async ({ page }) => {
    await add(page, 'plain', [{ name: 'a.pdf', type: 'application/pdf' }]);
    await dz(page, 'plain').evaluate(async (el: any) => { el.fileIcons = { pdf: '<i class="late">L</i>' }; await el.whenSettled(); });
    await expect(icon(page, 'plain', 'a.pdf').locator('i.late')).toHaveText('L');
});

// ── Icon inputs through core renderIcon (SPEC §12.33) ─────────────────────────
// `<…` = raw markup; an ASCII name = a `.km-icon` masked from `--base-icon-<name>`
// (ICON_CSS adopted in the store, the satellites and the overlay layer); else text.

/** A named icon is drawn: ICON_CSS applies (a 1em square) and the mask resolves. */
async function drawn(loc: import('@playwright/test').Locator): Promise<{ square: boolean; mask: string }> {
    return loc.evaluate((el) => {
        const cs = getComputedStyle(el);
        const w = (el as HTMLElement).offsetWidth; // layout size (the overlay animates in with a transform)
        return {
            square: w > 0 && Math.abs(w - parseFloat(cs.fontSize)) < 1 && w === (el as HTMLElement).offsetHeight,
            mask: cs.maskImage || (cs as any).webkitMaskImage,
        };
    });
}

test('a name → a masked .km-icon (prompt, row cancel + remove) drawn by ICON_CSS', async ({ page }) => {
    const prompt = dz(page, 'named').locator('.dz__dropzone-icon .km-icon.dz__icon.dz__icon--star');
    await expect(prompt).toHaveCount(1);
    expect(await drawn(prompt)).toEqual({ square: true, mask: expect.stringContaining('url(') });
    await page.evaluate(() => (window as any).__addNamed('named', ['a.txt']));
    await expect(dz(page, 'named').locator('[data-dz-action="remove"][data-custom-icon] .km-icon.dz__icon--star')).toHaveCount(1);
    await expect(dz(page, 'named').locator('[data-dz-action="cancel"] .km-icon.dz__icon--star')).toHaveCount(1);
});

test('markup is inserted raw; an emoji / other text is escaped text', async ({ page }) => {
    await expect(dz(page, 'raw').locator('.dz__dropzone-icon b.raw-icon')).toHaveText('R');
    await page.evaluate(() => (window as any).__addNamed('raw', ['a.txt']));
    const remove = dz(page, 'raw').locator('[data-dz-action="remove"]');
    await expect(remove).toHaveText('🗑');
    await expect(remove.locator('.km-icon')).toHaveCount(0);
    const lt = dz(page, 'lt').locator('.dz__dropzone-icon');
    await expect(lt).toHaveText('1 < 2');
    expect(await lt.evaluate((el) => el.children.length)).toBe(0);
});

test('satellites: the picker icon and the list remove-icon draw in their own shadow roots', async ({ page }) => {
    const pick = page.locator('#sat-picker').locator('.dz__dropzone-icon .km-icon.dz__icon--star');
    await expect(pick).toHaveCount(1);
    expect((await drawn(pick)).square).toBe(true);
    await page.evaluate(() => (window as any).__addNamed('sat-store', ['s.txt']));
    const rm = page.locator('#sat-list').locator('[data-dz-action="remove"] .km-icon.dz__icon--star');
    await expect(rm).toHaveCount(1);
    expect(await drawn(rm)).toEqual({ square: true, mask: expect.stringContaining('url(') });
});

test('the drag overlay layer draws a named overlay-icon', async ({ page }) => {
    await dragFiles(page.locator('#ov-target'), 'dragenter');
    const ico = page.locator('.dz__overlay .dz__overlay-icon .km-icon.dz__icon--star');
    await expect(ico).toHaveCount(1);
    expect(await drawn(ico)).toEqual({ square: true, mask: expect.stringContaining('url(') });
    await dragFiles(page.locator('#ov-target'), 'dragleave');
});
