import { test, expect, type Page } from './fixtures';

/**
 * Section 11 — drag overlay (overlay-target).
 *
 * Fixture: test/drag-overlay.html. The dropzone is attached to an
 * external element (`#target`) via `overlay-target="target"` (an element
 * id — see NOTES.md #1 for the `"#target"` selector form); when files are
 * dragged over the page the dropzone mounts a full-cover overlay on the
 * target. overlay-enter / overlay-leave / file-add log into `#overlay-log`.
 *
 * Drags are synthetic: `window.__drag(type, target, names)` dispatches a
 * DragEvent whose constructed DataTransfer carries real File objects, so
 * `dataTransfer.types` includes "Files" exactly like an OS drag (Chromium).
 */

const PAGE = '/test/drag-overlay.html';

const drag = (page: Page, type: string, target: string, names?: string[]) =>
    page.evaluate(({ type, target, names }) => (window as any).__drag(type, target, names), { type, target, names });

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__drag === 'function');
    await page.locator('#overlay-dz').evaluate((el: any) => el.whenSettled?.());
});

test.describe('overlay-target', () => {
    test('overlay is NOT mounted at rest', async ({ page }) => {
        await expect(page.locator('.dz__overlay')).toHaveCount(0);
    });

    test('a file dragenter on the document mounts the overlay over the target', async ({ page }) => {
        await drag(page, 'dragenter', 'body');
        const overlay = page.locator('.dz__overlay');
        await expect(overlay).toHaveCount(1);
        // Compare the inline geometry (the WAAPI fade-in scales the box briefly).
        const o = await overlay.evaluate((el: HTMLElement) =>
            [el.style.top, el.style.left, el.style.width, el.style.height].map(parseFloat));
        const r = await page.locator('#target').evaluate((el) => {
            const b = el.getBoundingClientRect();
            return [b.top, b.left, b.width, b.height];
        });
        o.forEach((v, i) => expect(v).toBeCloseTo(r[i], 0));
    });

    test('overlay-enter event fires on dragenter over the overlay', async ({ page }) => {
        await drag(page, 'dragenter', 'body');
        await drag(page, 'dragenter', '.dz__overlay');
        await expect(page.locator('#overlay-log')).toHaveText(/^enter$/m);
        await expect(page.locator('.dz__overlay')).toHaveClass(/dz__overlay--hover/);
    });

    test('the documented selector form overlay-target="#target" also works', async ({ page }) => {
        test.fail(true, 'NOTES.md #1');
        // Fresh element so the selector is read at first build (no update path involved).
        await page.evaluate(async () => {
            document.getElementById('overlay-dz')!.remove();
            const el = document.createElement('web-dropzone') as any;
            el.id = 'sel-dz';
            el.setAttribute('overlay-target', '#target');
            document.body.append(el);
            await el.whenSettled();
        });
        await drag(page, 'dragenter', 'body');
        await expect(page.locator('.dz__overlay')).toHaveCount(1, { timeout: 1000 });
    });
});
