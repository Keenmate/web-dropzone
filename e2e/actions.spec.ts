import { test, expect, dz, addNamed, type Page } from './fixtures';

/**
 * Buttons through core `/actions` (SPEC §12.12): `beforeActionCallback` →
 * item `onClick` → built-in → `action` event. The per-purpose events
 * (`file-remove`, …) still fire.
 *
 * Fixture: test/actions.html — `#acts` (list appearance), `#sat-store` +
 * `#sat-list` (a `<web-dropzone-list>` satellite; its buttons route through
 * the store, so `action` fires on `<web-dropzone>`).
 */

const PAGE = '/test/actions.html';

type Entry = Record<string, unknown> & { id: string; type: string };
const entries = (page: Page, id: string): Promise<Entry[]> =>
    page.evaluate((i) => (window as any).__log.filter((e: Entry) => e.id === i), id);
const names = (page: Page, id: string): Promise<string[]> =>
    dz(page, id).evaluate((el: any) => el.files.map((f: any) => f.name));
const removeIn = (page: Page, host: string, name: string) =>
    dz(page, host).locator(`.dz__file-item:has(.dz__file-item-name:text-is("${name}")) [data-dz-action="remove"]`);

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test('row remove fires `action` with the file in the detail, after the built-in', async ({ page }) => {
    await addNamed(page, 'acts', ['a.txt', 'b.txt']);
    await removeIn(page, 'acts', 'a.txt').click();
    await expect.poll(() => names(page, 'acts')).toEqual(['b.txt']);
    await expect.poll(async () => (await entries(page, 'acts')).find((e) => e.type === 'action')).toEqual({
        id: 'acts', type: 'action', action: 'remove', source: 'row-toolbar',
        file: 'a.txt', files: 1, // the state the built-in left
        hasItem: true, hasTrigger: true, hasController: true, element: true,
    });
});

test('the old `file-remove` still fires; order: before → file-remove → action', async ({ page }) => {
    await addNamed(page, 'acts', ['a.txt']);
    await removeIn(page, 'acts', 'a.txt').click();
    await expect.poll(async () => (await entries(page, 'acts')).map((e) => `${e.type}:${e.file}`))
        .toEqual(['before:a.txt', 'file-remove:a.txt', 'action:a.txt']);
});

test('beforeActionCallback returning false keeps the file (no file-remove, no action)', async ({ page }) => {
    await addNamed(page, 'acts', ['keep.txt']);
    await page.evaluate(() => { (window as any).__cancelActions = true; });
    await removeIn(page, 'acts', 'keep.txt').click();
    await expect.poll(async () => (await entries(page, 'acts')).length).toBe(1);
    await page.waitForTimeout(100);
    expect(await names(page, 'acts')).toEqual(['keep.txt']);
    expect((await entries(page, 'acts')).map((e) => e.type)).toEqual(['before']);
});

test('a satellite list button routes through the store: action + file-remove on <web-dropzone>', async ({ page }) => {
    await addNamed(page, 'sat-store', ['s.txt']);
    await removeIn(page, 'sat-list', 's.txt').click();
    await expect.poll(() => names(page, 'sat-store')).toEqual([]);
    await expect.poll(async () => (await entries(page, 'sat-store')).map((e) => `${e.type}:${e.file}`))
        .toEqual(['before:s.txt', 'file-remove:s.txt', 'action:s.txt']);
});
