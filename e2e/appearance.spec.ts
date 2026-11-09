import { test, expect, dz, addNamed } from './fixtures';

/**
 * Section 15 — card-size + display-mode shorthand + button badge.
 *
 * Fixture: test/appearance.html.
 *   - Three card-size variants (minimal / compact / big).
 *   - display-mode shorthand expansions (list / detailed / grid / compact).
 *   - Orthogonal attribute override precedence (display-mode loses).
 *   - Button selector with a post-add count badge.
 */

const PAGE = '/test/appearance.html';

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function');
});

test.describe('card-size variants', () => {
    test('minimal carries the dz__dropzone--card-minimal modifier', async ({ page }) => {
        await expect(dz(page, 'card-mini').locator('.dz__dropzone--card-minimal')).toBeVisible();
    });

    test('compact carries dz__dropzone--card-compact', async ({ page }) => {
        await expect(dz(page, 'card-compact').locator('.dz__dropzone--card-compact')).toBeVisible();
    });

    test('big carries dz__dropzone--card-big AND renders the Browse button', async ({ page }) => {
        const big = dz(page, 'card-big');
        await expect(big.locator('.dz__dropzone--card-big')).toBeVisible();
        await expect(big.locator('.dz__card-action')).toHaveText('Browse');
    });
});

test.describe('display-mode shorthand', () => {
    test('list → card + list', async ({ page }) => {
        const d = dz(page, 'dm-list');
        await addNamed(page, 'dm-list', ['a.txt']);
        await expect(d.locator('.dz__dropzone--card')).toBeVisible();
        await expect(d.locator('.dz__file-item--list')).toHaveCount(1);
    });

    test('detailed → card + detailed', async ({ page }) => {
        const d = dz(page, 'dm-detailed');
        await addNamed(page, 'dm-detailed', ['a.txt']);
        await expect(d.locator('.dz__file-item--detailed')).toHaveCount(1);
    });

    test('grid → card + grid (image preview tiles)', async ({ page }) => {
        const d = dz(page, 'dm-grid');
        await page.evaluate(() => {
            const dz = document.getElementById('dm-grid') as any;
            dz.addFiles([new File([new Uint8Array(8)], 'p.png', { type: 'image/png' })]);
        });
        await expect(d.locator('.dz__preview-item')).toHaveCount(1);
    });

    test('compact → card + popover (summary line)', async ({ page }) => {
        const d = dz(page, 'dm-compact');
        await addNamed(page, 'dm-compact', ['a.txt', 'b.txt']);
        await expect(d.locator('.dz__summary-line')).toBeVisible();
    });
});

test.describe('orthogonal attr wins over display-mode shorthand', () => {
    test('display-mode="grid" + list-appearance="badges" → renders badges, not grid', async ({ page }) => {
        const d = dz(page, 'override');
        await addNamed(page, 'override', ['a.txt', 'b.txt']);
        // The explicit list-appearance wins
        await expect(d.locator('.dz__badge')).toHaveCount(2);
        // ...and grid does NOT render
        await expect(d.locator('.dz__preview-item')).toHaveCount(0);
    });
});

test.describe('button selector count badge', () => {
    test('badge appears after files are added and reflects the count', async ({ page }) => {
        const b = dz(page, 'button-badge');
        // Empty state: no badge
        await expect(b.locator('.dz__button-badge')).toHaveCount(0);

        await addNamed(page, 'button-badge', ['a.txt', 'b.txt', 'c.txt']);
        await expect(b.locator('.dz__button-badge')).toHaveText('3');
    });
});

test.describe('minimal selector count badge', () => {
    test('badge appears after add, follows removals, disappears when empty', async ({ page }) => {
        const m = dz(page, 'minimal-badge');
        await expect(m.locator('.dz__minimal-badge')).toHaveCount(0);
        await addNamed(page, 'minimal-badge', ['a.txt', 'b.txt']);
        await expect(m.locator('.dz__minimal-badge')).toHaveText('2');
        await m.evaluate((el: any) => el.removeFile(el.files[0].id));
        await expect(m.locator('.dz__minimal-badge')).toHaveText('1');
        await m.evaluate((el: any) => el.clear());
        await expect(m.locator('.dz__minimal-badge')).toHaveCount(0);
    });
});
