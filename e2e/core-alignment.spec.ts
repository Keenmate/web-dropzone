/**
 * Core alignment (web-components-core rc20 / rc21): custom CSS through core
 * `createCustomStyles()` (page layer + instance layer), core
 * `registerComponent()` for every tag (registry entries, logger bundle, no
 * load-time silence), the satellites on `BlissElement` (inputs, `for` re-bind,
 * `ready`, refused values), the disabled / read-only pair with native
 * semantics (SPEC §6.4), and `toBytes()` sizes.
 *
 * Fixture: test/core-alignment.html.
 */
import { test, expect, dz, addNamed } from './fixtures';
import type { Page } from '@playwright/test';

const PAGE = '/test/core-alignment.html';

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() =>
        ['css-page', 'css-inst', 'css-cb', 'ro', 'dis', 'store-a', 'store-b', 'pk', 'ls', 'ind', 'prog', 'sizes']
            .every((id) => (document.getElementById(id) as any)?.isReady)
    );
});

/** Outline colour of the store's own container (`.dz__host` in ITS shadow root, not a satellite's). */
const outline = (page: Page, id: string) =>
    dz(page, id).evaluate((el) => getComputedStyle(Array.from(el.shadowRoot!.children).find((c) => c.classList.contains('dz__host'))!).outlineColor);

test.describe('custom CSS (core createCustomStyles, rulebook C-CA-15)', () => {
    test('the page-wide customStyles styles every dropzone; the instance layer comes after it', async ({ page }) => {
        expect(await outline(page, 'css-page')).toBe('rgb(255, 0, 0)');
        expect(await outline(page, 'css-inst')).toBe('rgb(0, 128, 0)');   // custom-styles attribute wins over the page layer
        expect(await outline(page, 'css-cb')).toBe('rgb(0, 0, 255)');     // getCustomStylesCallback wins over custom-styles
        // The page layer still applies under the instance layer (letter-spacing only comes from it).
        const spacing = await dz(page, 'css-inst').evaluate((el) => getComputedStyle(Array.from(el.shadowRoot!.children).find((c) => c.classList.contains('dz__host'))!).letterSpacing);
        expect(spacing).toBe('3px');
        // One slot per layer, with the component's class.
        const classes = await dz(page, 'css-inst').evaluate((el) =>
            Array.from(el.shadowRoot!.querySelectorAll('style')).map((s) => s.className).filter((c) => c.startsWith('dz-custom-styles')));
        expect(classes.sort()).toEqual(['dz-custom-styles', 'dz-custom-styles--page']);
    });

    test('customStyles is live on the property and the attribute; removing it falls back to the page layer', async ({ page }) => {
        await dz(page, 'css-inst').evaluate(async (el: any) => {
            el.customStyles = '.dz__host { outline-color: rgb(1, 2, 3); }';
            await el.whenSettled();
        });
        expect(await outline(page, 'css-inst')).toBe('rgb(1, 2, 3)');
        await dz(page, 'css-inst').evaluate(async (el: any) => { el.removeAttribute('custom-styles'); await el.whenSettled(); });
        expect(await outline(page, 'css-inst')).toBe('rgb(255, 0, 0)');
    });

    test('satellites take custom CSS too: their own page layer per tag and their own custom-styles', async ({ page }) => {
        const pickerOutline = (id: string) => dz(page, id).evaluate((el) =>
            getComputedStyle(Array.from(el.shadowRoot!.children).find((c) => c.classList.contains('dz__host'))!).outlineColor);
        await page.evaluate(() => {
            (window as any).components['web-dropzone-picker'].customStyles = '.dz__host { outline: 2px solid rgb(7, 7, 7); }';
        });
        await expect.poll(() => pickerOutline('pk')).toBe('rgb(7, 7, 7)');
        await dz(page, 'pk').evaluate(async (el: any) => {
            el.setAttribute('custom-styles', '.dz__host { outline-color: rgb(8, 8, 8); }');
            await el.whenSettled();
        });
        expect(await pickerOutline('pk')).toBe('rgb(8, 8, 8)');
    });

    test('assigning the page layer later restyles live instances', async ({ page }) => {
        await page.evaluate(() => {
            (window as any).components['web-dropzone'].customStyles = '.dz__host { outline: 3px solid rgb(9, 9, 9); }';
        });
        await expect.poll(() => outline(page, 'css-page')).toBe('rgb(9, 9, 9)');
    });
});

test.describe('registration (core registerComponent, rule 8)', () => {
    test('every tag has a registry entry with core logging controls and live instances', async ({ page }) => {
        const info = await page.evaluate(() => {
            const c = (window as any).components;
            return ['web-dropzone', 'web-dropzone-picker', 'web-dropzone-list', 'web-dropzone-indicator', 'web-dropzone-progress'].map((tag) => ({
                tag,
                hasReset: typeof c[tag]?.logging?.resetLogging,
                instances: c[tag]?.getInstances().length,
                defined: !!customElements.get(tag),
            }));
        });
        // Counts include the satellites a store mounts itself (display-mode="list" → picker + list + progress).
        expect(info).toEqual([
            { tag: 'web-dropzone', hasReset: 'function', instances: 8, defined: true },
            { tag: 'web-dropzone-picker', hasReset: 'function', instances: 9, defined: true },
            { tag: 'web-dropzone-list', hasReset: 'function', instances: 8, defined: true },
            { tag: 'web-dropzone-indicator', hasReset: 'function', instances: 1, defined: true },
            { tag: 'web-dropzone-progress', hasReset: 'function', instances: 7, defined: true },
        ]);
    });

    test('the bundle prints warnings by default (not silenced at load) and follows resetLogging()', async ({ page }) => {
        const warnings: string[] = [];
        page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
        await dz(page, 'sizes').evaluate((el) => el.setAttribute('max-file-size', 'lots'));
        await expect.poll(() => warnings.some((w) => w.includes('max-file-size') && w.includes('DROPZONE'))).toBe(true);
        const count = warnings.length;
        await page.evaluate(() => (window as any).components['web-dropzone'].logging.disableLogging());
        await dz(page, 'sizes').evaluate((el) => el.setAttribute('max-file-size', 'more'));
        await page.evaluate(() => (window as any).components['web-dropzone'].logging.resetLogging());
        await dz(page, 'sizes').evaluate((el) => el.setAttribute('max-file-size', 'most'));
        await expect.poll(() => warnings.length).toBe(count + 1); // silenced once, back after reset
    });
});

test.describe('sizes (core toBytes)', () => {
    test('binary units; an invalid size is refused (input-rejected, previous value kept)', async ({ page }) => {
        const r = await dz(page, 'sizes').evaluate((el: any) => {
            const rejected: string[] = [];
            el.addEventListener('input-rejected', (e: any) => rejected.push(e.detail.configKey));
            const start = el.maxFileSize;
            el.setAttribute('max-file-size', '1.5k');
            const k = el.maxFileSize;
            el.setAttribute('max-file-size', 'big');
            return { start, k, after: el.maxFileSize, rejected };
        });
        expect(r).toEqual({ start: 2 * 1024 * 1024, k: 1536, after: 1536, rejected: ['maxFileSize'] });
    });
});

test.describe('read-only / disabled card (SPEC §6.4 native semantics)', () => {
    test('read-only: the card input stays focusable, is aria-disabled and never opens the file dialog', async ({ page }) => {
        const input = dz(page, 'ro').locator('input.dz__dropzone-input');
        await expect(input).not.toHaveAttribute('disabled', /.*/);
        await expect(input).toHaveAttribute('aria-disabled', 'true');
        await page.locator('#before-ro').focus();
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
            let a: Element | null = document.activeElement;
            while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
            return a?.className ?? '';
        });
        expect(focused).toContain('dz__dropzone-input');
        let opened = false;
        page.on('filechooser', () => { opened = true; });
        await page.keyboard.press('Space');
        await dz(page, 'ro').locator('.dz__dropzone').click();
        await page.waitForTimeout(300);
        expect(opened).toBe(false);
    });

    test('disabled: the card input is disabled (not focusable)', async ({ page }) => {
        await expect(dz(page, 'dis').locator('input.dz__dropzone-input')).toHaveAttribute('disabled', '');
    });
});

test.describe('satellites on BlissElement', () => {
    test('they announce ready, mirror motion, and take the theme context from core', async ({ page }) => {
        for (const id of ['pk', 'ls', 'ind', 'prog']) {
            await expect(dz(page, id)).toHaveAttribute('ready', '');
        }
        await dz(page, 'pk').evaluate((el: any) => { el.motion = 'none'; });
        await expect(dz(page, 'pk')).toHaveAttribute('data-motion', 'none');
    });

    test('changing `for` (htmlFor) re-binds the picker to another store', async ({ page }) => {
        expect(await dz(page, 'pk').evaluate((el: any) => el.htmlFor)).toBe('store-a');
        await dz(page, 'pk').evaluate(async (el: any) => { el.htmlFor = 'store-b'; await el.whenSettled(); });
        await expect(dz(page, 'pk')).toHaveAttribute('for', 'store-b');
        const target = await dz(page, 'pk').evaluate((el: any) => el.controller === (document.getElementById('store-b') as any).controller);
        expect(target).toBe(true);
    });

    test('an unknown enum value is refused with input-rejected; the previous value stays', async ({ page }) => {
        const r = await dz(page, 'ls').evaluate((el: any) => {
            const seen: string[] = [];
            el.addEventListener('input-rejected', (e: any) => seen.push(e.detail.configKey));
            el.setAttribute('list-appearance', 'grid');
            el.setAttribute('list-appearance', 'mosaic');
            return { seen, value: el.listAppearance };
        });
        expect(r).toEqual({ seen: ['listAppearance'], value: 'grid' });
    });

    test('picker readonly: focusable, aria-disabled, adds nothing; disabled is the presence attribute', async ({ page }) => {
        const ro = dz(page, 'pk-ro');
        await expect(ro.locator('input.dz__dropzone-input')).toHaveAttribute('aria-disabled', 'true');
        await expect(ro.locator('input.dz__dropzone-input')).not.toHaveAttribute('disabled', /.*/);
        await expect(ro.locator('.dz__dropzone')).toHaveClass(/dz__dropzone--readonly/);
        // disabled="false" is still disabled (native presence rule)
        expect(await dz(page, 'pk-dis').evaluate((el: any) => el.isDisabled)).toBe(true);
        await expect(dz(page, 'pk-dis').locator('input.dz__dropzone-input')).toHaveAttribute('disabled', '');
        // the store stays empty after a click on the read-only picker
        await ro.locator('.dz__dropzone').click();
        expect(await dz(page, 'store-a').evaluate((el: any) => el.files.length)).toBe(0);
    });

    test('a list follows its store', async ({ page }) => {
        await addNamed(page, 'store-a', ['x.txt']);
        await expect(dz(page, 'ls').locator('.dz__file-item')).toHaveCount(1);
    });
});
