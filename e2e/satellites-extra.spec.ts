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
        const chip = page.locator('#ind').locator('.dz__indicator-chip');
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
    test('card: labels.prompt replaces the prompt, labels.hint renders', async ({ page }) => {
        const card = dz(page, 'pick-card').locator('.dz__dropzone--card');
        await expect(card.locator('.dz__dropzone-text')).toHaveText('Drop invoices');
        await expect(card.locator('.dz__dropzone-hint')).toHaveText('PDF only');
    });

    test('selector-appearance="button" + label; drops on it reach the store', async ({ page }) => {
        await expect(dz(page, 'pick-btn').locator('.dz__button-label')).toHaveText('Browse');
        await dragFiles(dz(page, 'pick-btn').locator('.dz__dropzone'), 'drop', ['b.txt']);
        await expect.poll(() => satFiles(page)).toEqual(['b.txt']);
        // Count badge on every button picker bound to the store.
        await expect(dz(page, 'pick-btn').locator('.dz__button-badge')).toHaveText('1');
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
    test('labels.noData renders while the store is empty, rows replace it', async ({ page }) => {
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

test.describe('<web-dropzone-indicator> drawer — core overlay tree', () => {
    const chip = (page: Page) => dz(page, 'ind-left').locator('.dz__indicator-chip');
    const closeBtn = (page: Page) => dz(page, 'ind-left').locator('.dz__indicator-drawer-close');
    const isOpen = (page: Page, open: boolean) =>
        expect(dz(page, 'ind-left')).toHaveAttribute('data-drawer-open', String(open));

    test('the chip carries aria-expanded; opening moves focus into the drawer', async ({ page }) => {
        await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
        await chip(page).click();
        await isOpen(page, true);
        await expect(chip(page)).toHaveAttribute('aria-expanded', 'true');
        await expect(closeBtn(page)).toBeFocused();
    });

    test('Escape closes it and focus returns to the chip', async ({ page }) => {
        await chip(page).click();
        await isOpen(page, true);
        await page.keyboard.press('Escape');
        await isOpen(page, false);
        await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
        await expect(chip(page)).toBeFocused();
    });

    test('the Close button returns focus to the chip', async ({ page }) => {
        await chip(page).click();
        await closeBtn(page).click();
        await isOpen(page, false);
        await expect(chip(page)).toBeFocused();
    });

    test('a click outside closes it; a click inside does not', async ({ page }) => {
        await chip(page).click();
        await isOpen(page, true);
        await dz(page, 'ind-left').locator('.dz__indicator-drawer-title').click();
        await isOpen(page, true);
        await page.mouse.click(1300, 500); // the left drawer is min(40rem, 90dvw) wide
        await isOpen(page, false);
        await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
    });

    test('Escape closes the topmost overlay first: one opened from inside the drawer, then the drawer', async ({ page }) => {
        await chip(page).click();
        await isOpen(page, true);
        await dz(page, 'ind-left').evaluate((host) => {
            const trigger = host.shadowRoot!.querySelector('.dz__indicator-drawer-title')!;
            const panel = document.createElement('div');
            document.body.append(panel);
            (window as any).__childClosed = '';
            const child = (window as any).__registerOverlay(
                (reason: string) => { (window as any).__childClosed = reason; },
                undefined,
                { getElement: () => panel, shouldCloseOnEscape: true },
            );
            child.activate({ trigger });
        });
        await page.keyboard.press('Escape');
        await expect.poll(() => page.evaluate(() => (window as any).__childClosed)).toBe('escape');
        await isOpen(page, true);
        await page.keyboard.press('Escape');
        await isOpen(page, false);
    });
});

test.describe('<web-dropzone-indicator> attributes', () => {
    test('position / drawer reflect to data-* on the host', async ({ page }) => {
        await expect(dz(page, 'ind-left')).toHaveAttribute('data-position', 'left');
        await expect(dz(page, 'ind-left')).toHaveAttribute('data-drawer', 'auto');
        await expect(dz(page, 'ind-off')).toHaveAttribute('data-position', 'inline');
        await expect(dz(page, 'ind-off')).toHaveAttribute('data-drawer', 'off');
    });

    test('drawer="auto": the chip is a button that toggles the drawer (title = labels.indicatorTitle)', async ({ page }) => {
        const ind = dz(page, 'ind-left');
        await expect(ind.locator('button.dz__indicator-chip')).toHaveCount(1);
        await expect(ind.locator('.dz__indicator-drawer-title')).toHaveText('Queue');
        await ind.locator('.dz__indicator-chip').click();
        await expect(ind).toHaveAttribute('data-drawer-open', 'true');
        await ind.locator('.dz__indicator-drawer-close').click();
        await expect(ind).toHaveAttribute('data-drawer-open', 'false');
    });

    test('drawer="off": a non-interactive status chip, no drawer', async ({ page }) => {
        const ind = dz(page, 'ind-off');
        await expect(ind.locator('div.dz__indicator-chip[role="status"]')).toHaveCount(1);
        await expect(ind.locator('.dz__indicator-drawer')).toHaveCount(0);
    });

    test('an unknown position is refused (core invalid rule: previous kept, input-rejected); live change applies', async ({ page }) => {
        const rejected = await dz(page, 'ind-left').evaluate((el: any) => {
            const seen: string[] = [];
            el.addEventListener('input-rejected', (e: any) => seen.push(e.detail.configKey));
            el.setAttribute('position', 'diagonal');
            return seen;
        });
        expect(rejected).toEqual(['position']);
        await expect(dz(page, 'ind-left')).toHaveAttribute('position', 'left'); // reflected back
        await expect(dz(page, 'ind-left')).toHaveAttribute('data-position', 'left');
        await dz(page, 'ind-left').evaluate((el) => el.setAttribute('position', 'top'));
        await expect(dz(page, 'ind-left')).toHaveAttribute('data-position', 'top');
        expect(await dz(page, 'ind-left').evaluate((el: any) => el.position)).toBe('top');
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

test.describe('shared loader', () => {
    const ind = (page: Page) => dz(page, 'ind-off');
    const start = (page: Page) => dz(page, 'sat').evaluate((el: any) => { void el.uploadAll(); });

    test('indicator: default .dz__loader in a role=status container; rows: CSS inline loader + aria-busy', async ({ page }) => {
        await addNamed(page, 'sat', ['a.txt']);
        await start(page);
        await expect.poll(() => pendingNames(page)).toContain('a.txt');

        const container = ind(page).locator('.dz__indicator-loader');
        await expect(container).toHaveAttribute('role', 'status');
        await expect(container).toHaveAttribute('aria-label', 'Uploading');
        const spin = container.locator('.dz__loader');
        await expect(spin).toHaveCount(1);
        const anim = await spin.evaluate((s) => {
            const cs = getComputedStyle(s);
            return { name: cs.animationName, mask: cs.maskImage || (cs as any).webkitMaskImage };
        });
        expect(anim.name).toBe('dz-loader-spin');
        expect(anim.mask).toContain('data:image/svg+xml');

        // The per-row loader is CSS only: no role=status, the row is aria-busy.
        const row = dz(page, 'list-empty').locator('.dz__file-item');
        await expect(row).toHaveAttribute('aria-busy', 'true');
        await expect(row.locator('.dz__loader--inline')).toHaveCount(1);
        await expect(row.locator('[role="status"]')).toHaveCount(0);

        await resolveUpload(page, 'a.txt');
        await expect(ind(page).locator('.dz__indicator-loader')).toHaveCount(0);
        await expect(row).not.toHaveAttribute('aria-busy', /./);
        await expect(row.locator('.dz__loader')).toHaveCount(0);
    });

    test('window.components.renderLoadingCallback replaces the default upload loader', async ({ page }) => {
        await page.evaluate(() => {
            (window as any).components.renderLoadingCallback = ({ component, context, containerElement }: any) => {
                containerElement.innerHTML = `<i class="page-dots" data-component="${component}" data-context="${context}"></i>`;
            };
        });
        await addNamed(page, 'sat', ['a.txt']);
        await start(page);
        await expect.poll(() => pendingNames(page)).toContain('a.txt');
        const dots = ind(page).locator('.dz__indicator-loader .page-dots');
        await expect(dots).toHaveAttribute('data-component', 'web-dropzone-indicator');
        await expect(dots).toHaveAttribute('data-context', 'upload');
        await expect(ind(page).locator('.dz__indicator-loader .dz__loader')).toHaveCount(0);
    });

    test("the store's renderLoadingCallback beats the page hook; the cleanup runs when the upload ends", async ({ page }) => {
        await page.evaluate(() => {
            (window as any).__cleanups = 0;
            (window as any).components.renderLoadingCallback = ({ containerElement }: any) => {
                containerElement.innerHTML = '<i class="page-dots"></i>';
            };
        });
        await dz(page, 'sat').evaluate((el: any) => {
            el.renderLoadingCallback = ({ containerElement }: any) => {
                const b = document.createElement('b');
                b.className = 'own-loader';
                containerElement.appendChild(b);
                return () => { (window as any).__cleanups++; };
            };
        });
        await addNamed(page, 'sat', ['a.txt']);
        await start(page);
        await expect.poll(() => pendingNames(page)).toContain('a.txt');
        await expect(ind(page).locator('.dz__indicator-loader .own-loader')).toHaveCount(1);
        await expect(ind(page).locator('.page-dots')).toHaveCount(0);

        await resolveUpload(page, 'a.txt');
        await expect(ind(page).locator('.own-loader')).toHaveCount(0);
        // Both indicators bound to #sat drew (and released) one loader each.
        await expect.poll(() => page.evaluate(() => (window as any).__cleanups)).toBe(2);
    });
});

test.describe('satellite labels', () => {
    test('a satellite inherits the store labels; its own labels win per key; live property change re-renders', async ({ page }) => {
        // Store labels → every satellite (here: the list's empty text).
        await dz(page, 'sat').evaluate(async (el: any) => { el.labels = { noData: 'Store empty', prompt: 'Store prompt' }; await el.whenSettled(); });
        await expect(dz(page, 'list-empty').locator('.dz__empty')).toHaveText('Nothing yet'); // own key wins
        await dz(page, 'list-empty').evaluate((el) => el.removeAttribute('labels'));
        await expect(dz(page, 'list-empty').locator('.dz__empty')).toHaveText('Store empty');
        // The card keeps its own prompt; the hint key is its own too.
        await expect(dz(page, 'pick-card').locator('.dz__dropzone-text')).toHaveText('Drop invoices');
        await dz(page, 'pick-card').evaluate((el: any) => { el.labels = { hint: 'Only PDF' }; });
        await expect(dz(page, 'pick-card').locator('.dz__dropzone-text')).toHaveText('Store prompt');
        await expect(dz(page, 'pick-card').locator('.dz__dropzone-hint')).toHaveText('Only PDF');
    });

    test('a malformed labels attribute keeps the previous value', async ({ page }) => {
        await dz(page, 'list-empty').evaluate((el) => el.setAttribute('labels', '{oops'));
        await expect(dz(page, 'list-empty').locator('.dz__empty')).toHaveText('Nothing yet');
    });
});
