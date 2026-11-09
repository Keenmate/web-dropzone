/**
 * Properties assigned before the elements are defined (a classic script, the
 * component bundle loads later): core lifts and replays them through the input
 * accessors (SPEC §6) — the satellites have no rescue code of their own.
 *
 * Fixture: test/pre-upgrade.html.
 */
import { test, expect, dz } from './fixtures';

test.beforeEach(async ({ page }) => {
    await page.goto('/test/pre-upgrade.html');
    await page.waitForFunction(() => ['store', 'pk', 'ind'].every((id) => (document.getElementById(id) as any)?.isReady));
});

test('early properties apply, and the accessors are no longer shadowed', async ({ page }) => {
    expect(await dz(page, 'store').evaluate((el: any) => el.maxFileCount)).toBe(3);
    expect(await dz(page, 'pk').evaluate((el: any) => el.selectorAppearance)).toBe('button');
    await expect(dz(page, 'pk').locator('.dz__dropzone--button')).toHaveCount(1);
    await expect(dz(page, 'ind').locator('.early-body')).toHaveText('0 early');
    // a later write goes through the accessor (not a stale own property)
    const own = await dz(page, 'pk').evaluate(async (el: any) => {
        el.selectorAppearance = 'minimal';
        await el.whenSettled();
        return Object.prototype.hasOwnProperty.call(el, 'selectorAppearance') ? Object.getOwnPropertyDescriptor(el, 'selectorAppearance')!.get !== undefined : 'none';
    });
    expect(own).not.toBe(false);
    await expect(dz(page, 'pk').locator('.dz__dropzone--minimal')).toHaveCount(1);
});

test('the picker stamps its early uploadMetadata onto the files it adds', async ({ page }) => {
    await dz(page, 'pk').locator('input.dz__dropzone-input').setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
    await expect.poll(() => dz(page, 'store').evaluate((el: any) => el.files.map((f: any) => f.uploadMetadata))).toEqual([{ folder: 'early' }]);
    await expect(dz(page, 'ind').locator('.early-body')).toHaveText('1 early');
});
