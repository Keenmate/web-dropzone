import { test, expect, dz, addNamed, trackFileChoosers, type Page } from './fixtures';

/**
 * Keyboard operation + accessible names.
 *
 * The card's keyboard target is its visually-hidden native file input (the
 * card shows a `:focus-within` ring); button / minimal selectors use their
 * own <button>. Enter / Space on the focused control opens the file dialog.
 *
 * Fixture: test/a11y.html — `#card`, `#btn`, `#min`, `#dis` with plain
 * <button>s around them as tab anchors.
 */

const PAGE = '/test/a11y.html';

/** Deepest focused element (through shadow roots) as "TAG.class". */
const focused = (page: Page) => page.evaluate(() => {
    let a: any = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return a ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}.${a.className}` : '';
});

let choosers: () => number;

test.beforeEach(async ({ page }) => {
    choosers = trackFileChoosers(page);
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
    await page.locator('#start').focus();
});

test.describe('card', () => {
    test('Tab reaches the card; it shows the focus ring; Enter and Space open the file dialog', async ({ page }) => {
        await page.keyboard.press('Tab');
        expect(await focused(page)).toContain('dz__dropzone-input');
        expect(await dz(page, 'card').locator('.dz__dropzone--card').evaluate((el) => el.matches(':focus-within'))).toBe(true);
        await page.keyboard.press('Enter');
        await expect.poll(choosers).toBe(1);
        await page.keyboard.press('Space');
        await expect.poll(choosers).toBe(2);
    });

    test('the card is a single tab stop', async ({ page }) => {
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        expect(await focused(page)).toBe('button#after-card.');
    });

    test('the card control is named after the prompt', async ({ page }) => {
        await expect(dz(page, 'card').locator('input[type="file"]')).toHaveAccessibleName(/Drop reports/);
    });
});

test.describe('button / minimal selectors', () => {
    test('Enter on the focused button opens the file dialog', async ({ page }) => {
        await dz(page, 'btn').locator('.dz__button').focus();
        await page.keyboard.press('Enter');
        await expect.poll(choosers).toBe(1);
    });

    test('the button selector is a single tab stop (the hidden input is not focusable)', async ({ page }) => {
        await page.locator('#after-card').focus();
        await page.keyboard.press('Tab');
        expect(await focused(page)).toContain('dz__button');
        await page.keyboard.press('Tab');
        expect(await focused(page)).toBe('button#after-btn.');
    });

    test('accessible names: button = its label, minimal = the prompt text', async ({ page }) => {
        await expect(dz(page, 'btn').locator('.dz__button')).toHaveAccessibleName(/Browse files/);
        await expect(dz(page, 'min').locator('.dz__minimal')).toHaveAccessibleName('Attach files');
    });
});

test.describe('disabled', () => {
    test('a disabled dropzone is skipped by Tab', async ({ page }) => {
        await page.locator('#before-dis').focus();
        await page.keyboard.press('Tab');
        expect(await focused(page)).toBe('button#after-dis.');
    });
});

test.describe('row controls', () => {
    test('row buttons carry file-specific accessible names', async ({ page }) => {
        await addNamed(page, 'card', ['report.pdf']);
        const row = dz(page, 'card').locator('.dz__file-item');
        await expect(row.locator('[data-dz-action="remove"]')).toHaveAccessibleName('Remove report.pdf');
        await expect(row.locator('.dz__file-item-status')).toHaveAttribute('aria-label', /^Status: /);
    });

    test('Enter on a focused row ✕ removes the file', async ({ page }) => {
        await addNamed(page, 'card', ['a.txt']);
        await dz(page, 'card').locator('[data-dz-action="remove"]').focus();
        await page.keyboard.press('Enter');
        await expect(dz(page, 'card').locator('.dz__file-item')).toHaveCount(0);
    });
});
