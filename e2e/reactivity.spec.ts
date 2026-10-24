import { test, expect, dz, addNamed, dragFiles, logLines, type Page } from './fixtures';

/**
 * Inputs changed AFTER the store was built must take effect (core: every input
 * is reactive by construction; dropzone applies `on: 'update'` in place and
 * rebuilds only on a mode flip).
 *
 * Fixture: test/reactivity.html — `#caps` (no caps at load), `#flip`
 * (headless at load), `#late-ov` (no overlay target at load).
 */

const PAGE = '/test/reactivity.html';

const names = (page: Page, id: string) => dz(page, id).evaluate((el: any) => el.files.map((f: any) => f.name));
const setAttr = (page: Page, id: string, name: string, value: string | null) =>
    dz(page, id).evaluate(async (el: any, { name, value }) => {
        if (value === null) el.removeAttribute(name);
        else el.setAttribute(name, value);
        await el.whenSettled();
    }, { name, value });

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test.describe('validation caps', () => {
    test('max-file-count set after build applies to the next add', async ({ page }) => {
        await setAttr(page, 'caps', 'max-file-count', '2');
        await addNamed(page, 'caps', ['a.txt', 'b.txt', 'c.txt']);
        await expect.poll(() => names(page, 'caps')).toEqual(['a.txt', 'b.txt']);
        expect(await logLines(page, 'caps')).toContain('files-reject:c.txt=count');
    });

    test('removing max-file-count returns to unlimited', async ({ page }) => {
        await setAttr(page, 'caps', 'max-file-count', '1');
        await addNamed(page, 'caps', ['a.txt', 'b.txt']);
        await expect.poll(() => names(page, 'caps')).toEqual(['a.txt']);
        await setAttr(page, 'caps', 'max-file-count', null);
        await addNamed(page, 'caps', ['c.txt', 'd.txt', 'e.txt']);
        await expect.poll(() => names(page, 'caps')).toEqual(['a.txt', 'c.txt', 'd.txt', 'e.txt']);
    });

    test('the maxFileCount property is reactive too (and reflects)', async ({ page }) => {
        await dz(page, 'caps').evaluate(async (el: any) => { el.maxFileCount = 1; await el.whenSettled(); });
        await expect(dz(page, 'caps')).toHaveAttribute('max-file-count', '1');
        await addNamed(page, 'caps', ['a.txt', 'b.txt']);
        await expect.poll(() => names(page, 'caps')).toEqual(['a.txt']);
    });

    test('accept changed after build rejects the new wrong type and updates the native input', async ({ page }) => {
        await setAttr(page, 'caps', 'accept', '.pdf');
        await expect(dz(page, 'caps').locator('input[type="file"]')).toHaveAttribute('accept', '.pdf');
        await addNamed(page, 'caps', ['a.txt']);
        await expect.poll(() => logLines(page, 'caps')).toContain('files-reject:a.txt=type');
        expect(await names(page, 'caps')).toEqual([]);
    });
});

test.describe('display + mode', () => {
    test('list-appearance change re-renders the rows and keeps the files (no rebuild)', async ({ page }) => {
        await addNamed(page, 'caps', ['a.txt', 'b.txt']);
        await expect(dz(page, 'caps').locator('.dz__file-item--list')).toHaveCount(2);
        await setAttr(page, 'caps', 'list-appearance', 'badges');
        await expect(dz(page, 'caps').locator('.dz__badge')).toHaveCount(2);
        expect(await names(page, 'caps')).toEqual(['a.txt', 'b.txt']);
    });

    test('headless → bulk (mode flip) rebuilds: picker renders and `ready` fires again', async ({ page }) => {
        await expect(dz(page, 'flip').locator('.dz__dropzone')).toHaveCount(0);
        await expect.poll(() => logLines(page, 'flip')).toEqual(['ready:']);
        await setAttr(page, 'flip', 'display-mode', 'list');
        await expect(dz(page, 'flip').locator('.dz__dropzone--card')).toHaveCount(1);
        await expect.poll(() => logLines(page, 'flip')).toEqual(['ready:', 'ready:']);
        // The rebuilt store works: a drop on the new picker adds.
        await dragFiles(dz(page, 'flip').locator('.dz__dropzone'), 'drop', ['x.txt']);
        await expect.poll(() => names(page, 'flip')).toEqual(['x.txt']);
    });

    test('explicit mode="headless" on a rendered dropzone removes the UI', async ({ page }) => {
        await setAttr(page, 'caps', 'mode', 'headless');
        await expect(dz(page, 'caps').locator('.dz__dropzone')).toHaveCount(0);
    });
});

test.describe('overlay-target', () => {
    test('overlay-target set after build wires the overlay', async ({ page }) => {
        await setAttr(page, 'late-ov', 'overlay-target', 'late-target');
        await dragFiles(page.locator('body'), 'dragenter');
        await expect(page.locator('.dz__overlay')).toHaveCount(1);
    });
});
