import { test, expect, dz, addNamed, type Page } from './fixtures';

/**
 * Compact popover on a phone: the same sheet presentation as the indicator
 * drawer (full screen on a phone — core's device classification: touch + a short
 * side under the tablet line — core's .km-sheet frame, MODAL: page inert, Tab
 * trapped, Escape / Back / the close button close it and focus returns). Desktop keeps the
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

    test("the frame is core's .km-sheet in the modal tier, with the popover's background", async ({ page }) => {
        await open(page);
        await expect(popover(page)).toHaveClass(/\bkm-sheet\b/);
        await expect(popover(page)).toHaveAttribute('aria-modal', 'true');
        const style = await popover(page).evaluate((el) => {
            const cs = getComputedStyle(el);
            return { position: cs.position, zIndex: cs.zIndex, bg: cs.backgroundColor };
        });
        expect(style.position).toBe('fixed');
        expect(Number(style.zIndex)).toBe(7000); // --base-z-modal (core's sheet frame), not the popover tier
        await dz(page, 'pop').evaluate((el) => (el as HTMLElement).style.setProperty('--dz-popover-bg', 'rgb(1, 2, 3)'));
        await expect.poll(() => popover(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(1, 2, 3)');
    });

    test('it is modal: the page behind is inert and Tab stays inside the sheet', async ({ page }) => {
        await open(page);
        expect(await page.evaluate(() => !!document.getElementById('outside')!.closest('[inert]'))).toBe(true);
        const inside = () => popover(page).evaluate((el) => {
            const host = (el.getRootNode() as ShadowRoot).host;
            const active = host.shadowRoot!.activeElement;
            return document.activeElement === host && !!active && el.contains(active);
        });
        await expect.poll(inside).toBe(true);
        for (let i = 0; i < 8; i++) {
            await page.keyboard.press('Tab');
            expect(await inside()).toBe(true);
        }
        for (let i = 0; i < 8; i++) {
            await page.keyboard.press('Shift+Tab');
            expect(await inside()).toBe(true);
        }
    });

    test('Escape closes it, the page is live again and focus returns to the summary', async ({ page }) => {
        await open(page);
        await page.keyboard.press('Escape');
        await expect(popover(page)).toHaveCount(0);
        await expect(summary(page)).toBeFocused();
        expect(await page.evaluate(() => !!document.getElementById('outside')!.closest('[inert]'))).toBe(false);
    });

    test('its close button closes it and focus returns to the summary', async ({ page }) => {
        await open(page);
        await expect(closeButton(page)).toBeVisible();
        await expect(closeButton(page)).toHaveAttribute('aria-label', 'Close');
        await closeButton(page).click();
        await expect(popover(page)).toHaveCount(0);
        await expect(summary(page)).toBeFocused();
    });

    test("its close button is core's sheet chrome: a 44px chip, themed by --dz-sheet-close-size", async ({ page }) => {
        await open(page);
        await expect(closeButton(page)).toHaveClass(/\bkm-sheet-close\b/);
        await expect.poll(async () => (await closeButton(page).boundingBox())?.width).toBe(44);
        await dz(page, 'pop').evaluate((el) => (el as HTMLElement).style.setProperty('--dz-sheet-close-size', '50px'));
        await expect.poll(async () => (await closeButton(page).boundingBox())?.width).toBe(50);
    });

    test('the phone Back gesture closes the sheet (core sheet session) and the page behind does not scroll', async ({ page }) => {
        await open(page);
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow
            + getComputedStyle(document.body).overflow)).toContain('hidden');
        await page.goBack();
        await expect(popover(page)).toHaveCount(0);
        await expect(page).toHaveURL(new RegExp(PAGE.replace(/\//g, '\/')));
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
        // No longer modal: the page behind is live again.
        await expect(popover(page)).not.toHaveClass(/\bkm-sheet\b/);
        expect(await page.evaluate(() => !!document.getElementById('outside')!.closest('[inert]'))).toBe(false);
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
