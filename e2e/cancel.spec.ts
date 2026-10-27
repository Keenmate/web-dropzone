import { test, expect, dz, addNamed, pendingNames, resolveUpload, pumpProgress } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Cancel / remove / teardown — the cancel rule, the bulk + row controls,
 * element removal vs DOM move, and the lifecycle bug fixes.
 *
 * Fixture: test/cancel.html. Every upload parks in `window.__pending` until
 * the spec settles it (`resolveUpload`). `#stubborn*` handlers ignore their
 * AbortSignal (exercise the cancel timeout).
 */

const PAGE = '/test/cancel.html';

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function'
        && !!(window as any).__log?.q);
});

const logOf = (page: Page, id: string): Promise<string[]> =>
    page.evaluate((id) => [...(window as any).__log[id]], id);
const clearLog = (page: Page, id: string): Promise<void> =>
    page.evaluate((id) => { (window as any).__log[id].length = 0; }, id);
const statusOf = (page: Page, id: string, name: string): Promise<string | undefined> =>
    page.evaluate(({ id, name }) => (window as any).__status(id, name), { id, name });
const callsOf = (page: Page, name: string): Promise<number> =>
    page.evaluate((name) => (window as any).__calls[name] ?? 0, name);

test.describe('lifecycle bug fixes', () => {
    test('cancel during the auto-retry backoff → cancelled, no further attempt', async ({ page }) => {
        await addNamed(page, 'policy', ['b.txt']);
        await expect.poll(() => pendingNames(page)).toContain('b.txt');
        await resolveUpload(page, 'b.txt', 'fail'); // attempt 1 fails → 400 ms backoff
        await expect.poll(() => callsOf(page, 'b.txt')).toBe(1);
        await dz(page, 'policy').evaluate((el: any) => el.cancelFile(el.files[0].id));
        await expect.poll(() => statusOf(page, 'policy', 'b.txt')).toBe('cancelled');
        await page.waitForTimeout(700); // past the backoff
        expect(await callsOf(page, 'b.txt')).toBe(1);
        expect(await statusOf(page, 'policy', 'b.txt')).toBe('cancelled');
    });

    test('destroy() stops the queue — queued files are never started, no events after', async ({ page }) => {
        await addNamed(page, 'q', ['1.txt', '2.txt', '3.txt']);
        await expect.poll(() => pendingNames(page)).toEqual(['1.txt']);
        await dz(page, 'q').evaluate((el: any) => el.destroy());
        await clearLog(page, 'q');
        // The aborted first upload rejects; nothing else may start.
        await page.waitForTimeout(150);
        expect(await callsOf(page, '2.txt')).toBe(0);
        expect(await callsOf(page, '3.txt')).toBe(0);
        expect(await logOf(page, 'q')).toEqual([]);
        expect(await page.evaluate(() => (window as any).__aborted['1.txt'])).toBe(true);
    });

    test('a handler resolving after destroy() emits nothing', async ({ page }) => {
        await addNamed(page, 'stubborn', ['late.txt']); // ignores the signal → stays parked
        await expect.poll(() => pendingNames(page)).toContain('late.txt');
        await dz(page, 'stubborn').evaluate((el: any) => el.destroy());
        await clearLog(page, 'stubborn');
        await resolveUpload(page, 'late.txt', 'ok');
        await page.waitForTimeout(100);
        expect(await logOf(page, 'stubborn')).toEqual([]);
    });

    test('a handler resolving after its file was removed emits nothing for it', async ({ page }) => {
        await addNamed(page, 'stubborn', ['gone.txt']);
        await expect.poll(() => pendingNames(page)).toContain('gone.txt');
        await page.evaluate(() => (window as any).__progress('gone.txt', 30));
        // Remove waits for the cancel; the stubborn handler times out (300 ms).
        await dz(page, 'stubborn').evaluate((el: any) => el.removeFile(el.files[0].id));
        expect(await dz(page, 'stubborn').evaluate((el: any) => el.files.length)).toBe(0);
        await clearLog(page, 'stubborn');
        await resolveUpload(page, 'gone.txt', 'ok');
        await page.waitForTimeout(100);
        expect(await logOf(page, 'stubborn')).toEqual([]);
    });

    test('a mode-flip rebuild reports the dropped files (file-remove + change)', async ({ page }) => {
        await addNamed(page, 'flip', ['x.txt', 'y.txt']);
        await clearLog(page, 'flip');
        await dz(page, 'flip').evaluate((el: any) => { el.setAttribute('mode', 'headless'); return el.whenSettled(); });
        const log = await logOf(page, 'flip');
        expect(log).toContain('file-remove:x.txt');
        expect(log).toContain('file-remove:y.txt');
        expect(log).toContain('change:');
        expect(await dz(page, 'flip').evaluate((el: any) => el.files.length)).toBe(0);
    });

    test('cancel drops the held progress tick — no file-progress after the cancel', async ({ page }) => {
        await addNamed(page, 'throttle', ['t.txt']);
        await expect.poll(() => pendingNames(page)).toContain('t.txt');
        await pumpProgress(page, 't.txt', 10); // leading edge
        await pumpProgress(page, 't.txt', 20); // held for the trailing edge
        await dz(page, 'throttle').evaluate((el: any) => el.cancelFile(el.files[0].id));
        await expect.poll(() => statusOf(page, 'throttle', 't.txt')).toBe('cancelled');
        await clearLog(page, 'throttle');
        await page.waitForTimeout(450); // past the 300 ms throttle window
        expect((await logOf(page, 'throttle')).filter((l) => l.startsWith('file-progress'))).toEqual([]);
    });

    for (const how of ['retryFile', 'resumeFile'] as const) {
        test(`${how} on a cancelled file restarts from 0`, async ({ page }) => {
            await addNamed(page, 'q', ['c.txt']);
            await expect.poll(() => pendingNames(page)).toContain('c.txt');
            await pumpProgress(page, 'c.txt', 40);
            await dz(page, 'q').evaluate((el: any) => el.cancelFile(el.files[0].id));
            await expect.poll(() => statusOf(page, 'q', 'c.txt')).toBe('cancelled');
            await dz(page, 'q').evaluate((el: any, how) => { void el[how](el.files[0].id); }, how);
            await expect.poll(() => callsOf(page, 'c.txt')).toBe(2);
            expect(await page.evaluate(() => (window as any).__startPercent['c.txt'])).toBe(0);
            expect(await dz(page, 'q').evaluate((el: any) => el.files[0].progress)).toBe(0);
        });
    }
});
