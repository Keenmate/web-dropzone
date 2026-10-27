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

test.describe('cancel rule', () => {
    test('a queued (pending) file cancels at once and is never started', async ({ page }) => {
        await addNamed(page, 'q', ['1.txt', '2.txt']);
        await expect.poll(() => pendingNames(page)).toEqual(['1.txt']);
        await dz(page, 'q').evaluate((el: any) => el.cancelFile(el.files[1].id));
        expect(await statusOf(page, 'q', '2.txt')).toBe('cancelled');
        await resolveUpload(page, '1.txt', 'ok');
        await expect.poll(() => statusOf(page, 'q', '1.txt')).toBe('complete');
        await page.waitForTimeout(50);
        expect(await callsOf(page, '2.txt')).toBe(0);
    });

    test('a paused file cancels at once', async ({ page }) => {
        await addNamed(page, 'q', ['p.txt']);
        await expect.poll(() => pendingNames(page)).toContain('p.txt');
        await dz(page, 'q').evaluate((el: any) => el.pauseFile(el.files[0].id));
        await expect.poll(() => statusOf(page, 'q', 'p.txt')).toBe('paused');
        await dz(page, 'q').evaluate((el: any) => el.cancelFile(el.files[0].id));
        expect(await statusOf(page, 'q', 'p.txt')).toBe('cancelled');
    });

    test('cancelling the running file hands its slot to the next queued file', async ({ page }) => {
        await addNamed(page, 'q', ['1.txt', '2.txt']);
        await expect.poll(() => pendingNames(page)).toEqual(['1.txt']);
        await dz(page, 'q').evaluate((el: any) => el.cancelFile(el.files[0].id));
        expect(await statusOf(page, 'q', '1.txt')).toBe('cancelled');
        expect(await page.evaluate(() => (window as any).__aborted['1.txt'])).toBe(true);
        await expect.poll(() => pendingNames(page)).toEqual(['2.txt']);
    });

    test('handler ignoring the signal: "Cancelling…" + disabled buttons, then timeout → error (cancel-timeout), slot freed, late result ignored', async ({ page }) => {
        await addNamed(page, 'stubborn', ['s.txt', 'next.txt']);
        await expect.poll(() => pendingNames(page)).toEqual(['s.txt']);
        const done = dz(page, 'stubborn').evaluate((el: any) => el.cancelFile(el.files[0].id).then(() => 'done'));
        await expect.poll(() => statusOf(page, 'stubborn', 's.txt')).toBe('cancelling');
        const row = dz(page, 'stubborn').locator('.dz__file-item[data-status="cancelling"]');
        await expect(row.locator('.dz__file-item__progress-text')).toHaveText('Cancelling…');
        await expect(row.locator('[data-dz-action="remove"]')).toBeDisabled();
        expect(await callsOf(page, 'next.txt')).toBe(0); // slot still held
        expect(await done).toBe('done');
        expect(await statusOf(page, 'stubborn', 's.txt')).toBe('error');
        expect(await dz(page, 'stubborn').evaluate((el: any) => el.files[0].error)).toBe('cancel-timeout');
        await expect.poll(() => callsOf(page, 'next.txt')).toBe(1); // slot handed off on timeout
        await resolveUpload(page, 's.txt', 'ok'); // late — ignored
        await page.waitForTimeout(50);
        expect(await statusOf(page, 'stubborn', 's.txt')).toBe('error');
        expect(await logOf(page, 'stubborn')).not.toContain('file-upload-complete:s.txt');
    });

    test('cancel-timeout-behavior="remove": a timed-out cancel removes the file', async ({ page }) => {
        await addNamed(page, 'stubborn-remove', ['r.txt']);
        await expect.poll(() => pendingNames(page)).toContain('r.txt');
        await dz(page, 'stubborn-remove').evaluate((el: any) => el.cancelFile(el.files[0].id));
        expect(await dz(page, 'stubborn-remove').evaluate((el: any) => el.files.length)).toBe(0);
        expect(await logOf(page, 'stubborn-remove')).toContain('file-remove:r.txt');
    });

    test('a handler RESOLVING while cancelling still ends cancelled', async ({ page }) => {
        await addNamed(page, 'stubborn', ['ok.txt']);
        await expect.poll(() => pendingNames(page)).toContain('ok.txt');
        const done = dz(page, 'stubborn').evaluate((el: any) => el.cancelFile(el.files[0].id));
        await expect.poll(() => statusOf(page, 'stubborn', 'ok.txt')).toBe('cancelling');
        await resolveUpload(page, 'ok.txt', 'ok');
        await done;
        expect(await statusOf(page, 'stubborn', 'ok.txt')).toBe('cancelled');
        expect(await logOf(page, 'stubborn')).not.toContain('file-upload-complete:ok.txt');
    });

    test('cancel-timeout / cancel-timeout-behavior are reactive inputs', async ({ page }) => {
        const cfg = await dz(page, 'q').evaluate(async (el: any) => {
            el.setAttribute('cancel-timeout', '50');
            el.cancelTimeoutBehavior = 'remove';
            await el.whenSettled();
            const c = el.controller.getConfig();
            return { t: c.cancelTimeout, b: c.cancelTimeoutBehavior, attr: el.getAttribute('cancel-timeout-behavior') };
        });
        expect(cfg).toEqual({ t: 50, b: 'remove', attr: 'remove' });
    });
});

test.describe('beforeFileCancelCallback + file-cancel', () => {
    test('file-cancel detail: { file, result, uploadedBytes, metadata } + onFileCancel twin', async ({ page }) => {
        await addNamed(page, 'q', ['d.txt']);
        await expect.poll(() => pendingNames(page)).toContain('d.txt');
        await pumpProgress(page, 'd.txt', 50);
        const detail = await dz(page, 'q').evaluate(async (el: any) => {
            el.files[0].metadata = { uploadUrl: '/tus/123' };
            let twin: any = null;
            let event: any = null;
            el.onFileCancel = (d: any) => { twin = d; };
            el.addEventListener('file-cancel', (e: any) => { event = e.detail; }, { once: true });
            await el.cancelFile(el.files[0].id);
            el.onFileCancel = null;
            return {
                sameObject: twin === event,
                name: event.file.name, result: event.result,
                uploadedBytes: event.uploadedBytes, metadata: event.metadata,
                hasController: !!event.controller, keys: Object.keys(event).sort()
            };
        });
        expect(detail).toEqual({
            sameObject: true, name: 'd.txt', result: 'cancelled', uploadedBytes: 500,
            metadata: { uploadUrl: '/tus/123' }, hasController: true,
            keys: ['file', 'metadata', 'result', 'uploadedBytes']
        });
    });

    test('result timeout-error / timeout-remove', async ({ page }) => {
        await addNamed(page, 'stubborn', ['te.txt']);
        await addNamed(page, 'stubborn-remove', ['tr.txt']);
        await expect.poll(() => pendingNames(page)).toEqual(expect.arrayContaining(['te.txt', 'tr.txt']));
        await dz(page, 'stubborn').evaluate((el: any) => el.cancelFile(el.files[0].id));
        await dz(page, 'stubborn-remove').evaluate((el: any) => el.cancelFile(el.files[0].id));
        expect(await logOf(page, 'stubborn')).toContain('file-cancel:te.txt:timeout-error');
        const rlog = await logOf(page, 'stubborn-remove');
        expect(rlog).toContain('file-cancel:tr.txt:timeout-remove');
        expect(rlog.indexOf('file-remove:tr.txt')).toBeLessThan(rlog.indexOf('file-cancel:tr.txt:timeout-remove'));
    });

    test('the gate gets { files, allFiles }; false vetoes (upload keeps running)', async ({ page }) => {
        await addNamed(page, 'q', ['v.txt', 'w.txt']);
        await expect.poll(() => pendingNames(page)).toEqual(['v.txt']);
        const out = await dz(page, 'q').evaluate(async (el: any) => {
            const seen: any[] = [];
            el.beforeFileCancelCallback = (ctx: any) => {
                seen.push({ files: ctx.files.map((f: any) => f.name), all: ctx.allFiles.length, ctl: !!ctx.controller });
                return Promise.resolve(false);
            };
            await el.cancelFile(el.files[0].id);
            el.beforeFileCancelCallback = null;
            return { seen, status: el.files[0].status };
        });
        expect(out.seen).toEqual([{ files: ['v.txt'], all: 2, ctl: true }]);
        expect(out.status).toBe('uploading');
        expect(await page.evaluate(() => (window as any).__aborted['v.txt'])).toBeUndefined();
        expect(await logOf(page, 'q')).not.toContain('file-cancel:v.txt:cancelled');
    });

    test('removing a running file cancels it WITHOUT asking the cancel gate (file-cancel, then file-remove)', async ({ page }) => {
        await addNamed(page, 'q', ['rm.txt']);
        await expect.poll(() => pendingNames(page)).toContain('rm.txt');
        const asked = await dz(page, 'q').evaluate(async (el: any) => {
            let n = 0;
            el.beforeFileCancelCallback = () => { n++; return false; };
            await el.removeFile(el.files[0].id);
            el.beforeFileCancelCallback = null;
            return n;
        });
        expect(asked).toBe(0);
        const log = await logOf(page, 'q');
        expect(log.indexOf('file-cancel:rm.txt:cancelled')).toBeGreaterThan(-1);
        expect(log.indexOf('file-cancel:rm.txt:cancelled')).toBeLessThan(log.indexOf('file-remove:rm.txt'));
    });
});

test.describe('cancelAll + "Cancel all"', () => {
    test('cancels uploading / pending / paused (complete untouched), gate asked once, resolves when all finished', async ({ page }) => {
        await addNamed(page, 'q', ['done.txt']);
        await expect.poll(() => pendingNames(page)).toContain('done.txt');
        await resolveUpload(page, 'done.txt', 'ok');
        await expect.poll(() => statusOf(page, 'q', 'done.txt')).toBe('complete');
        await addNamed(page, 'q', ['up.txt', 'paused.txt', 'queued.txt']);
        await expect.poll(() => pendingNames(page)).toContain('up.txt');
        await dz(page, 'q').evaluate((el: any) => el.pauseFile(el.files.find((f: any) => f.name === 'paused.txt').id));
        const out = await dz(page, 'q').evaluate(async (el: any) => {
            const asked: string[][] = [];
            el.beforeFileCancelCallback = (ctx: any) => { asked.push(ctx.files.map((f: any) => f.name)); };
            await el.controller.cancelAll();
            el.beforeFileCancelCallback = null;
            return { asked, statuses: el.files.map((f: any) => `${f.name}:${f.status}`) };
        });
        expect(out.asked).toEqual([['up.txt', 'paused.txt', 'queued.txt']]);
        expect(out.statuses).toEqual(['done.txt:complete', 'up.txt:cancelled', 'paused.txt:cancelled', 'queued.txt:cancelled']);
        expect(await callsOf(page, 'queued.txt')).toBe(0);
    });

    test('a vetoing gate keeps everything running', async ({ page }) => {
        await addNamed(page, 'q', ['a.txt', 'b.txt']);
        await expect.poll(() => pendingNames(page)).toContain('a.txt');
        const statuses = await dz(page, 'q').evaluate(async (el: any) => {
            el.beforeFileCancelCallback = () => false;
            await el.cancelAll();
            el.beforeFileCancelCallback = null;
            return el.files.map((f: any) => f.status);
        });
        expect(statuses).toEqual(['uploading', 'pending']);
    });

    test('the progress satellite shows "Cancel all" only while something is uploading / queued / paused; clicking it cancels', async ({ page }) => {
        const btn = page.locator('#progress-sat').locator('[data-dz-action="cancel-all"]');
        await addNamed(page, 'list-store', ['1.txt', '2.txt']);
        await expect.poll(() => pendingNames(page)).toEqual(['1.txt']);
        await expect(btn).toBeVisible();
        await expect(btn).toHaveText('Cancel all');
        // Sits next to Pause all.
        await expect(page.locator('#progress-sat').locator('[data-dz-action="pause-all"]')).toBeVisible();
        await btn.click();
        await expect.poll(() => statusOf(page, 'list-store', '1.txt')).toBe('cancelled');
        expect(await statusOf(page, 'list-store', '2.txt')).toBe('cancelled');
        await expect(btn).toHaveCount(0);
    });

    test('the in-element strip offers "Cancel all" too', async ({ page }) => {
        await addNamed(page, 'q', ['s1.txt']);
        await expect.poll(() => pendingNames(page)).toContain('s1.txt');
        const btn = dz(page, 'q').locator('.dz__overall-progress [data-dz-action="cancel-all"]');
        await expect(btn).toBeVisible();
        await btn.click();
        await expect.poll(() => statusOf(page, 'q', 's1.txt')).toBe('cancelled');
    });
});
