import { test, expect, dz, addNamed, pendingNames, resolveUpload, logLines, type Page } from './fixtures';

/**
 * Per-row action buttons (UI path, not the methods — api.spec / upload-edge
 * cover those). Each row has an always-present action slot
 * (`[data-dz-action="row-action"]`, `data-row-action` = pause | resume | retry,
 * `--hidden` when no action applies) and a remove ✕ (`[data-dz-action="remove"]`):
 * ✕ on an uploading row cancels (row stays), on anything else removes.
 *
 * Fixture: test/row-actions.html — `#rows` (auto-upload, pump from
 * fixture-kit.js), `#manual` (auto-upload="false" → pending rows).
 */

const PAGE = '/test/row-actions.html';

const row = (page: Page, id: string, name: string) =>
    dz(page, id).locator(`.dz__file-item:has(.dz__file-item__name:text-is("${name}"))`);
const action = (page: Page, id: string, name: string) => row(page, id, name).locator('[data-dz-action="row-action"]');
const removeBtn = (page: Page, id: string, name: string) => row(page, id, name).locator('[data-dz-action="remove"]');
const status = (page: Page, id: string, name: string) =>
    dz(page, id).evaluate((el: any, n) => el.files.find((f: any) => f.name === n)?.status, name);
const calls = (page: Page, name: string) =>
    page.evaluate((n) => (window as any).__calls.filter((c: any) => c.name === n).length, name);

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test.describe('action slot follows status', () => {
    test('pending rows show no action (slot present but hidden + inert)', async ({ page }) => {
        await addNamed(page, 'manual', ['p.txt']);
        const a = action(page, 'manual', 'p.txt');
        await expect(a).toHaveCount(1);
        await expect(a).toHaveClass(/--hidden/);
        await expect(a).toHaveAttribute('aria-hidden', 'true');
    });

    test('uploading → Pause; click → paused, slot becomes Resume', async ({ page }) => {
        await addNamed(page, 'rows', ['a.txt']);
        await expect(action(page, 'rows', 'a.txt')).toHaveAttribute('data-row-action', 'pause');
        await expect(action(page, 'rows', 'a.txt')).toHaveAttribute('aria-label', 'Pause a.txt');
        await action(page, 'rows', 'a.txt').click();
        await expect.poll(() => status(page, 'rows', 'a.txt')).toBe('paused');
        await expect(action(page, 'rows', 'a.txt')).toHaveAttribute('data-row-action', 'resume');
        expect(await pendingNames(page)).not.toContain('a.txt'); // in-flight attempt aborted
    });

    test('Resume re-invokes the handler; the row is uploading again', async ({ page }) => {
        await addNamed(page, 'rows', ['a.txt']);
        await action(page, 'rows', 'a.txt').click(); // pause
        await expect(action(page, 'rows', 'a.txt')).toHaveAttribute('data-row-action', 'resume');
        await action(page, 'rows', 'a.txt').click(); // resume
        await expect.poll(() => pendingNames(page)).toContain('a.txt');
        await expect.poll(() => status(page, 'rows', 'a.txt')).toBe('uploading');
        expect(await calls(page, 'a.txt')).toBe(2);
        await expect(action(page, 'rows', 'a.txt')).toHaveAttribute('data-row-action', 'pause');
    });

    test('error → Retry; click re-runs the upload to complete (file-retry fires)', async ({ page }) => {
        await addNamed(page, 'rows', ['e.txt']);
        await expect.poll(() => pendingNames(page)).toContain('e.txt');
        await resolveUpload(page, 'e.txt', 'fail');
        await expect(action(page, 'rows', 'e.txt')).toHaveAttribute('data-row-action', 'retry');
        await action(page, 'rows', 'e.txt').click();
        await expect.poll(() => pendingNames(page)).toContain('e.txt');
        await resolveUpload(page, 'e.txt', 'ok');
        await expect.poll(() => status(page, 'rows', 'e.txt')).toBe('complete');
        await expect(action(page, 'rows', 'e.txt')).toHaveClass(/--hidden/);
        expect(await logLines(page, 'rows')).toContain('file-retry:e.txt');
    });

    test('the clicks do not bubble into the picker (no file dialog)', async ({ page }) => {
        let choosers = 0;
        page.on('filechooser', () => { choosers++; });
        await addNamed(page, 'rows', ['a.txt']);
        await action(page, 'rows', 'a.txt').click();
        await page.waitForTimeout(200);
        expect(choosers).toBe(0);
    });
});

test.describe('remove ✕', () => {
    test('✕ on an uploading row cancels it — the row stays, status cancelled, no file-remove', async ({ page }) => {
        await addNamed(page, 'rows', ['c.txt']);
        await expect.poll(() => status(page, 'rows', 'c.txt')).toBe('uploading');
        await removeBtn(page, 'rows', 'c.txt').click();
        await expect.poll(() => status(page, 'rows', 'c.txt')).toBe('cancelled');
        await expect(row(page, 'rows', 'c.txt')).toHaveCount(1);
        expect(await pendingNames(page)).not.toContain('c.txt');
        expect(await logLines(page, 'rows')).not.toContain('file-remove:c.txt');
    });

    test('a second ✕ on the cancelled row removes it', async ({ page }) => {
        await addNamed(page, 'rows', ['c.txt']);
        await expect.poll(() => status(page, 'rows', 'c.txt')).toBe('uploading');
        await removeBtn(page, 'rows', 'c.txt').click();
        await expect.poll(() => status(page, 'rows', 'c.txt')).toBe('cancelled');
        await removeBtn(page, 'rows', 'c.txt').click();
        await expect(row(page, 'rows', 'c.txt')).toHaveCount(0);
        await expect.poll(() => logLines(page, 'rows')).toContain('file-remove:c.txt');
    });

    test('a cancelled row offers Retry (cancelled counts as failed, needs user intervention)', async ({ page }) => {
        await addNamed(page, 'rows', ['c.txt']);
        await expect.poll(() => status(page, 'rows', 'c.txt')).toBe('uploading');
        await removeBtn(page, 'rows', 'c.txt').click();
        await expect.poll(() => status(page, 'rows', 'c.txt')).toBe('cancelled');
        await expect(action(page, 'rows', 'c.txt')).toHaveAttribute('data-row-action', 'retry', { timeout: 1000 });
        await action(page, 'rows', 'c.txt').click();
        await expect.poll(() => status(page, 'rows', 'c.txt')).toBe('uploading');
    });

    test('✕ on a pending row removes it immediately', async ({ page }) => {
        await addNamed(page, 'manual', ['p1.txt', 'p2.txt']);
        await removeBtn(page, 'manual', 'p1.txt').click();
        await expect(row(page, 'manual', 'p1.txt')).toHaveCount(0);
        expect(await dz(page, 'manual').evaluate((el: any) => el.files.map((f: any) => f.name))).toEqual(['p2.txt']);
    });

    test('✕ on a completed row removes it', async ({ page }) => {
        await addNamed(page, 'rows', ['done.txt']);
        await expect.poll(() => pendingNames(page)).toContain('done.txt');
        await resolveUpload(page, 'done.txt', 'ok');
        await expect.poll(() => status(page, 'rows', 'done.txt')).toBe('complete');
        await removeBtn(page, 'rows', 'done.txt').click();
        await expect(row(page, 'rows', 'done.txt')).toHaveCount(0);
    });
});
