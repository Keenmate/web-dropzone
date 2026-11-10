import { test, expect, dragFiles, type Page } from './fixtures';

/**
 * Drag overlay light / dark. Fixture: test/drag-overlay-theme.html.
 *
 * The overlay is mounted on <body>, outside the host's dark-mode.css rules, so it
 * must carry the HOST's resolved color-scheme — not the page's. The page sets a
 * scheme-dependent accent (`light-dark(blue, red)`), so the overlay background
 * proves which branch resolved: blue-ish = light, red-ish = dark.
 */

const PAGE = '/test/drag-overlay-theme.html';
const overlay = (page: Page) => page.locator('.dz__overlay');

async function overlayScheme(page: Page): Promise<{ scheme: string; bg: string }> {
    return overlay(page).evaluate((el) => {
        const cs = getComputedStyle(el);
        return { scheme: cs.colorScheme, bg: cs.backgroundColor };
    });
}

/** [r, g, b] of a computed color (rgb()/rgba() or color(srgb …)). */
function channels(color: string): number[] {
    const nums = color.match(/[\d.]+/g)!.map(Number);
    return color.startsWith('color(') ? nums.slice(0, 3).map((n) => n * 255) : nums.slice(0, 3);
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('#dz').evaluate((el: any) => el.whenSettled());
});

test('dark dropzone on a light page → the overlay is dark', async ({ page }) => {
    await dragFiles(page.locator('body'), 'dragenter');
    await expect(overlay(page)).toHaveCount(1);
    const { scheme, bg } = await overlayScheme(page);
    expect(scheme).toBe('dark');
    const [r, , b] = channels(bg);
    expect(r).toBeGreaterThan(200);
    expect(b).toBeLessThan(50);
});

test('light dropzone on a dark page → the overlay is light', async ({ page }) => {
    await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('dz')!.setAttribute('data-theme', 'light');
    });
    await expect(page.locator('#dz')).toHaveAttribute('data-context-theme', 'dark');
    await dragFiles(page.locator('body'), 'dragenter');
    await expect(overlay(page)).toHaveCount(1);
    const { scheme, bg } = await overlayScheme(page);
    expect(scheme).toBe('light');
    const [r, , b] = channels(bg);
    expect(b).toBeGreaterThan(200);
    expect(r).toBeLessThan(50);
});

test('no per-instance theme → the overlay follows the host context', async ({ page }) => {
    await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('dz')!.removeAttribute('data-theme');
    });
    await expect(page.locator('#dz')).toHaveAttribute('data-context-theme', 'dark');
    await dragFiles(page.locator('body'), 'dragenter');
    await expect(overlay(page)).toHaveCount(1);
    expect((await overlayScheme(page)).scheme).toBe('dark');
});

test('a host theme change while the overlay is shown re-schemes it live', async ({ page }) => {
    await dragFiles(page.locator('body'), 'dragenter');
    await expect(overlay(page)).toHaveCount(1);
    expect((await overlayScheme(page)).scheme).toBe('dark');
    await page.locator('#dz').evaluate((el) => el.setAttribute('data-theme', 'light'));
    await expect.poll(async () => (await overlayScheme(page)).scheme).toBe('light');
});
