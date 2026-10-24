import { test, expect, addNamed, dz, pendingNames, resolveUpload, dragFiles, type Page } from './fixtures';

/**
 * Section 18 — indicator + progress satellites.
 *
 * Fixture: test/satellites-extra.html. Two headless stores each
 * paired with one of the read-only satellites:
 *
 *   - <web-dropzone-indicator for=> renders a status chip driven by
 *     the store's per-status aggregate.
 *   - <web-dropzone-progress for=> reflects getOverallProgress
 *     (counts + percent).
 *
 * Both satellites should resolve their `for=` reference, bind to the
 * store on `ready`, and reflect every change as files are
 * added / progressed / completed.
 */

const PAGE = '/test/satellites-extra.html';

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function');
});

test.describe('<web-dropzone-indicator>', () => {
    test('binds to its for= store after ready', async ({ page }) => {
        await expect.poll(() => page.evaluate(() => {
            const el = document.querySelector('#ind') as any;
            return !!el?.controller;
        })).toBe(true);
    });

    test('renders a chip surface inside its shadow root after binding', async ({ page }) => {
        await addNamed(page, 'store-ind', ['a.txt', 'b.txt']);
        // The indicator's shadow renders an inner chip surface; locate one
        // of its known structural classes.
        const chip = page.locator('#ind').locator('.dz__indicator__chip');
        await expect(chip).toBeVisible();
    });
});

test.describe('<web-dropzone-progress>', () => {
    test('binds to its for= store after ready', async ({ page }) => {
        await expect.poll(() => page.evaluate(() => {
            const el = document.querySelector('#prog') as any;
            return !!el?.controller;
        })).toBe(true);
    });

    test('renders a progress surface inside its shadow root after binding', async ({ page }) => {
        await addNamed(page, 'store-prog', ['p1.txt', 'p2.txt']);
        // The progress satellite renders an outer container after binding —
        // locate its top-level structural class.
        const surface = page.locator('#prog').locator('.dz__overall-progress');
        await expect(surface).toBeVisible();
    });
});

// ── configured satellites on one headless store (#sat) ──────────────────────

const satFiles = (page: Page) => dz(page, 'sat').evaluate((el: any) => el.files.map((f: any) => f.name));

test.describe('<web-dropzone-picker> attributes', () => {
    test('card: label replaces the prompt, hint renders', async ({ page }) => {
        const card = dz(page, 'pick-card').locator('.dz__dropzone--card');
        await expect(card.locator('.dz__dropzone__text')).toHaveText('Drop invoices');
        await expect(card.locator('.dz__dropzone__hint')).toHaveText('PDF only');
    });

    test('selector-appearance="button" + label; drops on it reach the store', async ({ page }) => {
        await expect(dz(page, 'pick-btn').locator('.dz__button__label')).toHaveText('Browse');
        await dragFiles(dz(page, 'pick-btn').locator('.dz__dropzone'), 'drop', ['b.txt']);
        await expect.poll(() => satFiles(page)).toEqual(['b.txt']);
        // Count badge on every button picker bound to the store.
        await expect(dz(page, 'pick-btn').locator('.dz__button__badge')).toHaveText('1');
    });

    test('disabled picker: button disabled, drops ignored — the store and other pickers stay enabled', async ({ page }) => {
        await expect(dz(page, 'pick-dis').locator('.dz__button')).toBeDisabled();
        await dragFiles(dz(page, 'pick-dis').locator('.dz__dropzone'), 'drop', ['x.txt']);
        await page.waitForTimeout(100);
        expect(await satFiles(page)).toEqual([]);
        await expect(dz(page, 'pick-btn').locator('.dz__button')).toBeEnabled();
    });

    test('inside="true" + a nested list: the card switches to the files-inside layout and shows the rows', async ({ page }) => {
        await expect(dz(page, 'pick-inside').locator('.dz__dropzone--card')).toHaveClass(/dz__dropzone--files-inside/);
        await addNamed(page, 'sat', ['in.txt']);
        await expect(dz(page, 'list-nested').locator('.dz__files-inside')).toHaveCount(1);
        await expect(dz(page, 'list-nested').locator('.dz__file-item')).toHaveCount(1);
        await expect(dz(page, 'pick-inside').locator('.dz__dropzone--card')).toHaveClass(/dz__dropzone--has-files/);
    });
});

test.describe('<web-dropzone-list> attributes', () => {
    test('empty-message renders while the store is empty, rows replace it', async ({ page }) => {
        await expect(dz(page, 'list-empty').locator('.dz__empty')).toHaveText('Nothing yet');
        await addNamed(page, 'sat', ['a.txt']);
        await expect(dz(page, 'list-empty').locator('.dz__empty')).toHaveCount(0);
        await expect(dz(page, 'list-empty').locator('.dz__file-item--list')).toHaveCount(1);
    });

    test('list-appearance="badges" renders badges; a live change switches the layout', async ({ page }) => {
        await addNamed(page, 'sat', ['a.txt', 'b.txt']);
        await expect(dz(page, 'list-badges').locator('.dz__badge')).toHaveCount(2);
        await dz(page, 'list-badges').evaluate((el) => el.setAttribute('list-appearance', 'detailed'));
        await expect(dz(page, 'list-badges').locator('.dz__file-item--detailed')).toHaveCount(2);
    });
});

test.describe('<web-dropzone-indicator> attributes', () => {
    test('position / drawer reflect to data-* on the host', async ({ page }) => {
        await expect(dz(page, 'ind-left')).toHaveAttribute('data-position', 'left');
        await expect(dz(page, 'ind-left')).toHaveAttribute('data-drawer', 'auto');
        await expect(dz(page, 'ind-off')).toHaveAttribute('data-position', 'inline');
        await expect(dz(page, 'ind-off')).toHaveAttribute('data-drawer', 'off');
    });

    test('drawer="auto": the chip is a button that toggles the drawer (title = label)', async ({ page }) => {
        const ind = dz(page, 'ind-left');
        await expect(ind.locator('button.dz__indicator__chip')).toHaveCount(1);
        await expect(ind.locator('.dz__indicator__drawer-title')).toHaveText('Queue');
        await ind.locator('.dz__indicator__chip').click();
        await expect(ind).toHaveAttribute('data-drawer-open', 'true');
        await ind.locator('.dz__indicator__drawer-close').click();
        await expect(ind).toHaveAttribute('data-drawer-open', 'false');
    });

    test('drawer="off": a non-interactive status chip, no drawer', async ({ page }) => {
        const ind = dz(page, 'ind-off');
        await expect(ind.locator('div.dz__indicator__chip[role="status"]')).toHaveCount(1);
        await expect(ind.locator('.dz__indicator__drawer')).toHaveCount(0);
    });

    test('an unknown position falls back to "right"; live change applies', async ({ page }) => {
        await dz(page, 'ind-left').evaluate((el) => el.setAttribute('position', 'diagonal'));
        await expect(dz(page, 'ind-left')).toHaveAttribute('data-position', 'right');
        await dz(page, 'ind-left').evaluate((el) => el.setAttribute('position', 'top'));
        await expect(dz(page, 'ind-left')).toHaveAttribute('data-position', 'top');
    });
});

test.describe('<web-dropzone-progress> data-status', () => {
    const prog = (page: Page) => dz(page, 'prog-sat');
    const start = (page: Page) => dz(page, 'sat').evaluate((el: any) => { void el.uploadAll(); });

    test('idle → data-empty, no data-status', async ({ page }) => {
        await expect(prog(page)).toHaveAttribute('data-empty', 'true');
        await expect(prog(page)).not.toHaveAttribute('data-status', /./);
    });

    test('uploading → paused → error → complete follow the aggregate', async ({ page }) => {
        await addNamed(page, 'sat', ['a.txt']);
        await start(page);
        await expect.poll(() => pendingNames(page)).toContain('a.txt');
        await expect(prog(page)).toHaveAttribute('data-status', 'uploading');
        await expect(prog(page)).not.toHaveAttribute('data-empty', /./);

        await dz(page, 'sat').evaluate((el: any) => el.pauseFile(el.files[0].id));
        await expect(prog(page)).toHaveAttribute('data-status', 'paused');

        await dz(page, 'sat').evaluate((el: any) => { void el.resumeFile(el.files[0].id); });
        await expect.poll(() => pendingNames(page)).toContain('a.txt');
        await resolveUpload(page, 'a.txt', 'fail');
        await expect(prog(page)).toHaveAttribute('data-status', 'error');

        await dz(page, 'sat').evaluate((el: any) => el.retryFile(el.files[0].id));
        await expect.poll(() => pendingNames(page)).toContain('a.txt');
        await resolveUpload(page, 'a.txt');
        await expect(prog(page)).toHaveAttribute('data-status', 'complete');
    });
});
