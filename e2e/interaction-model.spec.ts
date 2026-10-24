import { test, expect, type Page } from '@playwright/test';

/**
 * The KeenMate interaction model (web-components-core SPEC §12.5):
 *   - events are present-tense kebab names, bubble, and are NOT composed
 *   - each `<web-dropzone>` event has a camelCase `on*` twin that receives the
 *     SAME detail object, before the DOM event fires
 *   - every detail / callback ctx carries `controller` (=== `el.controller`)
 *     and `element` (the host), non-enumerable (JSON / Object.keys see data only)
 *   - every callback takes ONE ctx; `before*Callback` → `false` cancels, a
 *     replacement value continues with it (`beforeFilesAddCallback` → File[])
 *   - `el.controller` is the public facade (replaces `getStore()`)
 *   - satellite events (`summary-activate`, `queue-open`) carry the store's
 *     controller / element
 *
 * Fixture: test/interaction-model.html.
 */

const PAGE = '/test/interaction-model.html';

const logOf = (page: Page) => page.evaluate(() => (window as any).__log as string[]);
const checksOf = (page: Page) => page.evaluate(() => (window as any).__checks as Array<{
    label: string; hasController: boolean; hasElement: boolean; keys: string; json: string;
}>);
const checkOf = async (page: Page, label: string) => {
    const all = await checksOf(page);
    const found = all.find(c => c.label === label);
    expect(found, `no ctx/detail recorded for "${label}"`).toBeTruthy();
    return found!;
};
const addNamed = (page: Page, id: string, names: string[]) =>
    page.evaluate(({ id, names }) => (window as any).__addNamed(id, names), { id, names });

/** ctx / detail carries controller + element, and they are non-enumerable. */
async function expectContext(page: Page, label: string): Promise<void> {
    const c = await checkOf(page, label);
    expect(c.hasController, `${label}: controller === el.controller`).toBe(true);
    expect(c.hasElement, `${label}: element === host`).toBe(true);
    expect(c.keys.split(','), `${label}: controller / element non-enumerable`).not.toContain('controller');
    expect(c.keys.split(',')).not.toContain('element');
    expect(c.json).not.toContain('"controller"');
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (document.getElementById('events') as any)?.controller?.isReady);
    await page.evaluate(() => { (window as any).__log = []; (window as any).__checks = []; });
});

test.describe('events + on* twins', () => {
    test('present-tense names, twin before event, same detail, not composed, still bubbles', async ({ page }) => {
        await addNamed(page, 'events', ['a.txt']);
        await expect.poll(async () => (await logOf(page)).includes('event:files-change')).toBe(true);
        const log = await logOf(page);

        for (const name of ['file-add', 'change', 'files-change']) {
            expect(log).toContain(`twin:${name}`);
            expect(log).toContain(`event:${name}`);
            expect(log.indexOf(`twin:${name}`)).toBeLessThan(log.indexOf(`event:${name}`));
        }
        expect(log.filter(l => l.startsWith('composed:'))).toEqual([]);
        expect(log.filter(l => l.startsWith('OLD:'))).toEqual([]);
        expect(log).toContain('document:file-add');
        expect(await page.evaluate(() => (window as any).__sameDetail['file-add'])).toBe(true);

        await expectContext(page, 'twin:file-add');
        await expectContext(page, 'twin:change');
        const change = await checkOf(page, 'twin:change');
        expect(JSON.parse(change.json).files).toHaveLength(1);
    });

    test('file-remove / files-reject / file-retry / file-status-change carry the context', async ({ page }) => {
        await addNamed(page, 'events', ['a.txt']);
        await page.evaluate(() => {
            const el = document.getElementById('events') as any;
            const id = el.controller.getFiles()[0].id;
            el.controller.setFileStatus(id, 'error', 'boom');
            el.controller.retryFile(id);
            return el.controller.removeFile(id);
        });
        const log = await logOf(page);
        for (const name of ['file-status-change', 'file-retry', 'file-remove']) {
            expect(log).toContain(`twin:${name}`);
            await expectContext(page, `twin:${name}`);
        }
        // Rejection: maxFileCount 1 → the second file is rejected with code "count".
        await page.evaluate(() => { (document.getElementById('events') as any).maxFileCount = 1; });
        await addNamed(page, 'events', ['x.txt', 'y.txt']);
        await expect.poll(async () => (await logOf(page)).includes('twin:files-reject')).toBe(true);
        await expectContext(page, 'twin:files-reject');
        expect(JSON.parse((await checkOf(page, 'twin:files-reject')).json).rejectedFiles[0].validation.code).toBe('count');
    });

    test('ready fires on build with the context; data-ready + controller.isReady follow', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const el = document.createElement('web-dropzone') as any;
            const seen: string[] = [];
            el.onReady = (d: any) => seen.push(`twin:${d.controller === el.controller && d.element === el}`);
            el.addEventListener('ready', (e: any) => seen.push(`event:${e.composed}`));
            const before = el.controller.isReady;
            document.body.appendChild(el);
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            const out = { seen, before, after: el.controller.isReady, dataReady: el.hasAttribute('data-ready') };
            el.remove();
            return out;
        });
        expect(result.seen).toEqual(['twin:true', 'event:false']);
        expect(result.before).toBe(false);
        expect(result.after).toBe(true);
        expect(result.dataReady).toBe(true);
    });
});

test.describe('el.controller (replaces getStore)', () => {
    test('is the public facade — stable across a store rebuild; no engine exposed', async ({ page }) => {
        const r = await page.evaluate(async () => {
            const el = document.getElementById('events') as any;
            const c1 = el.controller;
            const methods = ['addFiles', 'removeFile', 'clear', 'getFiles', 'getFile', 'getConfig', 'getOverallProgress',
                'updateFileProgress', 'setFileStatus', 'uploadAll', 'uploadFile', 'pauseFile', 'resumeFile',
                'cancelFile', 'retryFile', 'pauseAll', 'resumeAll', 'retryAll'].every(m => typeof c1[m] === 'function');
            // A mode flip rebuilds the store; the same controller reaches the new one.
            el.setAttribute('mode', 'structural');
            await el.whenSettled();
            await c1.addFiles([new File(['x'], 'after-rebuild.txt')]);
            return {
                methods,
                same: el.controller === c1,
                files: c1.getFiles().map((f: any) => f.name),
                getStore: typeof el.getStore,
                engine: 'engine' in el || 'store' in el
            };
        });
        expect(r.methods).toBe(true);
        expect(r.same).toBe(true);
        expect(r.files).toEqual(['after-rebuild.txt']);
        expect(r.getStore).toBe('undefined');
        expect(r.engine).toBe(false);
    });
});

test.describe('beforeFilesAddCallback({ files, existingFiles })', () => {
    test('false cancels → files-reject with code "cancelled"', async ({ page }) => {
        await page.evaluate(() => { (window as any).__addMode = 'cancel'; });
        await addNamed(page, 'add-gate', ['a.txt']);
        const log = await logOf(page);
        expect(log).toContain('beforeFilesAdd files=a.txt existing=0');
        expect(log).toContain('reject:cancelled:a.txt');
        expect(await page.evaluate(() => (document.getElementById('add-gate') as any).files.length)).toBe(0);
        await expectContext(page, 'beforeFilesAdd');
    });

    test('a File[] replaces the batch (async)', async ({ page }) => {
        await page.evaluate(() => { (window as any).__addMode = 'replace'; });
        await addNamed(page, 'add-gate', ['a.txt', 'b.txt']);
        const names = await page.evaluate(() => (document.getElementById('add-gate') as any).files.map((f: any) => f.name));
        expect(names).toEqual(['renamed-a.txt', 'renamed-b.txt']);
    });

    test('nothing returned → continues unchanged', async ({ page }) => {
        await addNamed(page, 'add-gate', ['c.txt']);
        const names = await page.evaluate(() => (document.getElementById('add-gate') as any).files.map((f: any) => f.name));
        expect(names).toEqual(['c.txt']);
    });
});

test.describe('beforeFilesRemoveCallback / validateCallback / getFileIconCallback / getCustomStylesCallback', () => {
    test('row ✕ (data-dz-action="remove") runs the remove gate; false cancels', async ({ page }) => {
        await addNamed(page, 'callbacks', ['keep.txt']);
        const remove = page.locator('#callbacks [data-dz-action="remove"]').first();
        await remove.click();
        expect(await logOf(page)).toContain('beforeFilesRemove files=keep.txt all=1');
        expect(await page.evaluate(() => (document.getElementById('callbacks') as any).files.length)).toBe(1);
        await expectContext(page, 'beforeFilesRemove');

        await page.evaluate(() => { (window as any).__allowRemove = true; });
        await remove.click();
        await expect.poll(() => page.evaluate(() => (document.getElementById('callbacks') as any).files.length)).toBe(0);
    });

    test('validateCallback({ file, existingFiles }) rejects with code "custom"', async ({ page }) => {
        await addNamed(page, 'callbacks', ['bad.txt', 'good.txt']);
        const names = await page.evaluate(() => (document.getElementById('callbacks') as any).files.map((f: any) => f.name));
        expect(names).toEqual(['good.txt']);
        await expectContext(page, 'validate');
        expect(JSON.parse((await checkOf(page, 'validate')).json).existingFiles).toEqual([]);
    });

    test('getFileIconCallback({ file }) renders the returned icon', async ({ page }) => {
        await addNamed(page, 'callbacks', ['pic.star']);
        await expect(page.locator('#callbacks .im-star').first()).toBeVisible();
        await expectContext(page, 'getFileIcon');
    });

    test('getCustomStylesCallback(ctx) injects the returned CSS', async ({ page }) => {
        // The fixture's callback ran at setup (before the log reset) — re-run it.
        await page.evaluate(() => {
            const el = document.getElementById('callbacks') as any;
            const cb = el.getCustomStylesCallback;
            el.getCustomStylesCallback = (ctx: unknown) => cb(ctx);
            return el.whenSettled();
        });
        const outline = await page.locator('#callbacks').evaluate((el: any) =>
            getComputedStyle(el.shadowRoot.querySelector('.dz__host')).outlineColor);
        expect(outline).toBe('rgb(1, 2, 3)');
        await expectContext(page, 'getCustomStyles');
    });
});

test.describe('uploadFileCallback(ctx)', () => {
    test('one ctx: file, signal, setProgress, resume state; file-upload-complete twin', async ({ page }) => {
        await addNamed(page, 'upload', ['up.txt']);
        await expect.poll(async () => (await logOf(page)).some(l => l.startsWith('upload up.txt'))).toBe(true);
        expect(await logOf(page)).toContain('upload up.txt startBytes=0 startPercent=0 signal=true');
        await expectContext(page, 'uploadFile');

        await page.evaluate(() => (window as any).__progress('up.txt', 40));
        expect(await page.evaluate(() => (document.getElementById('upload') as any).files[0].progress)).toBe(40);

        await page.evaluate(() => (window as any).__finish('up.txt'));
        await expect.poll(async () => (await logOf(page)).includes('complete up.txt meta=42')).toBe(true);
        await expectContext(page, 'twin:file-upload-complete');
    });
});

test.describe('structural render callbacks', () => {
    test('renderPromptCallback / renderFileItemCallback get one ctx', async ({ page }) => {
        await expect(page.locator('#structural .im-prompt')).toHaveText('Custom prompt');
        // The prompt rendered before the log reset — a config change re-renders it.
        await page.evaluate(() => {
            const el = document.getElementById('structural') as any;
            el.hintText = 'x';
            return el.whenSettled();
        });
        await expectContext(page, 'renderPrompt');
        await addNamed(page, 'structural', ['s.txt']);
        await expect(page.locator('#structural .im-row')).toHaveText('0:s.txt:list:false');
        await expectContext(page, 'renderFileItem');
    });

    test('file-row-update: typed detail with context, bubbles on the row, not composed', async ({ page }) => {
        await addNamed(page, 'structural', ['r.txt']);
        await page.evaluate(() => {
            const el = document.getElementById('structural') as any;
            el.controller.updateFileProgress(el.controller.getFiles()[0].id, 30);
        });
        const log = await logOf(page);
        expect(log).toContain('row-update r.txt composed=false');
        expect(log).not.toContain('HOST:file-row-update');
        await expectContext(page, 'file-row-update');
    });

    test('renderRollingBodyCallback is a settable element input; args carry controller', async ({ page }) => {
        await addNamed(page, 'rolling', ['r1.txt', 'r2.txt']);
        await expect(page.locator('#rolling .im-rolling')).toHaveText('2 files · function');
        await expectContext(page, 'renderRollingBody');
    });

    test('renderSummaryCallback({ files }) + loadStateCallback({ key })', async ({ page }) => {
        await addNamed(page, 'compact', ['c1.txt', 'c2.txt']);
        await expect(page.locator('#compact .im-summary')).toHaveText('2 staged');
        await expectContext(page, 'renderSummary');
        await page.locator('#compact .im-summary').click();
        await expect.poll(async () => (await logOf(page)).includes('loadState key=im-compact')).toBe(true);
        await expectContext(page, 'loadState');
    });
});

test.describe('satellites', () => {
    test('picker uploadFileCallback(ctx) carries the store context', async ({ page }) => {
        await page.locator('#sat-picker input[type="file"]').setInputFiles({
            name: 'picked.txt', mimeType: 'text/plain', buffer: Buffer.from('hello')
        });
        await expect.poll(async () => (await logOf(page)).includes('picker-upload picked.txt')).toBe(true);
        await expectContext(page, 'picker uploadFile');
    });

    test('a for= satellite keeps working after the store rebuilds (it holds the controller, not the engine)', async ({ page }) => {
        await page.evaluate(async () => {
            const store = document.getElementById('sat-store') as any;
            store.setAttribute('mode', 'structural');   // headless → structural: a full rebuild
            await store.whenSettled();
        });
        await addNamed(page, 'sat-store', ['after-1.txt', 'after-2.txt']);
        await expect(page.locator('#sat-summary .dz__summary__text')).toContainText('2');
    });

    test('summary-activate / queue-open: not composed, carry the store controller / element', async ({ page }) => {
        await addNamed(page, 'sat-store', ['q1.txt', 'q2.txt']);
        await page.locator('#sat-summary .dz__summary__line').click();
        await page.locator('#sat-rolling .dz__rolling__queue').click();
        const log = await logOf(page);
        expect(log).toContain('sat-summary:summary-activate composed=false');
        expect(log).toContain('sat-rolling:queue-open composed=false');
        await expectContext(page, 'sat-summary:summary-activate');
        await expectContext(page, 'sat-rolling:queue-open');
        // Satellites expose the bound store's controller.
        expect(await page.evaluate(() =>
            (document.getElementById('sat-summary') as any).controller === (document.getElementById('sat-store') as any).controller
        )).toBe(true);
    });
});
