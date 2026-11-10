import { test, expect, dz, addNamed, type Page } from './fixtures';

/**
 * Compact popover on a phone: the same sheet presentation as the indicator
 * drawer (full screen below the 600px line, a close button). Desktop keeps the
 * anchored panel with no close button.
 *
 * Fixture: test/popover.html (`#pop`, compact display mode).
 */

const PAGE = '/test/popover.html';
const PHONE = { width: 390, height: 844 };

const popover = (page: Page) => dz(page, 'pop').locator('.dz__popover');
const summary = (page: Page) => dz(page, 'pop').locator('.dz__summary-line');
const closeButton = (page: Page) => popover(page).locator('.dz__popover-close');

async function open(page: Page) {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
    await addNamed(page, 'pop', ['a.txt', 'b.txt']);
    await summary(page).click();
    await expect(popover(page)).toBeVisible();
}

test.describe('phone viewport', () => {
    test.use({ viewport: PHONE, hasTouch: true });

    test('the compact popover is a full-screen sheet', async ({ page }) => {
        await open(page);
        await expect.poll(async () => {
            const box = await popover(page).boundingBox();
            return box && [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)];
        }).toEqual([0, 0, PHONE.width, PHONE.height]);
    });

    test('its close button closes it and focus returns to the summary', async ({ page }) => {
        await open(page);
        await expect(closeButton(page)).toBeVisible();
        await expect(closeButton(page)).toHaveAttribute('aria-label', 'Close');
        await closeButton(page).click();
        await expect(popover(page)).toHaveCount(0);
        await expect(summary(page)).toBeFocused();
    });

    test('widening past the phone line while open anchors it again', async ({ page }) => {
        await open(page);
        await expect(closeButton(page)).toBeVisible(); // a sheet first
        await page.setViewportSize({ width: 1200, height: 900 });
        await expect.poll(async () => {
            const [p, s] = [await popover(page).boundingBox(), await summary(page).boundingBox()];
            return !!p && !!s && p.y > s.y && p.width < 1200;
        }).toBe(true);
        await expect(closeButton(page)).toBeHidden();
    });
});

test.describe('desktop viewport', () => {
    test('the popover stays anchored; its close button exists but is hidden', async ({ page }) => {
        await open(page);
        await expect(closeButton(page)).toHaveCount(1);
        await expect(closeButton(page)).toBeHidden();
        const [p, s] = [await popover(page).boundingBox(), await summary(page).boundingBox()];
        expect(p!.y).toBeGreaterThan(s!.y);
    });
});
