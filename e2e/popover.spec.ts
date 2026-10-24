import { test, expect, dz, addNamed, type Page } from './fixtures';

/**
 * Compact (popover list) mode: the list satellite renders a summary line;
 * activating it opens the popover (positioned by core /positioning with
 * `popover-placement`). Escape and an outside click dismiss it.
 *
 * Fixture: test/popover.html — `#pop` (default placement, custom
 * summary-template), `#top` (popover-placement="top-end", with room above).
 */

const PAGE = '/test/popover.html';

const popover = (page: Page, id: string) => dz(page, id).locator('.dz__popover');
const summary = (page: Page, id: string) => dz(page, id).locator('.dz__summary__line');

async function open(page: Page, id: string) {
    await addNamed(page, id, ['a.txt', 'b.txt']);
    await summary(page, id).click();
    await expect(popover(page, id)).toBeVisible();
}

/** Anchor = the list satellite host (the summary's outer rectangle). */
const anchorBox = (page: Page, id: string) => dz(page, id).locator('web-dropzone-list').boundingBox();

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test.describe('placement', () => {
    test('default bottom-start: below the summary, left edges aligned', async ({ page }) => {
        await open(page, 'pop');
        await expect.poll(async () => {
            const [p, a] = [await popover(page, 'pop').boundingBox(), await anchorBox(page, 'pop')];
            return p!.y >= a!.y + a!.height && Math.abs(p!.x - a!.x) < 2;
        }).toBe(true);
    });

    test('popover-placement="top-end": above the summary, right edges aligned', async ({ page }) => {
        await open(page, 'top');
        await expect.poll(async () => {
            const [p, a] = [await popover(page, 'top').boundingBox(), await anchorBox(page, 'top')];
            return p!.y + p!.height <= a!.y + 1 && Math.abs(p!.x + p!.width - (a!.x + a!.width)) < 2;
        }).toBe(true);
    });
});

test.describe('dismissal', () => {
    test('Escape closes the popover', async ({ page }) => {
        await open(page, 'pop');
        await page.keyboard.press('Escape');
        await expect(popover(page, 'pop')).toHaveCount(0);
    });

    test('a click outside closes it; a click inside does not', async ({ page }) => {
        await open(page, 'pop');
        await popover(page, 'pop').locator('.dz__popover__count').click();
        await expect(popover(page, 'pop')).toBeVisible();
        await page.locator('#outside').click();
        await expect(popover(page, 'pop')).toHaveCount(0);
    });

    test('activating the summary again toggles it closed; Enter opens it from the keyboard', async ({ page }) => {
        await open(page, 'pop');
        await summary(page, 'pop').click();
        await expect(popover(page, 'pop')).toHaveCount(0);
        await summary(page, 'pop').focus();
        await page.keyboard.press('Enter');
        await expect(popover(page, 'pop')).toBeVisible();
    });
});

test.describe('summary-template', () => {
    test('{count} and {size} are filled in and follow the selection', async ({ page }) => {
        await addNamed(page, 'pop', ['a.txt']);
        await expect(summary(page, 'pop').locator('.dz__summary__text')).toHaveText('1 docs · 64 B');
        await addNamed(page, 'pop', ['b.txt']);
        await expect(summary(page, 'pop').locator('.dz__summary__text')).toHaveText('2 docs · 128 B');
    });

    test('the default template is "{count} file(s), {size}"; a live change re-renders', async ({ page }) => {
        await addNamed(page, 'top', ['a.txt']);
        await expect(summary(page, 'top').locator('.dz__summary__text')).toHaveText('1 file(s), 64 B');
        await dz(page, 'top').evaluate(async (el: any) => { el.summaryTemplate = 'Files: {count}'; await el.whenSettled(); });
        await expect(summary(page, 'top').locator('.dz__summary__text')).toHaveText('Files: 1');
    });
});
