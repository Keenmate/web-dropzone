import { test, expect, dz, dragFiles, logLines } from './fixtures';

/**
 * Drop onto the dropzone itself (not the overlay). The card / button inside
 * <web-dropzone> is the managed <web-dropzone-picker> satellite; its drop
 * target is `.dz__dropzone` in the picker's shadow root.
 *
 * Fixture: test/drop.html. `#drop` is a card with accept=".txt" and
 * max-file-count="3"; file-add / files-reject / change log into `drop-log`.
 * `#drop-btn` checks the button appearance is a drop target as well.
 * Drags are synthetic (`dragFiles`, real File objects in a DataTransfer).
 */

const PAGE = '/test/drop.html';

const card = (id: string) => `#${id} .dz__dropzone`;
const names = (page: import('@playwright/test').Page, id: string) =>
    dz(page, id).evaluate((el: any) => el.files.map((f: any) => f.name));

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test.describe('drag feedback', () => {
    test('dragenter marks the card active (dragover accepted as a drop target); dragleave clears it', async ({ page }) => {
        const c = page.locator(card('drop'));
        await dragFiles(c, 'dragenter');
        expect(await dragFiles(c, 'dragover')).toBe(true); // preventDefault → valid drop target
        await expect(c).toHaveClass(/dz__dropzone--active/);
        await dragFiles(c, 'dragleave');
        await expect(c).not.toHaveClass(/dz__dropzone--active/);
    });

    test('labels.dragActive replaces the prompt while a drag is over the card', async ({ page }) => {
        const c = page.locator(card('drop'));
        await expect(c.locator('.dz__dropzone__text')).toHaveText('Drop here');
        await dragFiles(c, 'dragenter');
        await expect(c.locator('.dz__dropzone__text')).toHaveText('Release to add');
        await dragFiles(c, 'dragleave');
        await expect(c.locator('.dz__dropzone__text')).toHaveText('Drop here');
    });
});

test.describe('drop', () => {
    test('dropping files adds them (file-add per file, one change) and clears the active state', async ({ page }) => {
        const c = page.locator(card('drop'));
        await dragFiles(c, 'dragenter');
        await dragFiles(c, 'dragover');
        await dragFiles(c, 'drop', ['a.txt', 'b.txt']);
        await expect.poll(() => names(page, 'drop')).toEqual(['a.txt', 'b.txt']);
        await expect(c).not.toHaveClass(/dz__dropzone--active/);
        await expect.poll(() => logLines(page, 'drop')).toEqual(['file-add:a.txt', 'file-add:b.txt', 'change:2']);
    });

    test('dropped files run through validation — wrong type and over-count are rejected', async ({ page }) => {
        const c = page.locator(card('drop'));
        await dragFiles(c, 'drop', ['a.txt', 'pic.png', 'b.txt', 'c.txt', 'd.txt']);
        await expect.poll(() => names(page, 'drop')).toEqual(['a.txt', 'b.txt', 'c.txt']);
        const lines = await logLines(page, 'drop');
        const reject = lines.find((l) => l.startsWith('files-reject:'));
        expect(reject).toBeDefined();
        expect(reject).toContain('pic.png=type');
        expect(reject).toContain('d.txt=count');
    });

    test('the button appearance accepts drops too', async ({ page }) => {
        await dragFiles(page.locator(card('drop-btn')), 'drop', ['x.txt']);
        await expect.poll(() => names(page, 'drop-btn')).toEqual(['x.txt']);
    });
});
