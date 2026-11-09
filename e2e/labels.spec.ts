import { test, expect, dz, addNamed, pendingNames } from './fixtures';

/**
 * `labels` — the UI-string input (partial object, merged per key over the
 * built-in English; `{name}` / `{count}` / `{status}` placeholders; property or
 * JSON attribute; live). Fixture: test/cancel.html (#q in-element list,
 * #list-store + its list / progress satellites).
 */

const PAGE = '/test/cancel.html';

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function' && !!(window as any).__log?.q);
});

const rowOf = (page: import('@playwright/test').Page, id: string, name: string) =>
    dz(page, id).locator(`.dz__file-item:has(.dz__file-item-name:text-is("${name}"))`);

test('defaults: built-in English (prompt, row buttons, status, bulk)', async ({ page }) => {
    await expect(dz(page, 'q').locator('.dz__dropzone-text')).toHaveText('Drop files here or click to browse');
    await addNamed(page, 'q', ['a.txt']);
    await expect.poll(() => pendingNames(page)).toContain('a.txt');
    const row = rowOf(page, 'q', 'a.txt');
    await expect(row.locator('[data-dz-action="cancel"]')).toHaveAttribute('aria-label', 'Cancel a.txt');
    await expect(row.locator('[data-dz-action="remove"]')).toHaveAttribute('aria-label', 'Remove a.txt');
    await expect(row.locator('[data-dz-action="row-action"]')).toHaveAttribute('aria-label', 'Pause a.txt');
    await expect(row.locator('.dz__file-item-status')).toHaveAttribute('aria-label', 'Status: Uploading');
    await expect(dz(page, 'q').locator('[data-dz-action="cancel-all"]')).toHaveText('Cancel all');
});

test('property: per-key merge, placeholders, live re-render', async ({ page }) => {
    await addNamed(page, 'q', ['a.txt']);
    await expect.poll(() => pendingNames(page)).toContain('a.txt');
    await dz(page, 'q').evaluate(async (el: any) => {
        el.labels = { cancelFile: 'Zrušit {name}', statusUploading: 'Nahrávám', statusAria: 'Stav: {status}', cancelAll: 'Zrušit vše', prompt: 'Sem soubory' };
        await el.whenSettled();
    });
    const row = rowOf(page, 'q', 'a.txt');
    await expect(row.locator('[data-dz-action="cancel"]')).toHaveAttribute('aria-label', 'Zrušit a.txt');
    await expect(row.locator('[data-dz-action="remove"]')).toHaveAttribute('aria-label', 'Remove a.txt'); // not overridden
    await expect(row.locator('.dz__file-item-status')).toHaveAttribute('aria-label', 'Stav: Nahrávám');
    await expect(dz(page, 'q').locator('[data-dz-action="cancel-all"]')).toHaveText('Zrušit vše');
    await expect(dz(page, 'q').locator('.dz__dropzone-text')).toHaveText('Sem soubory');
    // clearing returns to the defaults
    await dz(page, 'q').evaluate(async (el: any) => { el.labels = null; await el.whenSettled(); });
    await expect(row.locator('[data-dz-action="cancel"]')).toHaveAttribute('aria-label', 'Cancel a.txt');
});

test('JSON attribute; a malformed one warns and keeps the previous value', async ({ page }) => {
    await dz(page, 'q').evaluate(async (el: any) => {
        el.setAttribute('labels', JSON.stringify({ prompt: 'Přetáhněte soubory' }));
        await el.whenSettled();
    });
    await expect(dz(page, 'q').locator('.dz__dropzone-text')).toHaveText('Přetáhněte soubory');
    const warned: string[] = [];
    page.on('console', (m) => { if (m.type() === 'warning') warned.push(m.text()); });
    const kept = await dz(page, 'q').evaluate(async (el: any) => {
        el.setAttribute('labels', '{not json');
        await el.whenSettled();
        return el.labels;
    });
    expect(kept).toEqual({ prompt: 'Přetáhněte soubory' });
    await expect(dz(page, 'q').locator('.dz__dropzone-text')).toHaveText('Přetáhněte soubory');
    await expect.poll(() => warned.some((w) => w.includes('labels'))).toBe(true);
});

test('"Cancelling…" and the cancel-timeout status come from labels', async ({ page }) => {
    await addNamed(page, 'stubborn', ['s.txt']);
    await expect.poll(() => pendingNames(page)).toContain('s.txt');
    await dz(page, 'stubborn').evaluate((el: any) => { el.labels = { cancelling: 'Ruším…', cancelTimeout: 'Zrušení vypršelo' }; });
    const done = dz(page, 'stubborn').evaluate((el: any) => el.cancelFile(el.files[0].id));
    const row = rowOf(page, 'stubborn', 's.txt');
    await expect(row.locator('.dz__file-item-progress-text')).toHaveText('Ruším…');
    await done;
    await expect(row.locator('.dz__file-item-status')).toHaveAttribute('title', 'Zrušení vypršelo');
});

test('satellites (list + progress) follow the store labels, live', async ({ page }) => {
    await addNamed(page, 'list-store', ['x.txt', 'y.txt']);
    await expect.poll(() => pendingNames(page)).toContain('x.txt');
    await dz(page, 'list-store').evaluate(async (el: any) => {
        el.labels = { cancelFile: 'Stop {name}', cancelAll: 'Stop everything' };
        await el.whenSettled();
    });
    const satRow = page.locator('#list-sat').locator('.dz__file-item:has(.dz__file-item-name:text-is("x.txt"))');
    await expect(satRow.locator('[data-dz-action="cancel"]')).toHaveAttribute('aria-label', 'Stop x.txt');
    await expect(page.locator('#progress-sat').locator('[data-dz-action="cancel-all"]')).toHaveText('Stop everything');
});
