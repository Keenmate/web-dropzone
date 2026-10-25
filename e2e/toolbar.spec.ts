import { test, expect, dz, addNamed, pendingNames, resolveUpload, logLines, type Page } from './fixtures';

/**
 * Bulk action buttons. The overall-progress strip (`<web-dropzone-progress>`
 * inside the host) shows Pause all while something uploads (pipeline only),
 * Resume all while something is paused, Retry all while something failed or
 * was cancelled. The popover header has Add more / Clear all.
 *
 * Fixture: test/toolbar.html — `#tb` (pump, concurrency 3), `#no-pipe` (no
 * uploadFileCallback), `#pop` (button + popover, auto-upload="false").
 */

const PAGE = '/test/toolbar.html';

const btn = (page: Page, id: string, action: string) => dz(page, id).locator(`[data-dz-action="${action}"]`);
const statuses = (page: Page, id: string) => dz(page, id).evaluate((el: any) => el.files.map((f: any) => f.status));
const calls = (page: Page) => page.evaluate(() => (window as any).__calls.length);

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test.describe('overall-progress bulk actions', () => {
    test('nothing to act on → no bulk buttons', async ({ page }) => {
        for (const a of ['pause-all', 'resume-all', 'retry-all']) await expect(btn(page, 'tb', a)).toHaveCount(0);
    });

    test('Pause all appears while uploading and pauses every file; Resume all takes over', async ({ page }) => {
        await addNamed(page, 'tb', ['a.txt', 'b.txt', 'c.txt']);
        await expect.poll(() => pendingNames(page).then((n) => n.length)).toBe(3);
        await expect(btn(page, 'tb', 'pause-all')).toBeVisible();
        await expect(btn(page, 'tb', 'resume-all')).toHaveCount(0);

        await btn(page, 'tb', 'pause-all').click();
        await expect.poll(() => statuses(page, 'tb')).toEqual(['paused', 'paused', 'paused']);
        await expect(btn(page, 'tb', 'pause-all')).toHaveCount(0);
        await expect(btn(page, 'tb', 'resume-all')).toBeVisible();
    });

    test('Resume all restarts every paused file (handler re-invoked)', async ({ page }) => {
        await addNamed(page, 'tb', ['a.txt', 'b.txt']);
        await expect.poll(() => pendingNames(page).then((n) => n.length)).toBe(2);
        await btn(page, 'tb', 'pause-all').click();
        await expect.poll(() => statuses(page, 'tb')).toEqual(['paused', 'paused']);
        const before = await calls(page);

        await btn(page, 'tb', 'resume-all').click();
        await expect.poll(() => pendingNames(page).then((n) => n.length)).toBe(2);
        await expect.poll(() => statuses(page, 'tb')).toEqual(['uploading', 'uploading']);
        expect(await calls(page)).toBe(before + 2);
        await expect(btn(page, 'tb', 'resume-all')).toHaveCount(0);
        await expect(btn(page, 'tb', 'pause-all')).toBeVisible();
    });

    test('Retry all appears for failed files and re-runs them to completion', async ({ page }) => {
        await addNamed(page, 'tb', ['e1.txt', 'e2.txt', 'ok.txt']);
        await expect.poll(() => pendingNames(page).then((n) => n.length)).toBe(3);
        await resolveUpload(page, 'ok.txt', 'ok');
        await resolveUpload(page, 'e1.txt', 'fail');
        await resolveUpload(page, 'e2.txt', 'fail');
        await expect(btn(page, 'tb', 'retry-all')).toBeVisible();

        await btn(page, 'tb', 'retry-all').click();
        for (const n of ['e1.txt', 'e2.txt']) {
            await expect.poll(() => pendingNames(page)).toContain(n);
            await resolveUpload(page, n, 'ok');
        }
        await expect.poll(() => statuses(page, 'tb')).toEqual(['complete', 'complete', 'complete']);
        await expect(btn(page, 'tb', 'retry-all')).toHaveCount(0);
    });

    test('Retry all re-runs failed files in parallel up to `concurrency`', async ({ page }) => {
        await addNamed(page, 'tb', ['e1.txt', 'e2.txt', 'ok.txt']);
        await expect.poll(() => pendingNames(page).then((n) => n.length)).toBe(3);
        await resolveUpload(page, 'ok.txt', 'ok');
        await resolveUpload(page, 'e1.txt', 'fail');
        await resolveUpload(page, 'e2.txt', 'fail');
        await expect(btn(page, 'tb', 'retry-all')).toBeVisible();

        await btn(page, 'tb', 'retry-all').click();
        await expect.poll(() => pendingNames(page), { timeout: 1500 }).toEqual(['e1.txt', 'e2.txt']);
    });

    test('a cancelled file also enables Retry all', async ({ page }) => {
        await addNamed(page, 'tb', ['c.txt']);
        await expect.poll(() => pendingNames(page)).toEqual(['c.txt']);
        await dz(page, 'tb').evaluate((el: any) => el.cancelFile(el.files[0].id));
        await expect.poll(() => statuses(page, 'tb')).toEqual(['cancelled']);
        await expect(btn(page, 'tb', 'retry-all')).toBeVisible();
        await btn(page, 'tb', 'retry-all').click();
        await expect.poll(() => pendingNames(page)).toEqual(['c.txt']);
    });

    test('without an upload pipeline no Pause / Resume all is offered', async ({ page }) => {
        await addNamed(page, 'no-pipe', ['a.txt']);
        await page.waitForTimeout(100);
        for (const a of ['pause-all', 'resume-all', 'retry-all']) await expect(btn(page, 'no-pipe', a)).toHaveCount(0);
    });
});

test.describe('popover header actions', () => {
    async function openPopover(page: Page) {
        await addNamed(page, 'pop', ['p1.txt', 'p2.txt']);
        await dz(page, 'pop').locator('.dz__summary__line').click();
        await expect(dz(page, 'pop').locator('.dz__popover')).toBeVisible();
    }

    test('Add more opens the native file dialog and keeps the popover open', async ({ page }) => {
        test.fail(true, 'NOTES.md #10');
        await openPopover(page);
        const chooser = page.waitForEvent('filechooser', { timeout: 2000 });
        await btn(page, 'pop', 'add-more').click();
        const fc = await chooser;
        expect(fc.isMultiple()).toBe(true);
        await fc.setFiles([{ name: 'p3.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }]);
        await expect.poll(() => dz(page, 'pop').evaluate((el: any) => el.files.map((f: any) => f.name)))
            .toEqual(['p1.txt', 'p2.txt', 'p3.txt']);
        await expect(dz(page, 'pop').locator('.dz__popover')).toBeVisible();
    });

    test('Clear all removes every file and closes the popover', async ({ page }) => {
        await openPopover(page);
        await btn(page, 'pop', 'clear').click();
        await expect.poll(() => dz(page, 'pop').evaluate((el: any) => el.files.length)).toBe(0);
        await expect(dz(page, 'pop').locator('.dz__popover')).toHaveCount(0);
        const lines = await logLines(page, 'pop');
        expect(lines).toEqual(expect.arrayContaining(['file-remove:p1.txt', 'file-remove:p2.txt']));
    });

    test('Clear all runs beforeFilesRemoveCallback — false keeps the files', async ({ page }) => {
        await dz(page, 'pop').evaluate(async (el: any) => {
            el.beforeFilesRemoveCallback = () => false;
            await el.whenSettled();
        });
        await openPopover(page);
        await btn(page, 'pop', 'clear').click();
        await page.waitForTimeout(100);
        expect(await dz(page, 'pop').evaluate((el: any) => el.files.length)).toBe(2);
    });

    test('a disabled dropzone hides Add more but keeps Clear all', async ({ page }) => {
        await dz(page, 'pop').evaluate(async (el: any) => { el.disabled = true; await el.whenSettled(); });
        await addNamed(page, 'pop', ['p1.txt']);
        await dz(page, 'pop').locator('.dz__summary__line').click();
        await expect(dz(page, 'pop').locator('.dz__popover')).toBeVisible();
        await expect(btn(page, 'pop', 'clear')).toBeVisible();
        await expect(btn(page, 'pop', 'add-more')).toHaveCount(0);
    });

    test('with files, clicking the button selector toggles the popover instead of the file dialog', async ({ page }) => {
        test.fail(true, 'NOTES.md #11');
        let choosers = 0;
        page.on('filechooser', () => { choosers++; });
        await addNamed(page, 'pop', ['p1.txt']);
        await dz(page, 'pop').locator('.dz__button').click();
        await expect(dz(page, 'pop').locator('.dz__popover')).toBeVisible({ timeout: 1000 });
        expect(choosers).toBe(0);
    });
});
