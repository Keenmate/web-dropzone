import { test, expect, dz, addNamed } from './fixtures';

/**
 * Section 6 — programmatic API surface.
 *
 * Fixture: test/api.html. Two dropzones:
 *
 *   - `#api` — vanilla. No upload callback. Covers the pure-state methods:
 *     addFiles, removeFile, clear, getFiles, getFileById, getConfig.
 *
 *   - `#upload` — wired to a synthetic upload handler controlled by
 *     window.__pending pumps. auto-upload="false" so the spec drives the
 *     state machine explicitly via uploadAll(). Covers the lifecycle
 *     methods: pauseFile / resumeFile / cancelFile / retryFile,
 *     pauseAll / resumeAll / retryAll, and the getOverallProgress
 *     aggregate.
 */

const PAGE = '/test/api.html';

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    // The fixture's setup script registers window.__addNamed asynchronously
    // when the module finishes loading. Specs drive everything via
    // page.evaluate, which has no auto-wait for module readiness — so
    // explicitly gate the suite on the helper being present.
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function');
});

test.describe('addFiles / files getter / getFileById', () => {
    test('addFiles populates the queue; controller.getFiles() returns a snapshot copy', async ({ page }) => {
        await addNamed(page, 'api', ['a.txt', 'b.txt']);
        const result = await dz(page, 'api').evaluate((el: any) => {
            const store = el.controller;
            const snap1 = store.getFiles();
            const snap2 = store.getFiles();
            // getFiles always returns a fresh copy — mutating snap1 must
            // not affect what the second call sees.
            snap1.length = 0;
            return { snap2Length: snap2.length, name0: snap2[0].name };
        });
        expect(result.snap2Length).toBe(2);
        expect(result.name0).toBe('a.txt');
    });

    test('the .files getter on the host element mirrors the snapshot', async ({ page }) => {
        await addNamed(page, 'api', ['a.txt', 'b.txt']);
        const names = await dz(page, 'api').evaluate((el: any) =>
            el.files.map((f: any) => f.name)
        );
        expect(names).toEqual(['a.txt', 'b.txt']);
    });

    test('getFileById(id) returns the matching FileState', async ({ page }) => {
        await addNamed(page, 'api', ['only.txt']);
        const found = await dz(page, 'api').evaluate((el: any) => {
            const f = el.files[0];
            const looked = el.getFileById(f.id);
            return looked?.name;
        });
        expect(found).toBe('only.txt');
    });

    test('getFileById(missing) returns null (element + controller)', async ({ page }) => {
        const result = await dz(page, 'api').evaluate((el: any) =>
            [el.getFileById('does-not-exist'), el.controller.getFileById('does-not-exist')]);
        expect(result).toEqual([null, null]);
    });
});

test.describe('removeFile / clear', () => {
    test('removeFile drops the matching FileState from the queue', async ({ page }) => {
        await addNamed(page, 'api', ['a.txt', 'b.txt', 'c.txt']);
        await dz(page, 'api').evaluate((el: any) => {
            const target = el.files.find((f: any) => f.name === 'b.txt');
            return el.removeFile(target.id);
        });
        const remaining = await dz(page, 'api').evaluate((el: any) =>
            el.files.map((f: any) => f.name)
        );
        expect(remaining).toEqual(['a.txt', 'c.txt']);
    });

    test('removeFiles(ids) drops a batch: one file-remove each, ONE change, gate once', async ({ page }) => {
        await addNamed(page, 'api', ['a.txt', 'b.txt', 'c.txt']);
        const out = await dz(page, 'api').evaluate(async (el: any) => {
            const events: string[] = [];
            const gateCalls: string[][] = [];
            el.addEventListener('file-remove', (e: any) => events.push('remove:' + e.detail.file.name));
            el.addEventListener('change', () => events.push('change'));
            el.beforeFilesRemoveCallback = (ctx: any) => { gateCalls.push(ctx.files.map((f: any) => f.name)); };
            const ids = el.files.filter((f: any) => f.name !== 'b.txt').map((f: any) => f.id);
            await el.removeFiles([...ids, 'no-such-id'], { confirm: true });
            el.beforeFilesRemoveCallback = null;
            return { events, gateCalls, remaining: el.files.map((f: any) => f.name) };
        });
        expect(out.remaining).toEqual(['b.txt']);
        expect(out.gateCalls).toEqual([['a.txt', 'c.txt']]);
        expect(out.events).toEqual(['remove:a.txt', 'remove:c.txt', 'change']);
    });

    test('removeFiles is on the controller too; a vetoing gate keeps the whole batch', async ({ page }) => {
        await addNamed(page, 'api', ['a.txt', 'b.txt']);
        const remaining = await dz(page, 'api').evaluate(async (el: any) => {
            el.beforeFilesRemoveCallback = () => false;
            await el.controller.removeFiles(el.files.map((f: any) => f.id), { confirm: true });
            el.beforeFilesRemoveCallback = null;
            return el.files.map((f: any) => f.name);
        });
        expect(remaining).toEqual(['a.txt', 'b.txt']);
    });

    test('clear drains the queue completely', async ({ page }) => {
        await addNamed(page, 'api', ['a.txt', 'b.txt']);
        await dz(page, 'api').evaluate((el: any) => el.clear());
        expect(await dz(page, 'api').evaluate((el: any) => el.files.length)).toBe(0);
    });
});

test.describe('controller.getConfig', () => {
    test('returns the merged config (declared attrs win over DEFAULT_CONFIG)', async ({ page }) => {
        const cfg = await dz(page, 'api').evaluate((el: any) => el.controller.getConfig());
        // `accept` was declared on the element
        expect(cfg.accept).toBe('*/*');
        expect(cfg.maxFileCount).toBe(10);
        // Default config fields stay reachable
        expect(cfg.icon).toBeTruthy();
    });
});

test.describe('controller (web-component element)', () => {
    test('exposes the underlying DropzoneController on the host element', async ({ page }) => {
        const sig = await dz(page, 'api').evaluate((el: any) => {
            const store = el.controller;
            if (!store) return null;
            return {
                hasGetFiles: typeof store.getFiles === 'function',
                hasAddFiles: typeof store.addFiles === 'function',
                hasPauseAll: typeof store.pauseAll === 'function',
                hasGetOverallProgress: typeof store.getOverallProgress === 'function'
            };
        });
        expect(sig).toEqual({
            hasGetFiles: true,
            hasAddFiles: true,
            hasPauseAll: true,
            hasGetOverallProgress: true
        });
    });
});

test.describe('upload lifecycle (uploadFileCallback wired)', () => {
    test('uploadAll starts each file; resolving its pump completes it', async ({ page }) => {
        await addNamed(page, 'upload', ['x.txt']);
        // uploadAll returns a Promise that doesn't resolve until every
        // file completes — we deliberately don't await it here; the test
        // resolves the synthetic pump below to drive the lifecycle.
        await dz(page, 'upload').evaluate((el: any) => { void el.uploadAll(); });

        await expect.poll(
            () => dz(page, 'upload').evaluate((el: any) => el.files[0].status)
        ).toBe('uploading');

        await page.evaluate(() => (window as any).__resolveUpload('x.txt', 'ok'));

        await expect.poll(
            () => dz(page, 'upload').evaluate((el: any) => el.files[0].status)
        ).toBe('complete');
    });

    test('pauseFile aborts the in-flight handler; status flips to paused', async ({ page }) => {
        await addNamed(page, 'upload', ['p.txt']);
        await dz(page, 'upload').evaluate((el: any) => { void el.uploadAll(); });
        await expect.poll(
            () => dz(page, 'upload').evaluate((el: any) => el.files[0].status)
        ).toBe('uploading');
        await dz(page, 'upload').evaluate((el: any) => {
            const f = el.files[0];
            return el.pauseFile(f.id);
        });
        await expect.poll(
            () => dz(page, 'upload').evaluate((el: any) => el.files[0].status)
        ).toBe('paused');
    });

    test('cancelFile aborts the handler; status flips to cancelled', async ({ page }) => {
        await addNamed(page, 'upload', ['c.txt']);
        await dz(page, 'upload').evaluate((el: any) => { void el.uploadAll(); });
        await expect.poll(
            () => dz(page, 'upload').evaluate((el: any) => el.files[0].status)
        ).toBe('uploading');
        await dz(page, 'upload').evaluate((el: any) => {
            const f = el.files[0];
            return el.cancelFile(f.id);
        });
        await expect.poll(
            () => dz(page, 'upload').evaluate((el: any) => el.files[0].status)
        ).toBe('cancelled');
    });
});

test.describe('controller.getOverallProgress aggregate', () => {
    test('returns a byte-weighted percent + per-status counts', async ({ page }) => {
        await addNamed(page, 'upload', ['a.txt', 'b.txt']);
        const agg = await dz(page, 'upload').evaluate((el: any) => el.controller.getOverallProgress());
        expect(agg).toEqual(
            expect.objectContaining({
                uploadedBytes: expect.any(Number),
                totalBytes: expect.any(Number),
                completedCount: expect.any(Number),
                percent: expect.any(Number)
            })
        );
        expect(agg.completedCount).toBe(0); // nothing started yet
        expect(agg.totalBytes).toBeGreaterThan(0);
    });
});

test.describe('uploadFile(id) / destroy()', () => {
    const pendingIds = (page: import('@playwright/test').Page) =>
        page.evaluate(() => Array.from((window as any).__pending.keys()));

    test('uploadFile(id) starts that file immediately, bypassing the concurrency cap (1)', async ({ page }) => {
        await addNamed(page, 'upload', ['q1.txt', 'q2.txt']);
        await dz(page, 'upload').evaluate((el: any) => { void el.uploadAll(); });
        await expect.poll(() => pendingIds(page)).toEqual(['q1.txt']); // concurrency 1 → q2 waits
        await dz(page, 'upload').evaluate((el: any) => { void el.uploadFile(el.files[1].id); });
        await expect.poll(() => pendingIds(page)).toEqual(['q1.txt', 'q2.txt']);
        // A second call for a file already in flight is a no-op (no duplicate handler run).
        await dz(page, 'upload').evaluate((el: any) => { void el.uploadFile(el.files[1].id); });
        await page.waitForTimeout(100);
        expect(await pendingIds(page)).toEqual(['q1.txt', 'q2.txt']);
    });

    test('destroy() aborts in-flight uploads and tears the UI down', async ({ page }) => {
        await addNamed(page, 'upload', ['d.txt']);
        await dz(page, 'upload').evaluate((el: any) => { void el.uploadAll(); });
        await expect.poll(() => pendingIds(page)).toEqual(['d.txt']);
        await dz(page, 'upload').evaluate((el: any) => el.destroy());
        // The handler saw its AbortSignal fire (the fixture drops aborted pumps).
        await expect.poll(() => pendingIds(page)).toEqual([]);
        await expect(dz(page, 'upload').locator('.dz__file-item')).toHaveCount(0);
        await expect(dz(page, 'upload').locator('.dz__dropzone')).toHaveCount(0);
    });
});

test.describe('hasActiveUploads / warn-before-unload', () => {
    const beforeUnloadPrevented = (page: any) => page.evaluate(() => {
        const e = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
    });

    test('true while a file is pending; false once none is active (element + controller)', async ({ page }) => {
        const read = () => dz(page, 'upload').evaluate((el: any) => [el.hasActiveUploads, el.controller.hasActiveUploads]);
        expect(await read()).toEqual([false, false]);
        await addNamed(page, 'upload', ['x.txt']);
        expect(await read()).toEqual([true, true]);
        await dz(page, 'upload').evaluate((el: any) => el.setFileStatus(el.files[0].id, 'complete'));
        expect(await read()).toEqual([false, false]);
    });

    test('warn-before-unload prompts only while uploads are active; off by default', async ({ page }) => {
        await addNamed(page, 'upload', ['x.txt']);
        expect(await beforeUnloadPrevented(page)).toBe(false);
        await dz(page, 'upload').evaluate((el: any) => el.setAttribute('warn-before-unload', ''));
        expect(await dz(page, 'upload').evaluate((el: any) => el.shouldWarnBeforeUnload)).toBe(true);
        expect(await beforeUnloadPrevented(page)).toBe(true);
        await dz(page, 'upload').evaluate((el: any) => el.setFileStatus(el.files[0].id, 'complete'));
        expect(await beforeUnloadPrevented(page)).toBe(false);
    });

    test('a detached / destroyed element no longer prompts', async ({ page }) => {
        await addNamed(page, 'upload', ['x.txt']);
        await dz(page, 'upload').evaluate((el: any) => { el.shouldWarnBeforeUnload = true; el.destroy(); });
        expect(await beforeUnloadPrevented(page)).toBe(false);
    });
});
