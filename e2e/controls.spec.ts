import { test, expect, dz, addNamed, type Page } from './fixtures';

/**
 * Plyr-style allowlists. `controls` picks the top-level surfaces the host
 * mounts (picker, list, overall-progress — satellites inside the host's
 * shadow root); `item-controls` picks the per-row parts (icon, name, size,
 * type, progress, status, action, remove). Unset = everything.
 *
 * Fixture: test/controls.html.
 */

const PAGE = '/test/controls.html';

const surfaces = (page: Page, id: string) =>
    dz(page, id).evaluate((el: any) => ({
        picker: el.shadowRoot.querySelectorAll('web-dropzone-picker').length,
        list: el.shadowRoot.querySelectorAll('web-dropzone-list').length,
        progress: el.shadowRoot.querySelectorAll('web-dropzone-progress').length,
    }));

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test.describe('controls', () => {
    test('unset → picker, list and overall progress all mount', async ({ page }) => {
        expect(await surfaces(page, 'all')).toEqual({ picker: 1, list: 1, progress: 1 });
    });

    test('controls="picker" → only the picker', async ({ page }) => {
        expect(await surfaces(page, 'picker-only')).toEqual({ picker: 1, list: 0, progress: 0 });
        await addNamed(page, 'picker-only', ['a.txt']);
        await expect(dz(page, 'picker-only').locator('.dz__file-item')).toHaveCount(0);
    });

    test('controls="list, overall-progress" → no picker; rows still render', async ({ page }) => {
        expect(await surfaces(page, 'no-picker')).toEqual({ picker: 0, list: 1, progress: 1 });
        await addNamed(page, 'no-picker', ['a.txt']);
        await expect(dz(page, 'no-picker').locator('.dz__file-item')).toHaveCount(1);
    });

    test('unknown tokens are ignored; the property holds the parsed list', async ({ page }) => {
        expect(await surfaces(page, 'no-progress')).toEqual({ picker: 1, list: 1, progress: 0 });
        expect(await dz(page, 'no-progress').evaluate((el: any) => el.controls)).toEqual(['picker', 'list']);
    });

    test('changing controls after build remounts the surfaces', async ({ page }) => {
        await dz(page, 'all').evaluate(async (el: any) => { el.controls = ['list']; await el.whenSettled(); });
        await expect.poll(() => surfaces(page, 'all')).toEqual({ picker: 0, list: 1, progress: 0 });
        await dz(page, 'all').evaluate(async (el: any) => { el.removeAttribute('controls'); await el.whenSettled(); });
        await expect.poll(() => surfaces(page, 'all')).toEqual({ picker: 1, list: 1, progress: 1 });
    });
});

test.describe('item-controls', () => {
    test('unset → every part renders in a detailed row', async ({ page }) => {
        await addNamed(page, 'all', ['a.txt']);
        const row = dz(page, 'all').locator('.dz__file-item');
        for (const part of ['icon', 'name', 'size', 'type', 'progress', 'status', 'remove']) {
            await expect(row.locator(`.dz__file-item__${part}`), part).toHaveCount(1);
        }
        await expect(row.locator('[data-dz-action="row-action"]'), 'action').toHaveCount(1);
        await expect(row.locator('[data-dz-action="cancel"]'), 'cancel').toHaveCount(1);
    });

    test('item-controls="name,remove" → only those parts', async ({ page }) => {
        await addNamed(page, 'parts', ['a.txt']);
        const row = dz(page, 'parts').locator('.dz__file-item');
        await expect(row.locator('.dz__file-item__name')).toHaveText('a.txt');
        await expect(row.locator('.dz__file-item__remove')).toHaveCount(1);
        for (const part of ['icon', 'size', 'type', 'progress', 'status', 'action']) {
            await expect(row.locator(`.dz__file-item__${part}`), part).toHaveCount(0);
        }
    });

    test('item-controls changed after build re-renders the rows', async ({ page }) => {
        await addNamed(page, 'parts', ['a.txt']);
        await dz(page, 'parts').evaluate(async (el: any) => { el.setAttribute('item-controls', 'size'); await el.whenSettled(); });
        const row = dz(page, 'parts').locator('.dz__file-item');
        await expect(row.locator('.dz__file-item__size')).toHaveCount(1);
        await expect(row.locator('.dz__file-item__name')).toHaveCount(0);
    });
});
