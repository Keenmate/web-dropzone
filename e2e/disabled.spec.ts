import { test, expect, dz, dragFiles, type Page } from './fixtures';

/**
 * Disabled state: no user path (click → file dialog, drop, overlay) adds files.
 *
 * Fixture: test/disabled.html — `#dis` (card), `#dis-btn` (button),
 * `#dis-ov` (overlay-target), `#in-fs` (inside a <fieldset> the spec disables).
 * Programmatic `addFiles` on a disabled host is intentionally still allowed
 * (theming.spec.ts covers that).
 */

const PAGE = '/test/disabled.html';

const card = (page: Page, id: string) => page.locator(`#${id} .dz__dropzone`);
const count = (page: Page, id: string) => dz(page, id).evaluate((el: any) => el.files.length);

/** Count native file dialogs opened while `fn` runs. */
async function fileChoosers(page: Page, fn: () => Promise<void>): Promise<number> {
    let n = 0;
    const on = () => { n++; };
    page.on('filechooser', on);
    await fn();
    await page.waitForTimeout(300);
    page.off('filechooser', on);
    return n;
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test.describe('disabled host', () => {
    test('el.disabled reflects the attribute and the surface carries the disabled modifier', async ({ page }) => {
        expect(await dz(page, 'dis').evaluate((el: any) => el.disabled)).toBe(true);
        await expect(card(page, 'dis')).toHaveClass(/dz__dropzone--disabled/);
        await expect(page.locator('#dis input[type="file"]')).toBeDisabled();
        await expect(page.locator('#dis-btn .dz__button')).toBeDisabled();
    });

    test('clicking the card does not open the file dialog', async ({ page }) => {
        expect(await fileChoosers(page, () => card(page, 'dis').click({ force: true }))).toBe(0);
    });

    test('dropping files adds nothing and does not light up the card', async ({ page }) => {
        await dragFiles(card(page, 'dis'), 'dragenter');
        await expect(card(page, 'dis')).not.toHaveClass(/dz__dropzone--active/);
        await dragFiles(card(page, 'dis'), 'drop', ['a.txt']);
        await dragFiles(card(page, 'dis-btn'), 'drop', ['b.txt']);
        await page.waitForTimeout(100);
        expect(await count(page, 'dis')).toBe(0);
        expect(await count(page, 'dis-btn')).toBe(0);
    });

    test('a file drag does not mount the overlay', async ({ page }) => {
        await dragFiles(page.locator('body'), 'dragenter');
        await page.waitForTimeout(100);
        await expect(page.locator('.dz__overlay')).toHaveCount(0);
    });
});

test.describe('reactive toggle', () => {
    test('el.disabled = false enables click + drop; = true disables them again', async ({ page }) => {
        await dz(page, 'dis').evaluate(async (el: any) => { el.disabled = false; await el.whenSettled(); });
        await expect(dz(page, 'dis')).not.toHaveAttribute('disabled');
        await expect(card(page, 'dis')).not.toHaveClass(/dz__dropzone--disabled/);
        expect(await fileChoosers(page, () => card(page, 'dis').click())).toBe(1);
        await dragFiles(card(page, 'dis'), 'drop', ['a.txt']);
        await expect.poll(() => count(page, 'dis')).toBe(1);

        await dz(page, 'dis').evaluate(async (el: any) => { el.disabled = true; await el.whenSettled(); });
        await expect(card(page, 'dis')).toHaveClass(/dz__dropzone--disabled/);
        await dragFiles(card(page, 'dis'), 'drop', ['b.txt']);
        await page.waitForTimeout(100);
        expect(await count(page, 'dis')).toBe(1);
    });

    test('removing the disabled attribute enables drops', async ({ page }) => {
        await dz(page, 'dis-btn').evaluate(async (el: any) => { el.removeAttribute('disabled'); await el.whenSettled(); });
        await expect(page.locator('#dis-btn .dz__button')).toBeEnabled();
        await dragFiles(card(page, 'dis-btn'), 'drop', ['b.txt']);
        await expect.poll(() => count(page, 'dis-btn')).toBe(1);
    });

    test('enabling an overlay dropzone lets the overlay mount', async ({ page }) => {
        await dz(page, 'dis-ov').evaluate(async (el: any) => { el.disabled = false; await el.whenSettled(); });
        await dragFiles(page.locator('body'), 'dragenter');
        await expect(page.locator('.dz__overlay')).toHaveCount(1);
    });
});

test.describe('<fieldset disabled>', () => {
    test('an enabled fieldset leaves the dropzone usable (control)', async ({ page }) => {
        await dragFiles(card(page, 'in-fs'), 'drop', ['a.txt']);
        await expect.poll(() => count(page, 'in-fs')).toBe(1);
    });

    test('a disabled fieldset disables the dropzone (drop adds nothing, :disabled matches)', async ({ page }) => {
        test.fail(true, 'NOTES.md #5');
        await page.locator('#fs').evaluate((fs: HTMLFieldSetElement) => { fs.disabled = true; });
        // Form-associated custom elements match :disabled via the fieldset natively.
        expect(await dz(page, 'in-fs').evaluate((el) => el.matches(':disabled'))).toBe(true);
        await dragFiles(card(page, 'in-fs'), 'drop', ['a.txt']);
        await page.waitForTimeout(150);
        expect(await count(page, 'in-fs')).toBe(0);
    });
});
