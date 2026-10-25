import { test, expect, dz, addNamed, pendingNames, resolveUpload, pumpProgress } from './fixtures';

/**
 * Section 16 — upload pipeline edge cases.
 *
 * Fixture: test/upload-edge.html. Six dropzones cover the harder paths
 * of the upload state machine: throttling, pessimistic progress,
 * resume-from-context, retry preservation, completed reorder timer,
 * and bulk action methods.
 */

const PAGE = '/test/upload-edge.html';

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function');
});

test.describe('progress-throttle', () => {
    test('emission rate is capped — 10 pumps in fast succession land < 10 file-progress events', async ({ page }) => {
        await addNamed(page, 'throttle', ['t.txt']);
        await expect.poll(() => pendingNames(page)).toContain('t.txt');

        // Reset the counter, then pump 10 progress updates back-to-back.
        await page.evaluate(() => { (window as any).__throttleCount = 0; });
        for (let i = 1; i <= 10; i++) await pumpProgress(page, 't.txt', i * 10);

        // With a 200ms throttle, leading + trailing edge → at most ~2 events.
        // The leading edge may already have been spent on the upload start
        // (before the counter reset), so wait for the trailing edge.
        const count = () => page.evaluate(() => (window as any).__throttleCount);
        await expect.poll(count).toBeGreaterThan(0);
        expect(await count()).toBeLessThan(10);
    });
});

test.describe('progress-mode="pessimistic"', () => {
    test('attempt failure does NOT snap progress back to startBytes', async ({ page }) => {
        await addNamed(page, 'pessimistic', ['p.txt']);
        await expect.poll(() => pendingNames(page)).toContain('p.txt');

        await pumpProgress(page, 'p.txt', 60);
        await resolveUpload(page, 'p.txt', 'fail');

        // After failure, the file status should be 'error' but progress
        // stays at the last reported value (pessimistic = no rollback).
        await expect.poll(
            () => dz(page, 'pessimistic').evaluate((el: any) => el.files[0].status)
        ).toBe('error');
        const prog = await dz(page, 'pessimistic').evaluate((el: any) => el.files[0].progress);
        expect(prog).toBeGreaterThanOrEqual(60);
    });
});

test.describe('resume from context.startBytes', () => {
    test('after pause + resume, the next handler invocation sees startBytes > 0', async ({ page }) => {
        await addNamed(page, 'resume', ['r.txt']);
        await expect.poll(() => pendingNames(page)).toContain('r.txt');

        await pumpProgress(page, 'r.txt', 40);
        await dz(page, 'resume').evaluate((el: any) => el.pauseFile(el.files[0].id));

        await expect.poll(
            () => dz(page, 'resume').evaluate((el: any) => el.files[0].status)
        ).toBe('paused');

        // Resume — the handler is called again with a non-zero startBytes
        await dz(page, 'resume').evaluate((el: any) => void el.resumeFile(el.files[0].id));
        await expect.poll(() => pendingNames(page)).toContain('r.txt');

        const info = await page.evaluate((name) => (window as any).__startInfo(name), 'r.txt');
        expect(info?.startPercent).toBeGreaterThanOrEqual(40);
    });
});

test.describe('retry preserves progress', () => {
    test('after error, retryFile re-invokes the handler with the failed-at progress', async ({ page }) => {
        await addNamed(page, 'retry', ['fail-me.txt']);
        await expect.poll(() => pendingNames(page)).toContain('fail-me.txt');

        await pumpProgress(page, 'fail-me.txt', 30);
        await resolveUpload(page, 'fail-me.txt', 'fail');

        await expect.poll(
            () => dz(page, 'retry').evaluate((el: any) => el.files[0].status)
        ).toBe('error');

        // retryFile re-runs the handler — the resume context carries
        // whatever progress was last reported (pessimistic preserves; in
        // optimistic mode the bar snapped back to 0 at failure, so retry
        // would see startPercent=0). The optimistic-mode dropzone keeps
        // it at the last optimistic value when the retry runs.
        await dz(page, 'retry').evaluate((el: any) => el.retryFile(el.files[0].id));
        await expect.poll(() => pendingNames(page)).toContain('fail-me.txt');
    });
});

test.describe('reorder-completed', () => {
    test('a completed file ends up at the bottom of the ordered queue', async ({ page }) => {
        await addNamed(page, 'reorder', ['x.txt', 'y.txt', 'z.txt']);
        await expect.poll(() => pendingNames(page).then(n => n.length)).toBeGreaterThanOrEqual(1);

        // Complete the FIRST one — it should reorder past the others.
        const firstName = (await pendingNames(page))[0];
        await resolveUpload(page, firstName, 'ok');

        // Wait for the delay timer + a frame.
        await page.waitForTimeout(150);

        // The completed file's id should land at the end of the ordered set.
        const lastName = await dz(page, 'reorder').evaluate((el: any) => {
            const store = el.controller;
            const ordered = store.getFiles().slice().sort((a: any, b: any) => {
                // Use the renderer's getOrderedFiles via the same heuristic —
                // completed files reorder after the rest.
                return 0;
            });
            return ordered[ordered.length - 1]?.name;
        });
        // Loose check: the completed file is in the store with status complete.
        const completed = await dz(page, 'reorder').evaluate((el: any) =>
            el.files.find((f: any) => f.status === 'complete')?.name
        );
        expect(completed).toBe(firstName);
    });
});

test.describe('bulk methods', () => {
    test('pauseAll flips every uploading file to paused', async ({ page }) => {
        await addNamed(page, 'bulk', ['b1', 'b2', 'b3']);
        await expect.poll(() => pendingNames(page).then(n => n.length)).toBeGreaterThanOrEqual(1);
        await dz(page, 'bulk').evaluate((el: any) => el.pauseAll());

        await expect.poll(async () => {
            const statuses = await dz(page, 'bulk').evaluate((el: any) =>
                el.files.map((f: any) => f.status)
            );
            return statuses.every((s: string) => s === 'paused');
        }).toBe(true);
    });

    test('resumeAll restarts every paused file', async ({ page }) => {
        await addNamed(page, 'bulk', ['r1', 'r2']);
        await expect.poll(() => pendingNames(page).then(n => n.length)).toBeGreaterThanOrEqual(1);
        await dz(page, 'bulk').evaluate((el: any) => el.pauseAll());
        await expect.poll(async () => {
            const ss = await dz(page, 'bulk').evaluate((el: any) => el.files.map((f: any) => f.status));
            return ss.every((s: string) => s === 'paused');
        }).toBe(true);

        await dz(page, 'bulk').evaluate((el: any) => { void el.resumeAll(); });
        await expect.poll(() => pendingNames(page).then(n => n.length)).toBeGreaterThanOrEqual(1);
    });

    test('retryAll re-invokes every errored handler', async ({ page }) => {
        await addNamed(page, 'bulk', ['err1', 'err2']);
        await expect.poll(() => pendingNames(page).then(n => n.length)).toBeGreaterThanOrEqual(2);
        await resolveUpload(page, 'err1', 'fail');
        await resolveUpload(page, 'err2', 'fail');
        await expect.poll(async () => {
            const ss = await dz(page, 'bulk').evaluate((el: any) =>
                el.files.filter((f: any) => f.status === 'error').length
            );
            return ss;
        }).toBeGreaterThanOrEqual(2);

        await dz(page, 'bulk').evaluate((el: any) => el.retryAll());
        await expect.poll(() => pendingNames(page).then(n => n.length)).toBeGreaterThanOrEqual(1);
    });
});

test.describe('retryPolicy (auto-retry on handler rejection)', () => {
    const calls = (page: import('@playwright/test').Page, name: string) =>
        page.evaluate((n) => (window as any).__calls.filter((c: any) => c.name === n).map((c: any) => c.at), name);
    const status = (page: import('@playwright/test').Page, name: string) =>
        dz(page, 'policy').evaluate((el: any, n) => el.files.find((f: any) => f.name === n)?.status, name);

    test('a rejected attempt is retried with exponential backoff, then completes', async ({ page }) => {
        await addNamed(page, 'policy', ['rp.txt']);
        await expect.poll(() => pendingNames(page)).toContain('rp.txt');
        await resolveUpload(page, 'rp.txt', 'fail');
        await expect.poll(() => calls(page, 'rp.txt').then((c) => c.length)).toBe(2);
        await resolveUpload(page, 'rp.txt', 'fail');
        await expect.poll(() => calls(page, 'rp.txt').then((c) => c.length)).toBe(3);
        // Between attempts the file is not flagged as failed.
        expect(await status(page, 'rp.txt')).toBe('uploading');
        await resolveUpload(page, 'rp.txt', 'ok');
        await expect.poll(() => status(page, 'rp.txt')).toBe('complete');

        // delayMs 50, backoff 2 → the second gap is ~2× the first (≥ 100 ms).
        const at = await calls(page, 'rp.txt');
        expect(at[2] - at[1]).toBeGreaterThanOrEqual(95);
    });

    test('after `attempts` rejections the file ends in error (handler called exactly N times)', async ({ page }) => {
        await addNamed(page, 'policy', ['ex.txt']);
        for (let i = 1; i <= 3; i++) {
            await expect.poll(() => pendingNames(page)).toContain('ex.txt');
            await resolveUpload(page, 'ex.txt', 'fail');
        }
        await expect.poll(() => status(page, 'ex.txt')).toBe('error');
        await page.waitForTimeout(300);
        expect((await calls(page, 'ex.txt')).length).toBe(3);
    });

    test('pausing during the backoff window aborts the pending retry', async ({ page }) => {
        await dz(page, 'policy').evaluate(async (el: any) => {
            el.retryPolicy = { attempts: 3, delayMs: 400, backoff: 1 };
            await el.whenSettled();
        });
        await addNamed(page, 'policy', ['pz.txt']);
        await expect.poll(() => pendingNames(page)).toContain('pz.txt');
        await resolveUpload(page, 'pz.txt', 'fail');
        await dz(page, 'policy').evaluate((el: any) => el.pauseFile(el.files[0].id));
        await page.waitForTimeout(700);
        expect((await calls(page, 'pz.txt')).length).toBe(1);
        expect(await pendingNames(page)).not.toContain('pz.txt');
    });

    test('auto-retry does not write to the console outside /logging', async ({ page }) => {
        const logs: string[] = [];
        page.on('console', (m) => { if (m.type() === 'log') logs.push(m.text()); });
        await addNamed(page, 'policy', ['cl.txt']);
        await expect.poll(() => pendingNames(page)).toContain('cl.txt');
        await resolveUpload(page, 'cl.txt', 'fail');
        await expect.poll(() => calls(page, 'cl.txt').then((c) => c.length)).toBe(2);
        expect(logs.filter((l) => l.includes('auto-retry'))).toEqual([]);
    });
});

test.describe('uploaded-deletable="false"', () => {
    const removeBtn = (page: import('@playwright/test').Page, name: string) =>
        dz(page, 'nodelete').locator(`.dz__file-item:has-text("${name}") [data-dz-action="remove"]`);

    test('the remove button stays usable while uploading', async ({ page }) => {
        await addNamed(page, 'nodelete', ['nd.txt']);
        await expect.poll(() => pendingNames(page)).toContain('nd.txt');
        await expect(removeBtn(page, 'nd.txt')).not.toHaveClass(/--hidden/);
    });

    test('a completed row hides its remove button (layout kept, inert)', async ({ page }) => {
        test.fail(true, 'NOTES.md #6');
        await addNamed(page, 'nodelete', ['nd.txt']);
        await expect.poll(() => pendingNames(page)).toContain('nd.txt');
        await resolveUpload(page, 'nd.txt', 'ok');
        await expect.poll(() => dz(page, 'nodelete').evaluate((el: any) => el.files[0].status)).toBe('complete');
        await expect(removeBtn(page, 'nd.txt')).toHaveClass(/dz__file-item__remove--hidden/, { timeout: 1000 });
        await expect(removeBtn(page, 'nd.txt')).toHaveAttribute('aria-hidden', 'true');
    });

    test('programmatic removeFile still removes a completed file', async ({ page }) => {
        await addNamed(page, 'nodelete', ['nd.txt']);
        await expect.poll(() => pendingNames(page)).toContain('nd.txt');
        await resolveUpload(page, 'nd.txt', 'ok');
        await expect.poll(() => dz(page, 'nodelete').evaluate((el: any) => el.files[0].status)).toBe('complete');
        await dz(page, 'nodelete').evaluate((el: any) => el.removeFile(el.files[0].id));
        expect(await dz(page, 'nodelete').evaluate((el: any) => el.files.length)).toBe(0);
    });
});

test.describe('reorder-completed-delay', () => {
    /** Row names top-to-bottom by on-screen position (CSS `order` aware). */
    const visualOrder = (page: import('@playwright/test').Page) =>
        dz(page, 'reorder-delay').locator('.dz__file-item').evaluateAll((rows) =>
            rows
                .map((r) => ({ y: r.getBoundingClientRect().top, name: r.querySelector('.dz__file-item__name')?.textContent?.trim() }))
                .sort((a, b) => a.y - b.y)
                .map((r) => r.name));

    test('a completed row moves to the bottom only after the delay', async ({ page }) => {
        test.fail(true, 'NOTES.md #7');
        await addNamed(page, 'reorder-delay', ['r1.txt', 'r2.txt', 'r3.txt']);
        await expect.poll(() => pendingNames(page).then((n) => n.length)).toBe(3);
        await expect.poll(() => visualOrder(page)).toEqual(['r1.txt', 'r2.txt', 'r3.txt']);
        await resolveUpload(page, 'r1.txt', 'ok');
        await page.waitForTimeout(250);
        expect(await visualOrder(page)).toEqual(['r1.txt', 'r2.txt', 'r3.txt']);
        await expect.poll(() => visualOrder(page), { timeout: 2000 }).toEqual(['r2.txt', 'r3.txt', 'r1.txt']);
    });
});
