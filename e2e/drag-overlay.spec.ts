import { test, expect, dragFiles, logLines, type Page } from './fixtures';

/**
 * Section 8 — drag overlay (overlay-target).
 *
 * Fixture: test/drag-overlay.html. `#overlay-dz` is attached to the external
 * `#target` via `overlay-target="target"` (an element id — the documented
 * `"#target"` selector form is NOTES.md #1). A file drag anywhere on the page
 * mounts a fixed overlay (light DOM, appended to <body>) over the target;
 * overlay-enter / overlay-leave / file-add log into `overlay-log`.
 *
 * Drags are synthetic (`dragFiles`): a constructed DataTransfer carrying real
 * File objects reports `types` including "Files" in Chromium.
 */

const PAGE = '/test/drag-overlay.html';

const overlay = (page: Page) => page.locator('.dz__overlay');

/** The overlay whose inline geometry sits over `#<targetId>`. */
async function overlayIndexFor(page: Page, targetId: string): Promise<number> {
    return page.evaluate((targetId) => {
        const t = document.getElementById(targetId)!.getBoundingClientRect();
        const all = Array.from(document.querySelectorAll<HTMLElement>('.dz__overlay'));
        return all.findIndex((o) => Math.abs(parseFloat(o.style.top) - t.top) < 1);
    }, targetId);
}

/**
 * Keep the drag "alive": a real OS drag pulses `dragover` every ~250 ms and
 * the overlay tears itself down after ~350 ms of silence. Pulsing a page-side
 * interval keeps the overlay mounted independently of test timing.
 */
async function startPulse(page: Page): Promise<void> {
    await page.evaluate(() => {
        const dt = new DataTransfer();
        dt.items.add(new File(['x'], 'pulse.txt', { type: 'text/plain' }));
        (window as any).__pulse = setInterval(() => {
            document.body.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
        }, 100);
    });
}
const stopPulse = (page: Page) => page.evaluate(() => clearInterval((window as any).__pulse));

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__wire === 'function');
    await page.locator('#overlay-dz').evaluate((el: any) => el.whenSettled());
});

test.describe('overlay lifecycle', () => {
    test('overlay is NOT mounted at rest', async ({ page }) => {
        await expect(overlay(page)).toHaveCount(0);
    });

    test('a file dragenter on the document mounts the overlay over the target', async ({ page }) => {
        await dragFiles(page.locator('body'), 'dragenter');
        await expect(overlay(page)).toHaveCount(1);
        // Compare the inline geometry (the WAAPI fade-in scales the box briefly).
        const o = await overlay(page).evaluate((el: HTMLElement) =>
            [el.style.top, el.style.left, el.style.width, el.style.height].map(parseFloat));
        const r = await page.locator('#target').evaluate((el) => {
            const b = el.getBoundingClientRect();
            return [b.top, b.left, b.width, b.height];
        });
        o.forEach((v, i) => expect(v).toBeCloseTo(r[i], 0));
    });

    test('a drag without files (e.g. text) does not mount the overlay', async ({ page }) => {
        await page.evaluate(() => {
            const dt = new DataTransfer();
            dt.setData('text/plain', 'hello');
            document.body.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
        });
        await page.waitForTimeout(100);
        await expect(overlay(page)).toHaveCount(0);
    });

    test('overlay-enter fires on dragenter over the overlay; overlay-leave when the drag leaves it', async ({ page }) => {
        await startPulse(page);
        await dragFiles(page.locator('body'), 'dragenter');
        await dragFiles(overlay(page), 'dragenter');
        await expect(overlay(page)).toHaveClass(/dz__overlay--hover/);
        await dragFiles(overlay(page), 'dragleave');
        await expect.poll(() => logLines(page, 'overlay')).toEqual(['overlay-enter:', 'overlay-leave:']);
        await expect(overlay(page)).not.toHaveClass(/dz__overlay--hover/);
    });

    test('dropping files on the overlay adds them and removes the overlay', async ({ page }) => {
        await startPulse(page);
        await dragFiles(page.locator('body'), 'dragenter');
        await dragFiles(overlay(page), 'dragenter');
        await dragFiles(overlay(page), 'drop', ['a.txt', 'b.txt']);
        await expect(overlay(page)).toHaveCount(0);
        await expect.poll(() => page.locator('#overlay-dz').evaluate((el: any) => el.files.map((f: any) => f.name)))
            .toEqual(['a.txt', 'b.txt']);
        expect(await logLines(page, 'overlay')).toEqual(expect.arrayContaining(['file-add:a.txt', 'file-add:b.txt']));
    });

    test('Escape closes the overlay', async ({ page }) => {
        await startPulse(page);
        await dragFiles(page.locator('body'), 'dragenter');
        await expect(overlay(page)).toHaveCount(1);
        await page.waitForTimeout(500); // past the heartbeat window — still mounted
        await expect(overlay(page)).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect(overlay(page)).toHaveCount(0);
    });

    test('the overlay closes on its own once dragover pulses stop (drag cancelled outside the page)', async ({ page }) => {
        await startPulse(page);
        await dragFiles(page.locator('body'), 'dragenter');
        await page.waitForTimeout(500);
        await expect(overlay(page)).toHaveCount(1);
        await stopPulse(page);
        // No further dragover → the ~350 ms heartbeat tears it down.
        await expect(overlay(page)).toHaveCount(0, { timeout: 2000 });
    });
});

test.describe('two overlays on one page', () => {
    test('a drop on one overlay adds only to its own dropzone, and both overlays close', async ({ page }) => {
        await page.evaluate(async () => {
            const el = document.createElement('web-dropzone') as any;
            el.id = 'overlay-dz2';
            el.setAttribute('overlay-target', 'target2');
            el.setAttribute('accept', '*/*');
            document.body.append(el);
            (window as any).__wire(el);
            await el.whenSettled();
        });
        await startPulse(page);
        await dragFiles(page.locator('body'), 'dragenter');
        await expect(overlay(page)).toHaveCount(2);

        const second = overlay(page).nth(await overlayIndexFor(page, 'target2'));
        await dragFiles(second, 'dragenter');
        await dragFiles(second, 'drop', ['two.txt']);

        await expect(overlay(page)).toHaveCount(0);
        const names = (id: string) => page.locator(`#${id}`).evaluate((el: any) => el.files.map((f: any) => f.name));
        await expect.poll(() => names('overlay-dz2')).toEqual(['two.txt']);
        expect(await names('overlay-dz')).toEqual([]);
    });
});

test.describe('overlay-target forms', () => {
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
        await dragFiles(page.locator('body'), 'dragenter');
        await expect(overlay(page)).toHaveCount(1, { timeout: 1000 });
    });

    test('an HTMLElement assigned to the overlayTarget property works', async ({ page }) => {
        await page.evaluate(async () => {
            document.getElementById('overlay-dz')!.remove();
            const el = document.createElement('web-dropzone') as any;
            el.overlayTarget = document.getElementById('target2');
            document.body.append(el);
            await el.whenSettled();
        });
        await dragFiles(page.locator('body'), 'dragenter');
        await expect(overlay(page)).toHaveCount(1);
        expect(await overlayIndexFor(page, 'target2')).toBe(0);
    });
});
