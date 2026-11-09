import { test, expect, dz, type Page } from './fixtures';

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
