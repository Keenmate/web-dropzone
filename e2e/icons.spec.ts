import { test, expect, dz, dragFiles, type Page } from './fixtures';

/**
 * File icons in the rows. Resolution order (first hit wins):
 *   1. getFileIconCallback({ file }) non-null return
 *   2. fileIcons[extension] (case- and leading-dot-insensitive)
 *   3. fileIcons[category]  (image, pdf, doc, text, …)
 *   4. built-in category icon
 *
 * Fixture: test/icons.html — `#plain`, `#map` (fileIcons), `#cb`
 * (getFileIconCallback + fileIcons fallback). `__addTyped(id, [{name, type}])`.
 */

const PAGE = '/test/icons.html';

const add = (page: Page, id: string, specs: { name: string; type?: string }[]) =>
    page.evaluate(({ id, specs }) => (window as any).__addTyped(id, specs), { id, specs });
const icon = (page: Page, id: string, name: string) =>
    dz(page, id).locator(`.dz__file-item:has(.dz__file-item-name:text-is("${name}")) .dz__file-item-icon`);

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test('default: the icon slot carries the category modifier and built-in markup', async ({ page }) => {
    await add(page, 'plain', [{ name: 'a.pdf', type: 'application/pdf' }, { name: 'b.txt', type: 'text/plain' }]);
    await expect(icon(page, 'plain', 'a.pdf')).toHaveClass(/dz__file-item-icon--pdf/);
    await expect(icon(page, 'plain', 'b.txt')).toHaveClass(/dz__file-item-icon--text/);
    expect((await icon(page, 'plain', 'a.pdf').innerHTML()).trim().length).toBeGreaterThan(0);
});

test('fileIcons: extension key (".PDF" matches a.pdf) and category key ("text")', async ({ page }) => {
    await add(page, 'map', [
        { name: 'a.pdf', type: 'application/pdf' },
        { name: 'notes.md', type: 'text/markdown' },
        { name: 'z.zip', type: 'application/zip' },
    ]);
    await expect(icon(page, 'map', 'a.pdf').locator('i.ico-pdf')).toHaveText('P');
    await expect(icon(page, 'map', 'notes.md').locator('i.ico-text')).toHaveText('T');
    // No key matches → built-in icon (no override markup).
    await expect(icon(page, 'map', 'z.zip').locator('i')).toHaveCount(0);
});

test('getFileIconCallback wins; returning null falls back to fileIcons; ctx carries file + controller + element', async ({ page }) => {
    await add(page, 'cb', [{ name: 'data.csv', type: 'text/csv' }, { name: 'readme.txt', type: 'text/plain' }]);
    await expect(icon(page, 'cb', 'data.csv').locator('i.ico-csv')).toHaveText('C');
    await expect(icon(page, 'cb', 'readme.txt').locator('i.ico-text')).toHaveText('T');
    const ctx = await page.evaluate(() => (window as any).__iconCtx);
    expect(ctx).toEqual(expect.arrayContaining([{ name: 'data.csv', hasController: true, isElement: true }]));
});

test('assigning fileIcons after rows exist re-renders them', async ({ page }) => {
    await add(page, 'plain', [{ name: 'a.pdf', type: 'application/pdf' }]);
    await dz(page, 'plain').evaluate(async (el: any) => { el.fileIcons = { pdf: '<i class="late">L</i>' }; await el.whenSettled(); });
    await expect(icon(page, 'plain', 'a.pdf').locator('i.late')).toHaveText('L');
});

// ── Icon inputs through core renderIcon (SPEC §12.33) ─────────────────────────
// `<…` = raw markup; a built-in name = a `.km-icon` masked from `--base-icon-<name>`
// (ICON_CSS adopted in the store, the satellites and the overlay layer); then the
// element's renderIconCallback, the page-wide one; a class list = an icon-font <i>; else text.

/** A named icon is drawn: ICON_CSS applies (a 1em square) and the mask resolves. */
async function drawn(loc: import('@playwright/test').Locator): Promise<{ square: boolean; mask: string }> {
    return loc.evaluate((el) => {
        const cs = getComputedStyle(el);
        const w = (el as HTMLElement).offsetWidth; // layout size (the overlay animates in with a transform)
        return {
            square: w > 0 && Math.abs(w - parseFloat(cs.fontSize)) < 1 && w === (el as HTMLElement).offsetHeight,
            mask: cs.maskImage || (cs as any).webkitMaskImage,
        };
    });
}

test('a built-in name → a masked .km-icon (prompt, row cancel + remove) drawn by ICON_CSS', async ({ page }) => {
    const prompt = dz(page, 'named').locator('.dz__dropzone-icon .km-icon.dz__icon.dz__icon--check');
    await expect(prompt).toHaveCount(1);
    expect(await drawn(prompt)).toEqual({ square: true, mask: expect.stringContaining('url(') });
    await page.evaluate(() => (window as any).__addNamed('named', ['a.txt']));
    await expect(dz(page, 'named').locator('[data-dz-action="remove"][data-custom-icon] .km-icon.dz__icon--check')).toHaveCount(1);
    await expect(dz(page, 'named').locator('[data-dz-action="cancel"] .km-icon.dz__icon--check')).toHaveCount(1);
});

test('markup is inserted raw; an emoji / other text is escaped text', async ({ page }) => {
    await expect(dz(page, 'raw').locator('.dz__dropzone-icon b.raw-icon')).toHaveText('R');
    await page.evaluate(() => (window as any).__addNamed('raw', ['a.txt']));
    const remove = dz(page, 'raw').locator('[data-dz-action="remove"]');
    await expect(remove).toHaveText('🗑');
    await expect(remove.locator('.km-icon')).toHaveCount(0);
    const lt = dz(page, 'lt').locator('.dz__dropzone-icon');
    await expect(lt).toHaveText('1 < 2');
    expect(await lt.evaluate((el) => el.children.length)).toBe(0);
});

test('satellites: the picker icon and the list remove-icon draw in their own shadow roots', async ({ page }) => {
    const pick = page.locator('#sat-picker').locator('.dz__dropzone-icon .km-icon.dz__icon--check');
    await expect(pick).toHaveCount(1);
    expect((await drawn(pick)).square).toBe(true);
    await page.evaluate(() => (window as any).__addNamed('sat-store', ['s.txt']));
    const rm = page.locator('#sat-list').locator('[data-dz-action="remove"] .km-icon.dz__icon--check');
    await expect(rm).toHaveCount(1);
    expect(await drawn(rm)).toEqual({ square: true, mask: expect.stringContaining('url(') });
});

test('the drag overlay layer draws a built-in overlay-icon', async ({ page }) => {
    await dragFiles(page.locator('#ov-target'), 'dragenter');
    const ico = page.locator('.dz__overlay .dz__overlay-icon .km-icon.dz__icon--check');
    await expect(ico).toHaveCount(1);
    expect(await drawn(ico)).toEqual({ square: true, mask: expect.stringContaining('url(') });
    await dragFiles(page.locator('#ov-target'), 'dragleave');
});

// ── renderIconCallback: element hook → page hook (core rc25 order) ───────────

test('the element renderIconCallback beats the page hook; ctx carries component / prefix / element', async ({ page }) => {
    await expect(dz(page, 'hooks').locator('.dz__dropzone-icon b.own-icon')).toHaveText('own');
    await expect(dz(page, 'hooks').locator('.dz__dropzone-icon b.page-icon')).toHaveCount(0);
    const calls = await page.evaluate(() => (window as any).__ownCalls);
    expect(calls).toEqual(expect.arrayContaining([{ name: 'my-up', component: 'web-dropzone', prefix: 'dz', file: null, element: 'hooks' }]));
});

test('null from the element hook falls through to the page hook (row remove gets { file })', async ({ page }) => {
    await page.evaluate(() => (window as any).__addNamed('hooks', ['a.txt']));
    await expect(dz(page, 'hooks').locator('[data-dz-action="remove"] b.page-icon')).toHaveText('page-only');
    const calls = await page.evaluate(() => (window as any).__ownCalls);
    expect(calls).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'page-only', file: 'a.txt', element: 'hooks' })]));
});

test('an unanswered class list renders an icon-font <i class="dz__icon …"> that does not shrink', async ({ page }) => {
    await page.evaluate(() => (window as any).__addNamed('hooks', ['b.txt']));
    const i = dz(page, 'hooks').locator('[data-dz-action="cancel"] i.dz__icon.fa-solid.fa-ban');
    await expect(i).toHaveCount(1);
    await expect(i).toHaveAttribute('aria-hidden', 'true');
    expect(await i.evaluate((el) => getComputedStyle(el).flexShrink)).toBe('0');
});

test('a built-in name is never sent to a hook', async ({ page }) => {
    await expect(dz(page, 'hooks-builtin').locator('.dz__dropzone-icon .km-icon.dz__icon--close')).toHaveCount(1);
    const names = await page.evaluate(() => [...(window as any).__ownCalls.map((c: any) => c.name), ...(window as any).__pageNames]);
    expect(names).not.toContain('close');
    expect(names).not.toContain('check');
});

test('a bound picker draws with its store hook; assigning renderIconCallback re-renders', async ({ page }) => {
    // The picker has no icon → the store's `icon` (my-up) through the store's hook.
    await expect(page.locator('#hooks-picker').locator('.dz__dropzone-icon b.own-icon')).toHaveCount(1);
    await dz(page, 'hooks').evaluate(async (el: any) => {
        el.renderIconCallback = (name: string) => (name === 'my-up' ? '<b class="late-icon">late</b>' : null);
        await el.whenSettled();
    });
    await expect(dz(page, 'hooks').locator('.dz__dropzone-icon b.late-icon')).toHaveText('late');
    await expect(page.locator('#hooks-picker').locator('.dz__dropzone-icon b.late-icon')).toHaveCount(1);
});

// ── The page hook changes later (core iconsChanged(), C-CA-40) ───────────────

test('assigning window.components.renderIconCallback later repaints store + satellites in place (rows + focus kept)', async ({ page }) => {
    await page.evaluate(() => (window as any).__addNamed('late', ['a.txt', 'b.txt']));
    const storeRm = dz(page, 'late').locator('.dz__file-item:has(.dz__file-item-name:text-is("a.txt")) [data-dz-action="remove"]');
    await expect(storeRm.locator('i.dz__icon.later-x')).toHaveCount(1);   // unanswered → icon-font <i>
    // Keep state: the row button stays focused, the rows stay.
    await storeRm.focus();
    const rowBefore = await storeRm.evaluate((el) => { (window as any).__lateBtn = el; return el.isConnected; });
    expect(rowBefore).toBe(true);
    try {
        await page.evaluate(() => {
            (window as any).components.renderIconCallback = (name: string) =>
                name === 'later-up' || name === 'later-x' ? `<b data-test-icon>${name}</b>` : null;
        });
        // The store: prompt icon + row remove buttons.
        await expect(dz(page, 'late').locator('.dz__dropzone-icon b[data-test-icon]')).toHaveText('later-up');
        await expect(dz(page, 'late').locator('[data-dz-action="remove"] b[data-test-icon]')).toHaveCount(2);
        await expect(dz(page, 'late').locator('[data-dz-action="remove"][data-custom-icon]')).toHaveCount(2);
        // The satellites (drawn with the store's hook) repaint too.
        await expect(page.locator('#late-picker').locator('.dz__dropzone-icon b[data-test-icon]')).toHaveText('later-up');
        await expect(page.locator('#late-list').locator('[data-dz-action="remove"] b[data-test-icon]')).toHaveCount(2);
        // Same button element, still focused; files kept.
        const kept = await storeRm.evaluate((el) => el === (window as any).__lateBtn && el.getRootNode().activeElement === el);
        expect(kept).toBe(true);
        expect(await dz(page, 'late').evaluate((el: any) => el.files.length)).toBe(2);
    } finally {
        await page.evaluate(() => { (window as any).components.renderIconCallback = null; });
    }
});

// ── fileIcons values go through core renderIcon ──────────────────────────────

test('a fileIcons class list renders an icon-font <i class="dz__icon …"> (store row + bound list)', async ({ page }) => {
    await add(page, 'fi', [{ name: 'a.pdf', type: 'application/pdf' }]);
    const storeIcon = icon(page, 'fi', 'a.pdf').locator('i');
    await expect(storeIcon).toHaveAttribute('class', 'dz__icon fa-solid fa-file-pdf');
    const listIcon = page.locator('#fi-list').locator('.dz__badge:has(.dz__badge-name:text-is("a.pdf")) .dz__badge-icon i');
    await expect(listIcon).toHaveAttribute('class', 'dz__icon fa-solid fa-file-pdf');
});

test('a fileIcons name the page hook answers later repaints the file icons in place (store + bound list)', async ({ page }) => {
    await add(page, 'fi', [{ name: 'b.txt', type: 'text/plain' }]);
    const storeSlot = icon(page, 'fi', 'b.txt');
    const listSlot = page.locator('#fi-list').locator('.dz__badge:has(.dz__badge-name:text-is("b.txt")) .dz__badge-icon');
    await expect(storeSlot.locator('i.dz__icon.later-file')).toHaveCount(1);   // unanswered → icon-font <i>
    await expect(listSlot.locator('i.dz__icon.later-file')).toHaveCount(1);
    await storeSlot.evaluate((el) => { (window as any).__fiSlot = el; });
    try {
        await page.evaluate(() => {
            (window as any).components.renderIconCallback = (name: string, ctx: any) =>
                name === 'later-file' ? `<b data-test-file-icon>${ctx.file?.name ?? '?'}</b>` : null;
        });
        await expect(storeSlot.locator('b[data-test-file-icon]')).toHaveText('b.txt');   // ctx carries { file }
        await expect(listSlot.locator('b[data-test-file-icon]')).toHaveText('b.txt');
        expect(await storeSlot.evaluate((el) => el === (window as any).__fiSlot)).toBe(true);   // repainted in place
    } finally {
        await page.evaluate(() => { (window as any).components.renderIconCallback = null; });
    }
});

// ── icons map by name (rulebook C-CA-42): el.icons → window.components.icons → … → DEFAULT_ICONS ────

test.describe('icons by name', () => {
    test.afterEach(async ({ page }) => {
        await page.evaluate(() => { (window as any).components.icons = {}; });
    });

    test('unreplaced names draw the Lucide defaults (no icon-font <i> for a name)', async ({ page }) => {
        await page.evaluate(() => (window as any).__addNamed('nm', ['a.txt']));
        const row = dz(page, 'nm').locator('.dz__file-item');
        await expect(row.locator('.dz__file-item-status[data-dz-icon-name="statusPending"] svg')).toHaveCount(1);
        await expect(row.locator('.dz__file-item-icon svg')).toHaveCount(1);
        await expect(row.locator('[data-dz-action="cancel"] svg')).toHaveCount(1);   // no handler: hidden, still the rowCancel glyph
        await expect(dz(page, 'nm').locator('.dz__file-list i.dz__icon')).toHaveCount(0);
    });

    test('the icons JSON attribute + el.icons replace named icons (prompt, status, file type)', async ({ page }) => {
        await expect(dz(page, 'nm').locator('.dz__dropzone-icon i.dz__icon.fa-solid.fa-cloud-arrow-up')).toHaveCount(1);
        await page.evaluate(() => (window as any).__addNamed('nm', ['a.txt']));
        await page.evaluate(async () => {
            const el = document.getElementById('nm') as any;
            el.icons = { statusPending: '<b class="nm-status">S</b>', fileText: 'fa-solid fa-file-lines' };
            await el.whenSettled();
        });
        const row = dz(page, 'nm').locator('.dz__file-item');
        await expect(row.locator('.dz__file-item-status .nm-status')).toHaveText('S');
        await expect(row.locator('.dz__file-item-icon i.dz__icon.fa-solid.fa-file-lines')).toHaveCount(1);
        await expect(dz(page, 'nm').locator('.dz__dropzone-icon svg')).toHaveCount(1);   // the attribute map replaced: prompt back to the default
    });

    test('window.components.icons (web-dropzone.<name>) repaints the store map + a bound list in place', async ({ page }) => {
        await page.evaluate(() => (window as any).__addNamed('nm-store', ['a.txt']));
        const listStatus = page.locator('#nm-list').locator('.dz__file-item-status');
        await expect(listStatus.locator('svg')).toHaveCount(1);
        await listStatus.evaluate((el) => { (window as any).__nmStatus = el; });
        await page.evaluate(() => { (window as any).components.icons = { 'web-dropzone.statusPending': '<b class="pg-status">G</b>' }; });
        await expect(listStatus.locator('.pg-status')).toHaveText('G');
        expect(await listStatus.evaluate((el) => el === (window as any).__nmStatus)).toBe(true);   // repainted, not re-rendered
        // The store's own map wins over the page-wide one.
        await page.evaluate(async () => {
            const el = document.getElementById('nm-store') as any;
            el.icons = { statusPending: '<b class="own-status">O</b>' };
            await el.whenSettled();
        });
        await expect(page.locator('#nm-list').locator('.dz__file-item-status .own-status')).toHaveText('O');
    });
});
