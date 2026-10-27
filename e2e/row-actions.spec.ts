import { test, expect, dz, addNamed, pendingNames, resolveUpload, logLines, type Page } from './fixtures';

/**
 * Per-row action buttons (UI path, not the methods — api.spec / upload-edge
 * cover those). Each row has an always-present action slot
 * (`[data-dz-action="row-action"]`, `data-row-action` = pause | resume | retry,
 * `--hidden` when no action applies), a Cancel ⊘ (`[data-dz-action="cancel"]`,
 * uploading / queued / paused only — the row stays as `cancelled`) and a
 * Remove ✕ (`[data-dz-action="remove"]`, always — a running upload is
 * cancelled first, then the file is removed).
 *
 * Fixture: test/row-actions.html — `#rows` (auto-upload, pump from
 * fixture-kit.js), `#manual` (auto-upload="false" → pending rows).
 */

const PAGE = '/test/row-actions.html';

const row = (page: Page, id: string, name: string) =>
    dz(page, id).locator(`.dz__file-item:has(.dz__file-item__name:text-is("${name}"))`);
const action = (page: Page, id: string, name: string) => row(page, id, name).locator('[data-dz-action="row-action"]');
const removeBtn = (page: Page, id: string, name: string) => row(page, id, name).locator('[data-dz-action="remove"]');
const cancelBtn = (page: Page, id: string, name: string) => row(page, id, name).locator('[data-dz-action="cancel"]');
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
    test('⊘ on an uploading row cancels it — the row stays, status cancelled, no file-remove', async ({ page }) => {
        await addNamed(page, 'rows', ['c.txt']);
        await expect.poll(() => status(page, 'rows', 'c.txt')).toBe('uploading');
        await cancelBtn(page, 'rows', 'c.txt').click();
        await expect.poll(() => status(page, 'rows', 'c.txt')).toBe('cancelled');
        await expect(row(page, 'rows', 'c.txt')).toHaveCount(1);
        expect(await pendingNames(page)).not.toContain('c.txt');
        const log = await logLines(page, 'rows');
        expect(log.some((l) => l.startsWith('file-cancel'))).toBe(true);
        expect(log).not.toContain('file-remove:c.txt');
    });

    test('✕ on an uploading row cancels it, then removes it (file-cancel → file-remove)', async ({ page }) => {
        await addNamed(page, 'rows', ['c.txt']);
        await expect.poll(() => status(page, 'rows', 'c.txt')).toBe('uploading');
        await removeBtn(page, 'rows', 'c.txt').click();
        await expect(row(page, 'rows', 'c.txt')).toHaveCount(0);
        await expect.poll(() => logLines(page, 'rows')).toContain('file-remove:c.txt');
        const log = await logLines(page, 'rows');
        const cancelAt = log.findIndex((l) => l.startsWith('file-cancel'));
        expect(cancelAt).toBeGreaterThan(-1);
        expect(cancelAt).toBeLessThan(log.indexOf('file-remove:c.txt'));
        expect(await pendingNames(page)).not.toContain('c.txt');
    });

    test('✕ on a running file is confirmed through beforeFilesRemoveCallback (veto → keeps uploading)', async ({ page }) => {
        await addNamed(page, 'rows', ['keep.txt']);
        await expect.poll(() => status(page, 'rows', 'keep.txt')).toBe('uploading');
        await dz(page, 'rows').evaluate((el: any) => { el.beforeFilesRemoveCallback = () => false; });
        await removeBtn(page, 'rows', 'keep.txt').click();
        await page.waitForTimeout(100);
        expect(await status(page, 'rows', 'keep.txt')).toBe('uploading');
        await expect(row(page, 'rows', 'keep.txt')).toHaveCount(1);
    });

    test('⊘ asks beforeFilesCancelCallback (veto → keeps uploading)', async ({ page }) => {
        await addNamed(page, 'rows', ['v.txt']);
        await expect.poll(() => status(page, 'rows', 'v.txt')).toBe('uploading');
        await dz(page, 'rows').evaluate((el: any) => { el.beforeFilesCancelCallback = () => false; });
        await cancelBtn(page, 'rows', 'v.txt').click();
        await page.waitForTimeout(100);
        expect(await status(page, 'rows', 'v.txt')).toBe('uploading');
    });

    test('a cancelled row offers Retry (cancelled counts as failed, needs user intervention)', async ({ page }) => {
        await addNamed(page, 'rows', ['c.txt']);
        await expect.poll(() => status(page, 'rows', 'c.txt')).toBe('uploading');
        await cancelBtn(page, 'rows', 'c.txt').click();
        await expect.poll(() => status(page, 'rows', 'c.txt')).toBe('cancelled');
        await expect(action(page, 'rows', 'c.txt')).toHaveAttribute('data-row-action', 'retry', { timeout: 1000 });
        await expect(cancelBtn(page, 'rows', 'c.txt')).toHaveClass(/--hidden/);
        await action(page, 'rows', 'c.txt').click();
        await expect.poll(() => status(page, 'rows', 'c.txt')).toBe('uploading');
    });

    test('⊘ only for uploading / queued / paused; ✕ always — aria-labels name the file', async ({ page }) => {
        await addNamed(page, 'rows', ['a.txt']);
        await expect.poll(() => status(page, 'rows', 'a.txt')).toBe('uploading');
        await expect(cancelBtn(page, 'rows', 'a.txt')).toHaveAttribute('aria-label', 'Cancel a.txt');
        await expect(removeBtn(page, 'rows', 'a.txt')).toHaveAttribute('aria-label', 'Remove a.txt');
        await expect(cancelBtn(page, 'rows', 'a.txt')).not.toHaveClass(/--hidden/);
        await resolveUpload(page, 'a.txt', 'ok');
        await expect.poll(() => status(page, 'rows', 'a.txt')).toBe('complete');
        await expect(cancelBtn(page, 'rows', 'a.txt')).toHaveClass(/--hidden/);
        await expect(cancelBtn(page, 'rows', 'a.txt')).toHaveAttribute('aria-hidden', 'true');
        await expect(removeBtn(page, 'rows', 'a.txt')).toBeVisible();
        // queued (auto-upload off, handler set) → offered; plain picker → not
        await addNamed(page, 'manual', ['q.txt']);
        await expect(cancelBtn(page, 'manual', 'q.txt')).not.toHaveClass(/--hidden/);
        await addNamed(page, 'plain', ['p.txt']);
        await expect(dz(page, 'plain').locator('[data-dz-action="cancel"]')).toHaveClass(/--hidden/);
    });

    test('keyboard: Tab to ⊘ / ✕ and press Enter', async ({ page }) => {
        await addNamed(page, 'rows', ['k.txt', 'k2.txt']);
        await expect.poll(() => status(page, 'rows', 'k.txt')).toBe('uploading');
        // The ⊘ is in the tab order right after the action (pause) slot.
        await action(page, 'rows', 'k.txt').focus();
        await page.keyboard.press('Tab');
        const deepActive = () => page.evaluate(() => {
            let a: any = document.activeElement;
            while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
            return a?.dataset?.dzAction;
        });
        expect(await deepActive()).toBe('cancel');
        await cancelBtn(page, 'rows', 'k.txt').focus();
        await page.keyboard.press('Enter');
        await expect.poll(() => status(page, 'rows', 'k.txt')).toBe('cancelled');
        await removeBtn(page, 'rows', 'k2.txt').focus();
        await page.keyboard.press('Enter');
        await expect(row(page, 'rows', 'k2.txt')).toHaveCount(0);
    });

    test('cancel-icon / remove-icon replace the glyphs (HTML)', async ({ page }) => {
        await addNamed(page, 'icons', ['i.txt']);
        await expect(cancelBtn(page, 'icons', 'i.txt').locator('.my-cancel')).toHaveCount(1);
        await expect(removeBtn(page, 'icons', 'i.txt').locator('.my-remove')).toHaveCount(1);
        await expect(removeBtn(page, 'icons', 'i.txt')).toHaveAttribute('data-custom-icon', '');
        // live change
        await dz(page, 'icons').evaluate(async (el: any) => { el.cancelIcon = '<i class="other">X</i>'; await el.whenSettled(); });
        await expect(cancelBtn(page, 'icons', 'i.txt').locator('.other')).toHaveCount(1);
    });

    test('list satellite: ⊘ cancels (row stays), ✕ removes', async ({ page }) => {
        await addNamed(page, 'sat-store', ['s1.txt', 's2.txt']);
        const satRow = (name: string) => page.locator('#sat-list').locator(`.dz__file-item:has(.dz__file-item__name:text-is("${name}"))`);
        await expect.poll(() => status(page, 'sat-store', 's1.txt')).toBe('uploading');
        await expect(satRow('s1.txt').locator('[data-dz-action="cancel"]')).toHaveAttribute('aria-label', 'Cancel s1.txt');
        await satRow('s1.txt').locator('[data-dz-action="cancel"]').click();
        await expect.poll(() => status(page, 'sat-store', 's1.txt')).toBe('cancelled');
        await expect(satRow('s1.txt')).toHaveCount(1);
        await satRow('s2.txt').locator('[data-dz-action="remove"]').click();
        await expect(satRow('s2.txt')).toHaveCount(0);
        expect(await dz(page, 'sat-store').evaluate((el: any) => el.files.map((f: any) => f.name))).toEqual(['s1.txt']);
    });

    test('popover rows: ⊘ cancels, ✕ removes', async ({ page }) => {
        await addNamed(page, 'pop', ['o1.txt', 'o2.txt']);
        await expect.poll(() => status(page, 'pop', 'o1.txt')).toBe('uploading');
        await dz(page, 'pop').locator('.dz__summary__line').click();
        const popRow = (name: string) => dz(page, 'pop').locator(`tr.dz__popover__row:has(.dz__popover__cell--name:text-is("${name}"))`);
        await popRow('o1.txt').locator('[data-dz-action="cancel"]').click();
        await expect.poll(() => status(page, 'pop', 'o1.txt')).toBe('cancelled');
        await popRow('o2.txt').locator('[data-dz-action="remove"]').click();
        await expect(popRow('o2.txt')).toHaveCount(0);
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
