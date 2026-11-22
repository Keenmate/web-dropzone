import { test, expect, dz, addNamed, pendingNames } from './fixtures';

/**
 * `labels` — the UI-string input (partial object, merged per key over the
 * built-in English; `{ctx.name}` / `{ctx.count}` / `{ctx.statusName}` placeholders; property or
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
        el.labels = { 'ariaLabels.cancelFile': 'Zrušit {ctx.name}', 'labels.statusUploading': 'Nahrávám', 'ariaLabels.status': 'Stav: {ctx.statusName}', 'buttons.cancelAll': 'Zrušit vše', 'labels.prompt': 'Sem soubory' };
        await el.whenSettled();
    });
    const row = rowOf(page, 'q', 'a.txt');
    await expect(row.locator('[data-dz-action="cancel"]')).toHaveAttribute('aria-label', 'Zrušit a.txt');
    await expect(row.locator('[data-dz-action="remove"]')).toHaveAttribute('aria-label', 'Remove a.txt'); // not overridden
    await expect(row.locator('.dz__file-item-status')).toHaveAttribute('aria-label', 'Stav: Nahrávám');
    await expect(dz(page, 'q').locator('[data-dz-action="cancel-all"]')).toHaveText('Zrušit vše');
    await expect(dz(page, 'q').locator('.dz__dropzone-text')).toHaveText('Sem soubory');
    // null is not a labels value (core toObject: refused, input-rejected, previous value kept)
    const refused = await dz(page, 'q').evaluate(async (el: any) => {
        const seen: string[] = [];
        el.addEventListener('input-rejected', (e: any) => seen.push(e.detail.configKey));
        el.labels = null;
        await el.whenSettled();
        return seen;
    });
    expect(refused).toEqual(['labels']);
    await expect(row.locator('[data-dz-action="cancel"]')).toHaveAttribute('aria-label', 'Zrušit a.txt');
    // undefined resets to the defaults (SPEC §6.1)
    await dz(page, 'q').evaluate(async (el: any) => { el.labels = undefined; await el.whenSettled(); });
    await expect(row.locator('[data-dz-action="cancel"]')).toHaveAttribute('aria-label', 'Cancel a.txt');
});

test('JSON attribute; a malformed one warns and keeps the previous value', async ({ page }) => {
    await dz(page, 'q').evaluate(async (el: any) => {
        el.setAttribute('labels', JSON.stringify({ 'labels.prompt': 'Přetáhněte soubory' }));
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
    expect(kept).toEqual({ 'labels.prompt': 'Přetáhněte soubory' });
    await expect(dz(page, 'q').locator('.dz__dropzone-text')).toHaveText('Přetáhněte soubory');
    await expect.poll(() => warned.some((w) => w.includes('labels'))).toBe(true);
});

test('"Cancelling…" and the cancel-timeout status come from labels', async ({ page }) => {
    await addNamed(page, 'stubborn', ['s.txt']);
    await expect.poll(() => pendingNames(page)).toContain('s.txt');
    await dz(page, 'stubborn').evaluate((el: any) => { el.labels = { 'messages.cancelling': 'Ruším…', 'labels.cancelTimeout': 'Zrušení vypršelo' }; });
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
        el.labels = { 'ariaLabels.cancelFile': 'Stop {ctx.name}', 'buttons.cancelAll': 'Stop everything' };
        await el.whenSettled();
    });
    const satRow = page.locator('#list-sat').locator('.dz__file-item:has(.dz__file-item-name:text-is("x.txt"))');
    await expect(satRow.locator('[data-dz-action="cancel"]')).toHaveAttribute('aria-label', 'Stop x.txt');
    await expect(page.locator('#progress-sat').locator('[data-dz-action="cancel-all"]')).toHaveText('Stop everything');
});

test.describe('page-wide labels + locale (core /locale)', () => {
    test.afterEach(async ({ page }) => {
        await page.evaluate(() => { (window as any).components.locale = null; });
    });

    test('window.components.locale.labels (flat full keys) re-renders live; the instance labels win per key', async ({ page }) => {
        await page.evaluate(() => {
            (window as any).components.locale = { labels: { 'web-dropzone.labels.prompt': 'Soubory sem', 'web-dropzone.buttons.cancelAll': 'Zrušit vše' } };
        });
        await expect(dz(page, 'q').locator('.dz__dropzone-text')).toHaveText('Soubory sem');
        await dz(page, 'q').evaluate(async (el: any) => { el.labels = { 'labels.prompt': 'Own prompt' }; await el.whenSettled(); });
        await expect(dz(page, 'q').locator('.dz__dropzone-text')).toHaveText('Own prompt');
        await addNamed(page, 'q', ['a.txt']);
        await expect(dz(page, 'q').locator('[data-dz-action="cancel-all"]')).toHaveText('Zrušit vše');
    });

    test('a satellite tag has its own page-wide entries; translateCallback gets the full key; file sizes use the page decimal separator', async ({ page }) => {
        await addNamed(page, 'list-store', ['x.txt']);
        await expect.poll(() => pendingNames(page)).toContain('x.txt');
        await page.evaluate(() => {
            (window as any).components.locale = {
                decimalSeparator: ',',
                labels: { 'web-dropzone-progress.buttons.cancelAll': 'Progress: stop' },
                translateCallback: ({ key, params }: any) => key === 'web-dropzone.ariaLabels.cancelFile' ? `[${params.ctx.name}]` : null,
            };
        });
        await expect(page.locator('#progress-sat').locator('[data-dz-action="cancel-all"]')).toHaveText('Progress: stop');
        const satRow = page.locator('#list-sat').locator('.dz__file-item:has(.dz__file-item-name:text-is("x.txt"))');
        await expect(satRow.locator('[data-dz-action="cancel"]')).toHaveAttribute('aria-label', '[x.txt]');
        const size = await page.evaluate(async () => (await import('/packages/web-dropzone-core/src/index.ts' as any)).formatFileSize(1536));
        expect(size).toBe('1,5 KB');
    });

    test('translateCallback on the element: wins over the page hook, null → the page hook, instance labels beat both; live; satellites use the store hook', async ({ page }) => {
        await addNamed(page, 'list-store', ['y.txt']);
        await expect.poll(() => pendingNames(page)).toContain('y.txt');
        await page.evaluate(() => {
            (window as any).components.locale = {
                translateCallback: ({ key }: any) => key === 'web-dropzone.labels.prompt' || key === 'web-dropzone.buttons.cancelAll' ? 'PAGE' : null,
            };
        });
        await expect(dz(page, 'q').locator('.dz__dropzone-text')).toHaveText('PAGE');
        await dz(page, 'q').evaluate(async (el: any) => {
            el.translateCallback = ({ key, params }: any) =>
                key === 'web-dropzone.labels.prompt' ? 'OWN prompt'
                    : key === 'web-dropzone.labels.hint' ? 'OWN hint'
                        : key === 'web-dropzone.ariaLabels.cancelFile' ? `OWN ${params.ctx.name}` : null;
            el.labels = { 'labels.hint': 'Instance hint' };
            await el.whenSettled();
        });
        await expect(dz(page, 'q').locator('.dz__dropzone-text')).toHaveText('OWN prompt');
        await expect(dz(page, 'q').locator('.dz__dropzone-hint')).toHaveText('Instance hint');
        await addNamed(page, 'q', ['a.txt']);
        // null from the element hook → the page hook decides
        await expect(dz(page, 'q').locator('[data-dz-action="cancel-all"]')).toHaveText('PAGE');
        // a bound satellite asks its store's hook
        await page.locator('#list-store').evaluate(async (el: any) => {
            el.translateCallback = ({ key, params }: any) => key === 'web-dropzone.ariaLabels.cancelFile' ? `STORE ${params.ctx.name}` : null;
            await el.whenSettled();
        });
        const satRow = page.locator('#list-sat').locator('.dz__file-item:has(.dz__file-item-name:text-is("y.txt"))');
        await expect(satRow.locator('[data-dz-action="cancel"]')).toHaveAttribute('aria-label', 'STORE y.txt');
    });
});

test.describe('locale input (C-CA-38)', () => {
    test.afterEach(async ({ page }) => {
        await page.evaluate(() => { (window as any).components.locale = null; });
    });

    const addKb = (page: import('@playwright/test').Page, id: string, name: string) =>
        dz(page, id).evaluate((el: any, n: string) => el.addFiles([new File([new Uint8Array(1536)], n, { type: 'text/plain' })]), name);

    test('locale="de" formats the file sizes; unset follows window.components.locale.locale; live', async ({ page }) => {
        await addKb(page, 'q', 'k.txt');
        const size = rowOf(page, 'q', 'k.txt').locator('.dz__file-item-size');
        await expect(size).toHaveText('1.5 KB');
        expect(await dz(page, 'q').evaluate((el: any) => el.locale)).toBeNull();
        await dz(page, 'q').evaluate(async (el: any) => { el.setAttribute('locale', 'de'); await el.whenSettled(); });
        await expect(size).toHaveText('1,5 KB');
        expect(await dz(page, 'q').evaluate((el: any) => el.locale)).toBe('de');
        // unset → the page-wide locale
        await dz(page, 'q').evaluate(async (el: any) => { el.removeAttribute('locale'); await el.whenSettled(); });
        await expect(size).toHaveText('1.5 KB');
        await page.evaluate(() => { (window as any).components.locale = { locale: 'cs' }; });
        await expect(size).toHaveText('1,5 KB');
        // the instance wins over the page; 'auto' = unset
        await dz(page, 'q').evaluate(async (el: any) => { el.locale = 'en'; await el.whenSettled(); });
        await expect(size).toHaveText('1.5 KB');
        await dz(page, 'q').evaluate(async (el: any) => { el.locale = 'auto'; await el.whenSettled(); });
        await expect(size).toHaveText('1,5 KB');
    });

    test('bound satellites (list rows + progress counts) follow the store locale', async ({ page }) => {
        await addKb(page, 'list-store', 'k.txt');
        await expect.poll(() => pendingNames(page)).toContain('k.txt');
        const satSize = page.locator('#list-sat').locator('.dz__file-item:has(.dz__file-item-name:text-is("k.txt")) .dz__file-item-size');
        const counts = page.locator('#progress-sat').locator('.dz__overall-progress-counts');
        await expect(satSize).toHaveText('1.5 KB');
        await expect(counts).toContainText('1.5 KB');
        await dz(page, 'list-store').evaluate(async (el: any) => { el.locale = 'de'; await el.whenSettled(); });
        await expect(satSize).toHaveText('1,5 KB');
        await expect(counts).toContainText('1,5 KB');
    });
});
