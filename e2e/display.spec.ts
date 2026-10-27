import { test, expect, dz, dragFiles } from './fixtures';

/**
 * Section 1 — selector-appearance.
 *
 * Fixture: test/display.html. Five dropzones, one per appearance variant
 * (plus a localized native to verify labels.noFileChosen + labels.selectFiles).
 */

const PAGE = '/test/display.html';

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
});

test.describe('selector-appearance="card" (default)', () => {
    test('renders the bordered drop-zone card', async ({ page }) => {
        const card = dz(page, 'card');
        await expect(card.locator('.dz__dropzone--card')).toBeVisible();
    });

    test('exposes a hidden <input type="file"> for the click fallback', async ({ page }) => {
        const card = dz(page, 'card');
        await expect(card.locator('input[type="file"].dz__dropzone__input')).toHaveCount(1);
    });
});

test.describe('selector-appearance="button"', () => {
    test('renders the accent button with the labels.selectFiles label', async ({ page }) => {
        const btn = dz(page, 'button');
        await expect(btn.locator('.dz__button')).toBeVisible();
        await expect(btn.locator('.dz__button__label')).toHaveText('Pick files');
    });

    test('does NOT render the card drop-zone surface', async ({ page }) => {
        const btn = dz(page, 'button');
        await expect(btn.locator('.dz__dropzone--card')).toHaveCount(0);
    });
});

test.describe('selector-appearance="minimal"', () => {
    test('renders the icon-only button', async ({ page }) => {
        const min = dz(page, 'minimal');
        await expect(min.locator('.dz__minimal')).toBeVisible();
        await expect(min.locator('.dz__minimal__icon')).toHaveText('📎');
    });

    test('badge is hidden when no files', async ({ page }) => {
        const min = dz(page, 'minimal');
        await expect(min.locator('.dz__minimal__badge')).toHaveCount(0);
    });
});

test.describe('selector-appearance="native"', () => {
    test('renders button + plain-text label', async ({ page }) => {
        const nat = dz(page, 'native');
        await expect(nat.locator('.dz__dropzone--native')).toBeVisible();
        await expect(nat.locator('.dz__native__button')).toHaveText('Choose Files');
        await expect(nat.locator('.dz__native__label')).toHaveText('No file chosen');
    });

    test('label updates after programmatic add', async ({ page }) => {
        const nat = dz(page, 'native');
        await nat.evaluate((el: any) => {
            el.addFiles([new File(['x'], 'report.pdf', { type: 'application/pdf' })]);
        });
        await expect(nat.locator('.dz__native__label')).toHaveText('report.pdf');
    });

    test('multi-file label uses "N files chosen"', async ({ page }) => {
        const nat = dz(page, 'native');
        await nat.evaluate((el: any) => {
            el.addFiles([
                new File(['x'], 'a.txt'),
                new File(['y'], 'b.txt'),
                new File(['z'], 'c.txt')
            ]);
        });
        await expect(nat.locator('.dz__native__label')).toHaveText('3 files chosen');
    });
});

test.describe('native + labels.noFileChosen', () => {
    test('renders the localized empty-state label', async ({ page }) => {
        const i18n = dz(page, 'native-i18n');
        await expect(i18n.locator('.dz__native__button')).toHaveText('Vybrat soubory');
        await expect(i18n.locator('.dz__native__label')).toHaveText('Žádný soubor');
    });
});

test.describe('multiple', () => {
    const input = (page: import('@playwright/test').Page, id: string) => dz(page, id).locator('input[type="file"]');

    test('default: the native input allows multiple files and el.multiple is true', async ({ page }) => {
        await expect(input(page, 'multi-default')).toHaveAttribute('multiple', '');
        expect(await dz(page, 'multi-default').evaluate((el: any) => el.multiple)).toBe(true);
    });

    test('multiple="false": single-file input; the file dialog is single-select', async ({ page }) => {
        await expect(input(page, 'single')).not.toHaveAttribute('multiple');
        expect(await dz(page, 'single').evaluate((el: any) => el.multiple)).toBe(false);
        const chooser = page.waitForEvent('filechooser');
        await dz(page, 'single').locator('.dz__dropzone').click();
        expect((await chooser).isMultiple()).toBe(false);
    });

    test('el.multiple toggles the native input live', async ({ page }) => {
        await dz(page, 'multi-default').evaluate(async (el: any) => { el.multiple = false; await el.whenSettled(); });
        await expect(input(page, 'multi-default')).not.toHaveAttribute('multiple');
        await dz(page, 'single').evaluate(async (el: any) => { el.multiple = true; await el.whenSettled(); });
        await expect(input(page, 'single')).toHaveAttribute('multiple', '');
    });
});

test.describe('text inputs', () => {
    const card = (page: import('@playwright/test').Page) => dz(page, 'texts').locator('.dz__dropzone--card');
    const setAttr = (page: import('@playwright/test').Page, id: string, name: string, value: string) =>
        dz(page, id).evaluate(async (el: any, { name, value }) => { el.setAttribute(name, value); await el.whenSettled(); }, { name, value });

    test('labels.prompt / labels.hint render in the card; live changes re-render', async ({ page }) => {
        await expect(card(page).locator('.dz__dropzone__text')).toHaveText('Drag reports here');
        await expect(card(page).locator('.dz__dropzone__hint')).toHaveText('Max 10 MB');
        await setAttr(page, 'texts', 'labels', JSON.stringify({ prompt: 'Drop invoices', hint: 'PDF only' }));
        await expect(card(page).locator('.dz__dropzone__text')).toHaveText('Drop invoices');
        await expect(card(page).locator('.dz__dropzone__hint')).toHaveText('PDF only');
    });

    test('empty-message renders while empty; a live change re-renders', async ({ page }) => {
        await expect(dz(page, 'texts').locator('.dz__empty')).toHaveText('Nothing uploaded yet');
        await setAttr(page, 'texts', 'empty-message', 'Still empty');
        await expect(dz(page, 'texts').locator('.dz__empty')).toHaveText('Still empty');
    });

    test('labels.overlay / overlay-icon render in the overlay; live changes apply to the next drag', async ({ page }) => {
        await dragFiles(page.locator('body'), 'dragenter');
        await expect(page.locator('.dz__overlay__text')).toHaveText('Drop to attach');
        await expect(page.locator('.dz__overlay__icon')).toHaveText('📥');
        await page.keyboard.press('Escape');
        await expect(page.locator('.dz__overlay')).toHaveCount(0);

        await dz(page, 'ov').evaluate(async (el: any) => { el.labels = { overlay: 'Release!' }; await el.whenSettled(); });
        await dragFiles(page.locator('body'), 'dragenter');
        await expect(page.locator('.dz__overlay__text')).toHaveText('Release!');
    });
});
