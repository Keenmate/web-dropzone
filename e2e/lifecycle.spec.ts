import { test, expect, dz, addNamed, pendingNames, resolveUpload, dragFiles, logLines, type Page } from './fixtures';

/**
 * Lifecycle — a DOM move (re-parent / reorder) is `disconnect()` → `connect()`
 * in core's build-once + activate/deactivate model. Decision D1 (2026-10-24):
 * a move must KEEP the files and in-flight uploads, and must not rebuild
 * (`ready` fires once). Fixed — NOTES.md #4.
 *
 * Fixture: test/lifecycle.html — `#lc` (pump, auto-upload="false"; the spec
 * calls uploadFile to start an upload), `#lc-ov` (overlay-target).
 * `window.__move(id, toId)` re-parents in one operation.
 */

const PAGE = '/test/lifecycle.html';

const move = (page: Page, id: string, to: string) =>
    page.evaluate(({ id, to }) => (window as any).__move(id, to), { id, to });
const files = (page: Page) =>
    dz(page, 'lc').evaluate((el: any) => el.files.map((f: any) => `${f.name}:${f.status}`));

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test.describe('re-parent keeps state (D1)', () => {
    test('queued files survive a move', async ({ page }) => {
        await addNamed(page, 'lc', ['a.txt', 'b.txt']);
        await move(page, 'lc', 'slot-b');
        await page.waitForTimeout(100);
        expect(await files(page)).toEqual(['a.txt:pending', 'b.txt:pending']);
        await expect(dz(page, 'lc').locator('.dz__file-item')).toHaveCount(2);
    });

    test('an in-flight upload survives a move and completes', async ({ page }) => {
        await addNamed(page, 'lc', ['up.txt']);
        await dz(page, 'lc').evaluate((el: any) => { void el.uploadFile(el.files[0].id); });
        await expect.poll(() => pendingNames(page)).toEqual(['up.txt']);
        await move(page, 'lc', 'slot-b');
        await page.waitForTimeout(100);
        // Not aborted: the handler's promise is still parked.
        expect(await pendingNames(page)).toEqual(['up.txt']);
        await resolveUpload(page, 'up.txt');
        await expect.poll(() => files(page)).toEqual(['up.txt:complete']);
    });

    test('a move does not rebuild — `ready` fires once', async ({ page }) => {
        await expect.poll(() => logLines(page, 'lc')).toEqual(['ready:']);
        await move(page, 'lc', 'slot-b');
        await move(page, 'lc', 'slot-a');
        await page.waitForTimeout(100);
        expect(await logLines(page, 'lc')).toEqual(['ready:']);
    });
});

test.describe('re-parent keeps the popover (D1)', () => {
    const popover = (page: Page) => dz(page, 'lc-pop').locator('.dz__popover');

    test('an open popover stays open across a move and still closes on Escape / outside click', async ({ page }) => {
        await addNamed(page, 'lc-pop', ['p1.txt', 'p2.txt']);
        await dz(page, 'lc-pop').locator('.dz__summary__line').click();
        await expect(popover(page)).toBeVisible();

        await move(page, 'lc-pop', 'pop-away');
        await expect(page.locator('#pop-away #lc-pop')).toHaveCount(1);
        await expect(popover(page)).toBeVisible();
        await expect(popover(page).locator('.dz__popover__count')).toHaveText('2 files');

        await page.keyboard.press('Escape');
        await expect(popover(page)).toHaveCount(0);

        await dz(page, 'lc-pop').locator('.dz__summary__line').click();
        await expect(popover(page)).toBeVisible();
        await move(page, 'lc-pop', 'pop-home');
        await page.locator('h1').click();
        await expect(popover(page)).toHaveCount(0);
    });

    test('a detached dropzone stops listening — Escape while removed does not close its popover', async ({ page }) => {
        await addNamed(page, 'lc-pop', ['p1.txt']);
        await dz(page, 'lc-pop').locator('.dz__summary__line').click();
        await expect(popover(page)).toBeVisible();
        const isOpenAfter = await page.evaluate(() => {
            const el = document.getElementById('lc-pop')!;
            const parent = el.parentElement!;
            el.remove();
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            parent.append(el);
            return !!el.shadowRoot!.querySelector('.dz__popover');
        });
        expect(isOpenAfter).toBe(true);
    });
});

test.describe('re-parent keeps the element working', () => {
    test('after a move the picker accepts drops and the controller is live', async ({ page }) => {
        await move(page, 'lc', 'slot-b');
        await expect(page.locator('#slot-b #lc')).toHaveCount(1);
        await dragFiles(dz(page, 'lc').locator('.dz__dropzone'), 'drop', ['after.txt']);
        await expect.poll(() => files(page)).toEqual(['after.txt:pending']);
        expect(await dz(page, 'lc').evaluate((el: any) => el.controller.getFiles().length)).toBe(1);
    });

    test('a moved overlay dropzone mounts exactly one overlay (document listeners not duplicated)', async ({ page }) => {
        await move(page, 'lc-ov', 'ov-away');
        await move(page, 'lc-ov', 'ov-home');
        await dragFiles(page.locator('body'), 'dragenter');
        await expect(page.locator('.dz__overlay')).toHaveCount(1);
        await page.waitForTimeout(100);
        await expect(page.locator('.dz__overlay')).toHaveCount(1);
    });

    test('a removed (not re-inserted) overlay dropzone stops reacting to drags', async ({ page }) => {
        await page.locator('#lc-ov').evaluate((el) => el.remove());
        await dragFiles(page.locator('body'), 'dragenter');
        await page.waitForTimeout(100);
        await expect(page.locator('.dz__overlay')).toHaveCount(0);
    });
});

test.describe('core lifecycle — defer / release / destroy', () => {
    test('defer holds the first build until release(); ready fires once, then', async ({ page }) => {
        const held = await page.evaluate(async () => {
            const el = document.createElement('web-dropzone') as any;
            el.id = 'deferred';
            el.setAttribute('defer', '');
            el.setAttribute('display-mode', 'list');
            (window as any).__deferReady = 0;
            el.addEventListener('ready', () => { (window as any).__deferReady++; });
            document.getElementById('slot-b')!.append(el);
            await new Promise(r => setTimeout(r, 30));
            return { ready: (window as any).__deferReady, isReady: el.isReady, isLive: el.controller.isReady };
        });
        expect(held).toEqual({ ready: 0, isReady: false, isLive: false });
        await expect(dz(page, 'deferred').locator('.dz__dropzone')).toHaveCount(0);
        const released = await dz(page, 'deferred').evaluate(async (el: any) => {
            el.release();
            await el.whenReady();
            return { ready: (window as any).__deferReady, isReady: el.isReady, isLive: el.controller.isReady, attr: el.hasAttribute('ready') };
        });
        expect(released).toEqual({ ready: 1, isReady: true, isLive: true, attr: true });
        await expect(dz(page, 'deferred').locator('.dz__dropzone')).toHaveCount(1);
    });

    test('destroy() makes the element inert — re-inserting it builds nothing', async ({ page }) => {
        await addNamed(page, 'lc', ['a.txt']);
        const out = await dz(page, 'lc').evaluate(async (el: any) => {
            el.destroy();
            const parent = el.parentElement;
            el.remove();
            parent.append(el);
            await new Promise(r => setTimeout(r, 30));
            return { isDestroyed: el.isDestroyed, files: el.files.length, isLive: el.controller.isReady, rows: el.shadowRoot.querySelectorAll('.dz__file-item').length };
        });
        expect(out).toEqual({ isDestroyed: true, files: 0, isLive: false, rows: 0 });
    });
});
