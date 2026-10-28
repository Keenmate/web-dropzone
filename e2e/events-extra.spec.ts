import { test, expect, dz, addNamed, pendingNames, resolveUpload, pumpProgress, logLines } from './fixtures';

/**
 * Section 17 — file-update, file-row-update, renderSummaryCallback.
 *
 * Fixture: test/events-extra.html.
 *
 *   - file-update covers any FileState field write OTHER than
 *     progress/status (which have their own events). Fires from
 *     generatePreview (previewUrl) and the upload handler's post-success
 *     merge (metadata / downloadUrl / name).
 *
 *   - file-row-update is the bridge for element-returning row callbacks:
 *     the framework caches the element across state ticks and dispatches
 *     this event on it instead of replacing the node. Listeners attached
 *     during initial render survive every tick.
 *
 *   - renderSummaryCallback (render-mode="structural" + list-appearance="popover")
 *     replaces the inline summary line that opens the popover.
 */

const PAGE = '/test/events-extra.html';

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function');
});

test.describe('file-update', () => {
    test('fires when the upload handler post-merges metadata onto the FileState', async ({ page }) => {
        await addNamed(page, 'updated', ['m.txt']);
        await expect.poll(() => pendingNames(page)).toContain('m.txt');
        // Handler resolves with { metadata } — the store merges and fires
        // file-update.
        await resolveUpload(page, 'm.txt', { metadata: { uploadId: 'abc' } });
        await expect(page.locator('#updated-log')).toContainText('updated m.txt');
    });
});

test.describe('file-row-update', () => {
    test('progress ticks dispatch file-row-update on the cached element', async ({ page }) => {
        await addNamed(page, 'row-update', ['p.txt']);
        await expect.poll(() => pendingNames(page)).toContain('p.txt');

        await pumpProgress(page, 'p.txt', 30);
        await pumpProgress(page, 'p.txt', 60);

        const events = await page.evaluate(() => (window as any).__rowUpdateLog);
        // The listener attached at first render received at least 2 ticks.
        expect(events.length).toBeGreaterThanOrEqual(2);
        const lastProgress = events[events.length - 1].progress;
        expect(lastProgress).toBe(60);
    });
});

test.describe('renderSummaryCallback', () => {
    test('replaces the popover summary line with the callback markup', async ({ page }) => {
        await addNamed(page, 'summary-cb', ['a.txt', 'b.txt']);
        const sum = dz(page, 'summary-cb').locator('.custom-summary');
        await expect(sum).toBeVisible();
        await expect(sum).toContainText('★ 2 pinned');
    });
});

test.describe('file-delete (server-side state) + setMetadata / uploadMetadata', () => {
    const del = (page: import('@playwright/test').Page) => dz(page, 'del');
    const fileId = (page: import('@playwright/test').Page, name: string) =>
        del(page).evaluate((el: any, n) => el.files.find((f: any) => f.name === n).id, name);
    const calls = (page: import('@playwright/test').Page, name: string) =>
        page.evaluate((n) => (window as any).__calls.filter((c: any) => c.name === n), name);
    const startUpload = (page: import('@playwright/test').Page) => del(page).evaluate((el: any) => { void el.uploadAll(); });

    test('removing a never-uploaded file fires file-remove only', async ({ page }) => {
        await addNamed(page, 'del', ['p.txt']);
        const id = await fileId(page, 'p.txt');
        await del(page).evaluate((el: any, id) => el.removeFile(id), id);
        await expect.poll(() => logLines(page, 'del')).toEqual(['file-remove:p.txt']);
    });

    test('removing a completed file fires file-remove AND file-delete', async ({ page }) => {
        await addNamed(page, 'del', ['c.txt']);
        await startUpload(page);
        await expect.poll(() => pendingNames(page)).toContain('c.txt');
        await resolveUpload(page, 'c.txt');
        await expect.poll(() => del(page).evaluate((el: any) => el.files[0].status)).toBe('complete');
        const id = await fileId(page, 'c.txt');
        await del(page).evaluate((el: any, id) => el.removeFile(id), id);
        await expect.poll(() => logLines(page, 'del')).toEqual(['file-remove:c.txt', 'file-delete:c.txt']);
    });

    test('setMetadata during a partial upload counts as server state (pause → remove fires file-delete)', async ({ page }) => {
        await addNamed(page, 'del', ['m.txt']);
        await startUpload(page);
        await expect.poll(() => pendingNames(page)).toContain('m.txt');
        await page.evaluate(() => (window as any).__setMeta('m.txt', { session: 'tus-1' }));
        const id = await fileId(page, 'm.txt');
        await del(page).evaluate((el: any, id) => el.pauseFile(id), id);
        await expect.poll(() => del(page).evaluate((el: any) => el.files[0].status)).toBe('paused');
        await del(page).evaluate((el: any, id) => el.removeFile(id), id);
        await expect.poll(() => logLines(page, 'del')).toEqual(['file-remove:m.txt', 'file-delete:m.txt']);
    });

    test('metadata stashed via setMetadata is handed back as ctx.metadata on resume', async ({ page }) => {
        await addNamed(page, 'del', ['r.txt']);
        await startUpload(page);
        await expect.poll(() => pendingNames(page)).toContain('r.txt');
        await page.evaluate(() => (window as any).__setMeta('r.txt', { session: 'abc', offset: 10 }));
        const id = await fileId(page, 'r.txt');
        await del(page).evaluate((el: any, id) => el.pauseFile(id), id);
        await expect.poll(() => del(page).evaluate((el: any) => el.files[0].status)).toBe('paused');
        await del(page).evaluate((el: any, id) => { void el.resumeFile(id); }, id);
        await expect.poll(() => calls(page, 'r.txt').then((c) => c.length)).toBe(2);
        const [first, second] = await calls(page, 'r.txt');
        expect(first.metadata).toBeNull();
        expect(second.metadata).toEqual({ session: 'abc', offset: 10 });
    });

    test('controller.addFiles(files, { uploadMetadata }) reaches the handler as ctx.uploadMetadata', async ({ page }) => {
        // Via the controller: `el.addFiles(files)` takes no options (NOTES.md #12).
        await del(page).evaluate((el: any) => el.controller.addFiles(
            [new File(['x'], 'u.txt', { type: 'text/plain' })], { uploadMetadata: { folder: 'invoices' } }));
        await startUpload(page);
        await expect.poll(() => calls(page, 'u.txt').then((c) => c.length)).toBe(1);
        expect((await calls(page, 'u.txt'))[0].uploadMetadata).toEqual({ folder: 'invoices' });
    });

    test('clear() fires file-delete only for the files with server state', async ({ page }) => {
        await addNamed(page, 'del', ['done.txt', 'fresh.txt']);
        const id = await fileId(page, 'done.txt');
        await del(page).evaluate((el: any, id) => { void el.uploadFile(id); }, id);
        await expect.poll(() => pendingNames(page)).toContain('done.txt');
        await resolveUpload(page, 'done.txt');
        await expect.poll(() => del(page).evaluate((el: any, id) => el.getFileById(id).status, id)).toBe('complete');
        await del(page).evaluate((el: any) => el.clear());
        await expect.poll(() => logLines(page, 'del')).toEqual(
            expect.arrayContaining(['file-remove:done.txt', 'file-remove:fresh.txt', 'file-delete:done.txt']));
        expect(await logLines(page, 'del')).not.toContain('file-delete:fresh.txt');
    });
});
