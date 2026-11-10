import { test, expect, dz, dragFiles, trackFileChoosers, type Page } from './fixtures';

/**
 * Disabled state: no user path (click → file dialog, drop, overlay) adds files.
 *
 * Fixture: test/disabled.html — `#dis` (card), `#dis-btn` (button),
 * `#dis-ov` (overlay-target), `#in-fs` (inside a <fieldset> the spec disables).
 * Programmatic `addFiles` on a disabled host is intentionally still allowed
 * (theming.spec.ts covers that).
 */

const PAGE = '/test/disabled.html';

const card = (page: Page, id: string) => page.locator(`#${id} .dz__dropzone`);
const count = (page: Page, id: string) => dz(page, id).evaluate((el: any) => el.files.length);

let choosers: () => number;

test.beforeEach(async ({ page }) => {
    choosers = trackFileChoosers(page);
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test.describe('disabled host', () => {
    test('el.isDisabled reflects the attribute and the surface carries the disabled modifier', async ({ page }) => {
        expect(await dz(page, 'dis').evaluate((el: any) => el.isDisabled)).toBe(true);
        await expect(card(page, 'dis')).toHaveClass(/dz__dropzone--disabled/);
        await expect(page.locator('#dis input[type="file"]')).toBeDisabled();
        await expect(page.locator('#dis-btn .dz__button')).toBeDisabled();
    });

    test('clicking the card does not open the file dialog', async ({ page }) => {
        await card(page, 'dis').click({ force: true });
        await page.waitForTimeout(250);
        expect(choosers()).toBe(0);
    });

    test('dropping files adds nothing and does not light up the card', async ({ page }) => {
        await dragFiles(card(page, 'dis'), 'dragenter');
        await expect(card(page, 'dis')).not.toHaveClass(/dz__dropzone--active/);
        await dragFiles(card(page, 'dis'), 'drop', ['a.txt']);
        await dragFiles(card(page, 'dis-btn'), 'drop', ['b.txt']);
        await page.waitForTimeout(100);
        expect(await count(page, 'dis')).toBe(0);
        expect(await count(page, 'dis-btn')).toBe(0);
    });

    test('a file drag does not mount the overlay', async ({ page }) => {
        await dragFiles(page.locator('body'), 'dragenter');
        await page.waitForTimeout(100);
        await expect(page.locator('.dz__overlay')).toHaveCount(0);
    });
});

test.describe('reactive toggle', () => {
    test('el.isDisabled = false enables click + drop; = true disables them again', async ({ page }) => {
        await dz(page, 'dis').evaluate(async (el: any) => { el.isDisabled = false; await el.whenSettled(); });
        await expect(dz(page, 'dis')).not.toHaveAttribute('disabled');
        await expect(card(page, 'dis')).not.toHaveClass(/dz__dropzone--disabled/);
        await card(page, 'dis').click();
        await expect.poll(choosers).toBe(1);
        await dragFiles(card(page, 'dis'), 'drop', ['a.txt']);
        await expect.poll(() => count(page, 'dis')).toBe(1);

        await dz(page, 'dis').evaluate(async (el: any) => { el.isDisabled = true; await el.whenSettled(); });
        await expect(card(page, 'dis')).toHaveClass(/dz__dropzone--disabled/);
        await dragFiles(card(page, 'dis'), 'drop', ['b.txt']);
        await page.waitForTimeout(100);
        expect(await count(page, 'dis')).toBe(1);
    });

    test('removing the disabled attribute enables drops', async ({ page }) => {
        await dz(page, 'dis-btn').evaluate(async (el: any) => { el.removeAttribute('disabled'); await el.whenSettled(); });
        await expect(page.locator('#dis-btn .dz__button')).toBeEnabled();
        await dragFiles(card(page, 'dis-btn'), 'drop', ['b.txt']);
        await expect.poll(() => count(page, 'dis-btn')).toBe(1);
    });

    test('enabling an overlay dropzone lets the overlay mount', async ({ page }) => {
        await dz(page, 'dis-ov').evaluate(async (el: any) => { el.isDisabled = false; await el.whenSettled(); });
        await dragFiles(page.locator('body'), 'dragenter');
        await expect(page.locator('.dz__overlay')).toHaveCount(1);
    });
});

test.describe('<fieldset disabled>', () => {
    test('an enabled fieldset leaves the dropzone usable (control)', async ({ page }) => {
        await dragFiles(card(page, 'in-fs'), 'drop', ['a.txt']);
        await expect.poll(() => count(page, 'in-fs')).toBe(1);
    });

    test('a disabled fieldset disables the dropzone (drop adds nothing, :disabled matches)', async ({ page }) => {
        await page.locator('#fs').evaluate((fs: HTMLFieldSetElement) => { fs.disabled = true; });
        // Form-associated custom elements match :disabled via the fieldset natively.
        expect(await dz(page, 'in-fs').evaluate((el) => el.matches(':disabled'))).toBe(true);
        await dragFiles(card(page, 'in-fs'), 'drop', ['a.txt']);
        await page.waitForTimeout(150);
        expect(await count(page, 'in-fs')).toBe(0);
    });

    test('re-enabling the fieldset re-enables the dropzone; el.isDisabled reports the author value', async ({ page }) => {
        await page.locator('#fs').evaluate((fs: HTMLFieldSetElement) => { fs.disabled = true; });
        expect(await dz(page, 'in-fs').evaluate((el: any) => el.isDisabled)).toBe(false);
        await page.locator('#fs').evaluate((fs: HTMLFieldSetElement) => { fs.disabled = false; });
        await dragFiles(card(page, 'in-fs'), 'drop', ['a.txt']);
        await expect.poll(() => count(page, 'in-fs')).toBe(1);
    });

    test('an author-disabled dropzone stays disabled after the fieldset is re-enabled', async ({ page }) => {
        await dz(page, 'in-fs').evaluate(async (el: any) => { el.isDisabled = true; await el.whenSettled(); });
        await page.locator('#fs').evaluate((fs: HTMLFieldSetElement) => { fs.disabled = true; });
        await page.locator('#fs').evaluate((fs: HTMLFieldSetElement) => { fs.disabled = false; });
        await dragFiles(card(page, 'in-fs'), 'drop', ['a.txt']);
        await page.waitForTimeout(150);
        expect(await count(page, 'in-fs')).toBe(0);
        expect(await dz(page, 'in-fs').evaluate((el: any) => el.isDisabled)).toBe(true);
    });

    test('removing the author disabled while the fieldset is disabled keeps it disabled', async ({ page }) => {
        await page.locator('#fs').evaluate((fs: HTMLFieldSetElement) => { fs.disabled = true; });
        await dz(page, 'in-fs').evaluate(async (el: any) => { el.isDisabled = true; await el.whenSettled(); el.isDisabled = false; await el.whenSettled(); });
        await dragFiles(card(page, 'in-fs'), 'drop', ['a.txt']);
        await page.waitForTimeout(150);
        expect(await count(page, 'in-fs')).toBe(0);
    });
});

test.describe('readonly host (C5)', () => {
    test('no user add (click / drop), not greyed, not disabled', async ({ page }) => {
        await expect(dz(page, 'ro')).toHaveAttribute('readonly', '');
        await expect(card(page, 'ro')).toHaveClass(/dz__dropzone--readonly/);
        await expect(card(page, 'ro')).not.toHaveClass(/dz__dropzone--disabled/);
        await card(page, 'ro').click({ force: true });
        await dragFiles(card(page, 'ro'), 'drop', ['a.txt']);
        await page.waitForTimeout(100);
        expect(choosers()).toBe(0);
        expect(await count(page, 'ro')).toBe(0);
    });

    test('programmatic files show without a Remove button and ARE submitted with the form', async ({ page }) => {
        await dz(page, 'ro').evaluate((el: any) => el.addFiles([new File(['x'], 'r.txt', { type: 'text/plain' })]));
        await expect.poll(() => count(page, 'ro')).toBe(1);
        await expect(page.locator('#ro .dz__file-item-remove')).toHaveClass(/--hidden/);
        const submitted = await page.locator('#ro-form').evaluate((form: HTMLFormElement) =>
            new FormData(form).getAll('docs').map((f: any) => f.name));
        expect(submitted).toEqual(['r.txt']);
    });

    test('el.isReadonly = false unlocks adding; the attribute follows (reflected)', async ({ page }) => {
        await dz(page, 'ro').evaluate(async (el: any) => { el.isReadonly = false; await el.whenSettled(); });
        await expect(dz(page, 'ro')).not.toHaveAttribute('readonly');
        await dragFiles(card(page, 'ro'), 'drop', ['b.txt']);
        await expect.poll(() => count(page, 'ro')).toBe(1);
    });
});

/** Every button / role=button the element renders (its shadow root and the satellites inside it). */
function controlStates(page: Page, id: string) {
    return dz(page, id).evaluate((host) => {
        const out: string[] = [];
        const walk = (root: ParentNode) => {
            for (const n of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
                if (n.matches('button, [role="button"]') && n.getAttribute('aria-hidden') !== 'true') {
                    const isOff = n instanceof HTMLButtonElement ? n.disabled : n.getAttribute('aria-disabled') === 'true' && n.tabIndex < 0;
                    out.push(`${n.dataset.dzAction || n.className.split(' ')[0]}:${isOff ? 'off' : 'on'}`);
                }
                if (n.shadowRoot) walk(n.shadowRoot);
            }
        };
        walk(host.shadowRoot!);
        return out;
    });
}

test.describe('disabled store with files (SPEC §6.4: no interaction, not focusable)', () => {
    const IDS = ['dis-files', 'dis-pop', 'dis-store'];
    const setDisabled = (page: Page, isDisabled: boolean) => page.evaluate(async ({ ids, isDisabled }) => {
        for (const id of ids) {
            const el = document.getElementById(id) as any;
            el.isDisabled = isDisabled;
            await el.whenSettled();
        }
    }, { ids: IDS, isDisabled });

    test.beforeEach(async ({ page }) => {
        await page.waitForFunction((ids) => ids.every((id) => (document.getElementById(id) as any)?.isReady), [...IDS, 'dis-ls', 'dis-prog', 'dis-ind']);
        await page.evaluate((ids) => {
            for (const id of ids) (document.getElementById(id) as any).addFiles([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]);
        }, IDS);
        await expect(dz(page, 'dis-ls').locator('[data-dz-action="remove"]')).toHaveCount(1); // capped at 1 row
        await expect(dz(page, 'dis-prog').locator('[data-dz-action="cancel-all"]')).toHaveCount(1);
    });

    test('row, toggle, bulk, summary and chip controls are all off — store and satellites; back on when enabled', async ({ page }) => {
        const expected = {
            'dis-files': ['row-action', 'cancel', 'remove', 'toggle-visible', 'pause-all', 'cancel-all'],
            'dis-pop': ['dz__button', 'dz__summary-line', 'pause-all', 'cancel-all'],
            'dis-ls': ['row-action', 'cancel', 'remove', 'toggle-visible'],
            'dis-prog': ['pause-all', 'cancel-all'],
        } as const;
        await setDisabled(page, true);
        for (const [id, names] of Object.entries(expected)) {
            await expect.poll(() => controlStates(page, id)).toEqual(names.map((n) => `${n}:off`));
        }
        await expect(dz(page, 'dis-ind').locator('button.dz__indicator-chip')).toBeDisabled();

        await setDisabled(page, false);
        for (const [id, names] of Object.entries(expected)) {
            await expect.poll(() => controlStates(page, id)).toEqual(names.map((n) => `${n}:on`));
        }
        await expect(dz(page, 'dis-ind').locator('button.dz__indicator-chip')).toBeEnabled();
    });

    test('the row remove (store list and satellite list) removes nothing; calls from code still work', async ({ page }) => {
        await setDisabled(page, true);
        await dz(page, 'dis-files').locator('[data-dz-action="remove"]').click({ force: true });
        await dz(page, 'dis-ls').locator('[data-dz-action="remove"]').click({ force: true });
        await page.waitForTimeout(200);
        // (an uploading row's remove cancels first — the file would sit in `cancelling`)
        const statuses = (id: string) => dz(page, id).evaluate((el: any) => el.files.map((f: any) => f.status));
        expect(await statuses('dis-files')).toEqual(['uploading', 'pending']);
        expect(await statuses('dis-store')).toEqual(['uploading', 'pending']);
        await dz(page, 'dis-store').evaluate(async (el: any) => { await el.removeFile(el.files[0].id); });
        expect(await count(page, 'dis-store')).toBe(1);
    });

    test('a kept rolling front row follows the flip too', async ({ page }) => {
        await dz(page, 'dis-files').evaluate(async (el: any) => { el.listAppearance = 'rolling'; await el.whenSettled(); });
        await expect(dz(page, 'dis-files').locator('.dz__rolling-current [data-dz-action="remove"]')).toBeEnabled();
        await setDisabled(page, true);
        for (const action of ['row-action', 'cancel', 'remove']) {
            await expect(dz(page, 'dis-files').locator(`.dz__rolling-current [data-dz-action="${action}"]`)).toBeDisabled();
        }
        await expect(dz(page, 'dis-files').locator('[data-dz-action="open-queue"]')).toBeDisabled();
    });
});

test.describe('satellites follow their store (SPEC §6.4; only the picker has its own pair)', () => {
    const addTwo = (page: Page, id: string) => dz(page, id).evaluate((el: any) =>
        el.addFiles([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]));

    test.beforeEach(async ({ page }) => {
        await page.waitForFunction((ids) => ids.every((id) => (document.getElementById(id) as any)?.isReady),
            ['fs-store', 'fs-ls', 'fs-prog', 'fs-ind', 'ro-store', 'ro-pk', 'ro-ls', 'ro-prog', 'ro-ind']);
    });

    test('list / progress / indicator have no disabled / readonly of their own', async ({ page }) => {
        for (const id of ['fs-ls', 'fs-prog', 'fs-ind']) {
            expect(await dz(page, id).evaluate((el: any) => ['isDisabled', 'isReadonly'].filter((k) => k in el))).toEqual([]);
        }
    });

    test('a store disabled by its <fieldset> disables the satellites outside it; re-enabling restores them', async ({ page }) => {
        await addTwo(page, 'fs-store');
        await expect(dz(page, 'fs-prog').locator('[data-dz-action="cancel-all"]')).toHaveCount(1);
        const setFieldset = (isDisabled: boolean) => page.locator('#sat-fs').evaluate(async (fs: HTMLFieldSetElement, isDisabled) => {
            fs.disabled = isDisabled;
            await (document.getElementById('fs-store') as any).whenSettled();
        }, isDisabled);

        await setFieldset(true);
        await expect.poll(() => controlStates(page, 'fs-ls')).toEqual(['row-action', 'cancel', 'remove', 'toggle-visible'].map((n) => `${n}:off`));
        await expect.poll(() => controlStates(page, 'fs-prog')).toEqual(['pause-all:off', 'cancel-all:off']);
        await expect(dz(page, 'fs-ind').locator('button.dz__indicator-chip')).toBeDisabled();
        await dz(page, 'fs-ls').locator('[data-dz-action="remove"]').click({ force: true });
        await page.waitForTimeout(150);
        expect(await count(page, 'fs-store')).toBe(2);

        await setFieldset(false);
        await expect.poll(() => controlStates(page, 'fs-ls')).toEqual(['row-action', 'cancel', 'remove', 'toggle-visible'].map((n) => `${n}:on`));
        await expect.poll(() => controlStates(page, 'fs-prog')).toEqual(['pause-all:on', 'cancel-all:on']);
        await expect(dz(page, 'fs-ind').locator('button.dz__indicator-chip')).toBeEnabled();
    });

    test('a read-only store: the list offers no Remove, the picker adds nothing; navigation + upload controls stay on', async ({ page }) => {
        await addTwo(page, 'ro-store');
        await expect(dz(page, 'ro-ls').locator('.dz__file-item')).toHaveCount(1);
        // list: no user removal (hidden), the rest focusable / usable like the store's own list
        await expect(dz(page, 'ro-ls').locator('[data-dz-action="remove"]')).toHaveClass(/--hidden/);
        await dz(page, 'ro-ls').locator('[data-dz-action="remove"]').click({ force: true });
        await page.waitForTimeout(150);
        expect(await count(page, 'ro-store')).toBe(2);
        await expect(dz(page, 'ro-ls').locator('[data-dz-action="toggle-visible"]')).toBeEnabled();
        // progress: uploads keep running under readonly, the bulk controls stay on
        await expect.poll(() => controlStates(page, 'ro-prog')).toEqual(['pause-all:on', 'cancel-all:on']);
        // indicator: the chip still opens the drawer (focusable, not disabled)
        await expect(dz(page, 'ro-ind').locator('button.dz__indicator-chip')).toBeEnabled();
        // picker: read-only through the store — focusable, aria-disabled, a drop adds nothing
        const pkCard = dz(page, 'ro-pk').locator('.dz__dropzone');
        await expect(pkCard).toHaveClass(/dz__dropzone--readonly/);
        await dragFiles(pkCard, 'drop', ['x.txt']);
        await page.waitForTimeout(150);
        expect(await count(page, 'ro-store')).toBe(2);
        expect(choosers()).toBe(0);

        // live flip: the store leaves readonly → the list offers Remove again
        await dz(page, 'ro-store').evaluate(async (el: any) => { el.isReadonly = false; await el.whenSettled(); });
        await expect(dz(page, 'ro-ls').locator('[data-dz-action="remove"]')).not.toHaveClass(/--hidden/);
        await expect(dz(page, 'ro-pk').locator('.dz__dropzone')).not.toHaveClass(/dz__dropzone--readonly/);
    });
});
