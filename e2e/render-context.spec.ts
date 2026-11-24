import { test, expect, dz, addNamed, type Page } from './fixtures';

/**
 * Every render callback's ctx carries `labels` (core `createLabelsView`),
 * `isReadonly` and `isDisabled` (the effective state), and a change of labels /
 * locale (incl. the page-wide one) / read-only / disabled re-runs the rendered
 * callbacks IN PLACE: the files, their progress and an open popover are kept;
 * an element row the callback returns again keeps its identity.
 *
 * Fixture: test/render-context.html — each callback prints
 * `ctx.labels.text('labels.statusPending')|R:<isReadonly>|D:<isDisabled>`.
 */

const PAGE = '/test/render-context.html';

const set = (page: Page, id: string, values: Record<string, unknown>) =>
    page.evaluate(async ({ id, values }) => {
        const el = document.getElementById(id) as any;
        el.setProperties(values);
        await el.whenSettled();
    }, { id, values });

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test.afterEach(async ({ page }) => {
    await page.evaluate(() => { (window as any).components.locale = null; });
});

test('prompt + element row: labels / readonly / disabled re-run in place; files, progress and the row element kept', async ({ page }) => {
    const host = dz(page, 'ctx');
    await addNamed(page, 'ctx', ['a.txt']);
    const row = host.locator('.cb-row');
    await expect(host.locator('.cb-prompt')).toHaveText('Pending|R:false|D:false');
    await expect(row).toHaveText('a.txt|0|Pending|R:false|D:false');
    await page.evaluate(() => {
        const el = document.getElementById('ctx') as any;
        el.controller.updateFileProgress(el.controller.getFiles()[0].id, 40);
        (window as any).__row = el.shadowRoot.querySelector('.cb-row');
    });

    await set(page, 'ctx', { labels: { 'labels.statusPending': 'Waiting' } });
    await expect(host.locator('.cb-prompt')).toHaveText('Waiting|R:false|D:false');
    await expect(row).toHaveText('a.txt|40|Waiting|R:false|D:false');

    await set(page, 'ctx', { isReadonly: true });
    await expect(host.locator('.cb-prompt')).toHaveText('Waiting|R:true|D:false');
    await expect(row).toHaveText('a.txt|40|Waiting|R:true|D:false');

    await set(page, 'ctx', { isDisabled: true });
    await expect(host.locator('.cb-prompt')).toHaveText('Waiting|R:true|D:true');
    await expect(row).toHaveText('a.txt|40|Waiting|R:true|D:true');

    // The same element row (the callback returned its cached element) — not replaced.
    expect(await page.evaluate(() => (window as any).__row === document.getElementById('ctx')!.shadowRoot!.querySelector('.cb-row'))).toBe(true);
    await expect(host.locator('.cb-row')).toHaveCount(1);
});

test('a disabled <fieldset> reaches ctx.isDisabled', async ({ page }) => {
    await addNamed(page, 'ctx', ['a.txt']);
    await page.evaluate(async () => {
        const el = document.getElementById('ctx') as any;
        const fs = document.createElement('fieldset');
        el.before(fs);
        fs.append(el);
        fs.disabled = true;
        await el.whenSettled();
    });
    await expect(dz(page, 'ctx').locator('.cb-row')).toHaveText('a.txt|0|Pending|R:false|D:true');
});

test('the page-wide locale labels re-run the callbacks; an unrelated input runs no row callback again', async ({ page }) => {
    const host = dz(page, 'ctx');
    await addNamed(page, 'ctx', ['a.txt']);
    await expect(host.locator('.cb-row')).toHaveText('a.txt|0|Pending|R:false|D:false');
    const before = await page.evaluate(() => (window as any).__calls.row);
    await set(page, 'ctx', { concurrency: 3 });
    expect(await page.evaluate(() => (window as any).__calls.row)).toBe(before);

    await page.evaluate(() => {
        (window as any).components.locale = { labels: { 'web-dropzone.labels.statusPending': 'Čeká' } };
    });
    await expect(host.locator('.cb-prompt')).toHaveText('Čeká|R:false|D:false');
    await expect(host.locator('.cb-row')).toHaveText('a.txt|0|Čeká|R:false|D:false');
});

test('an open popover stays open while a labels / readonly change re-runs the callbacks and its rows', async ({ page }) => {
    const host = dz(page, 'pop');
    await addNamed(page, 'pop', ['p1.txt', 'p2.txt']);
    await host.locator('.dz__summary-line').click();
    const popover = host.locator('.dz__popover');
    await expect(popover).toBeVisible();
    await expect(host.locator('.cb-pop')).toHaveText('Pending|R:false|D:false');

    await set(page, 'pop', { labels: { 'labels.statusPending': 'Queued' } });
    await expect(host.locator('.cb-pop')).toHaveText('Queued|R:false|D:false');
    await expect(popover).toBeVisible();
    await set(page, 'pop', { isReadonly: true });
    await expect(host.locator('.cb-pop')).toHaveText('Queued|R:true|D:false');
    await expect(popover).toBeVisible();
    await expect(popover.locator('.dz__popover-body tbody > tr')).toHaveCount(2);
});

test('rolling file-info: ctx follows labels / disabled', async ({ page }) => {
    const host = dz(page, 'roll');
    await addNamed(page, 'roll', ['r.txt']);
    await expect(host.locator('.cb-roll')).toHaveText('Pending|R:false|D:false');
    await set(page, 'roll', { labels: { 'labels.statusPending': 'Next' }, isDisabled: true });
    await expect(host.locator('.cb-roll')).toHaveText('Next|R:false|D:true');
});

test('indicator: the store\'s readonly / disabled and the satellite\'s own labels reach its ctx', async ({ page }) => {
    await addNamed(page, 'ind-store', ['i.txt']);
    const info = page.locator('#ind').locator('.cb-ind');
    await expect(info).toHaveText('Pending|R:false|D:false');
    await set(page, 'ind-store', { isReadonly: true, labels: { 'labels.statusPending': 'Store' } });
    await expect(info).toHaveText('Store|R:true|D:false');
    await set(page, 'ind', { labels: { 'labels.statusPending': 'Own' } });
    await expect(info).toHaveText('Own|R:true|D:false');
    await set(page, 'ind-store', { isDisabled: true });
    await expect(info).toHaveText('Own|R:true|D:true');
});
