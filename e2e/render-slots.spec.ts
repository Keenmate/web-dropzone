import { test, expect, dz, addNamed, type Page } from './fixtures';

/**
 * Every content-returning `render*Callback` reads its result through core
 * `renderSlot` / `renderSlotHtml` (SPEC §12.35): string = HTML, Node = mounted,
 * `null` / `undefined` = the built-in rendering, `false` = hidden.
 *
 * Fixture: test/render-slots.html — each callback returns per
 * `window.__mode[key]`; `__rerun(id, key)` re-assigns the callback (re-render).
 */

const PAGE = '/test/render-slots.html';

const setMode = (page: Page, key: string, mode: string) =>
    page.evaluate(({ key, mode }) => { (window as any).__mode[key] = mode; }, { key, mode });
const rerun = (page: Page, id: string, key: string) =>
    page.evaluate(({ id, key }) => (window as any).__rerun(id, key), { id, key });

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test('renderFileItemCallback: string = the row, null = the built-in row, false = no row', async ({ page }) => {
    await addNamed(page, 'items', ['a.txt', 'def.txt', 'skip.txt']);
    const host = dz(page, 'items');
    await expect(host.locator('.my-row')).toHaveText(['CB:a.txt']);
    await expect(host.locator('.dz__file-item--list .dz__file-item-name')).toHaveText(['def.txt']);
    await expect(host.locator('.dz__file-list > [data-file-id]')).toHaveCount(2);
    await expect(host.getByText('skip.txt')).toHaveCount(0);
});

test('renderPromptCallback: null = the built-in prompt, string = HTML, false = no prompt', async ({ page }) => {
    const host = dz(page, 'prompt');
    await expect(host.locator('.dz__dropzone-text')).toBeVisible();          // null → default
    await setMode(page, 'prompt', 'string');
    await rerun(page, 'prompt', 'renderPromptCallback');
    await expect(host.locator('.cb-prompt')).toHaveText('PROMPT');
    await expect(host.locator('.dz__dropzone-text')).toHaveCount(0);
    await setMode(page, 'prompt', 'false');
    await rerun(page, 'prompt', 'renderPromptCallback');
    await expect(host.locator('.cb-prompt')).toHaveCount(0);
    await expect(host.locator('.dz__dropzone-text')).toHaveCount(0);
    await expect(host.locator('.dz__dropzone-input')).toHaveCount(1);       // the card itself stays
});

test('renderListWrapperCallback: null = the plain rows, Node = mounted, false = the list hidden', async ({ page }) => {
    await addNamed(page, 'wrap', ['w.txt']);
    const host = dz(page, 'wrap');
    const list = host.locator('.dz__file-list');
    await expect(list.locator('.dz__file-item-name')).toHaveText(['w.txt']); // null → rows
    await setMode(page, 'wrap', 'node');
    await rerun(page, 'wrap', 'renderListWrapperCallback');
    await expect(list.locator('.cb-node')).toHaveText('WRAP');
    expect(await page.evaluate(() => (window as any).__nodes.wrap.isConnected)).toBe(true);
    await setMode(page, 'wrap', 'false');
    await rerun(page, 'wrap', 'renderListWrapperCallback');
    await expect(list).toBeHidden();
    expect(await list.evaluate((el) => el.childElementCount)).toBe(0);
    await setMode(page, 'wrap', 'undefined');
    await rerun(page, 'wrap', 'renderListWrapperCallback');
    await expect(list).toBeVisible();
    await expect(list.locator('.dz__file-item-name')).toHaveText(['w.txt']);
});

test('renderSummaryCallback: a Node is mounted (listeners survive), null = the built-in line, false = hidden', async ({ page }) => {
    await setMode(page, 'summary', 'node');
    await addNamed(page, 'summary', ['s1.txt', 's2.txt']);
    const host = dz(page, 'summary');
    const node = host.locator('.dz__summary .cb-node');
    await expect(node).toHaveText('SUM:2');     // the cached node: its first text stays
    await node.click();
    expect(await page.evaluate(() => (window as any).__nodeClicks)).toBe(1);
    await setMode(page, 'summary', 'null');
    await rerun(page, 'summary', 'renderSummaryCallback');
    await expect(host.locator('.dz__summary-line')).toBeVisible();
    await setMode(page, 'summary', 'false');
    await rerun(page, 'summary', 'renderSummaryCallback');
    await expect(host.locator('.dz__summary')).toBeHidden();
});

for (const [label, store, view, body, info] of [
    ['the store (structural)', 'roll', 'roll', 'roll-body', 'roll-info'],
    ['the <web-dropzone-list> satellite', 'roll-store', 'roll-list', 'sat-body', 'sat-info'],
] as const) {
    test(`rolling via ${label}: body Node kept across ticks, false hides, null = default; file-info false → hidden, null → name restored`, async ({ page }) => {
        const block = page.locator(`#${view}`).locator('.dz__file-list--rolling');
        await setMode(page, body, 'node');
        await addNamed(page, store, ['r1.txt', 'r2.txt']);
        await expect(block.locator('.cb-node')).toHaveText('BODY');
        await rerun(page, store, 'renderRollingBodyCallback');
        expect(await page.evaluate((k) => (window as any).__nodes[k].isConnected, body)).toBe(true);
        await setMode(page, body, 'false');
        await rerun(page, store, 'renderRollingBodyCallback');
        await expect(block).toBeHidden();
        await setMode(page, body, 'null');
        await rerun(page, store, 'renderRollingBodyCallback');
        await expect(block).toBeVisible();
        const name = block.locator('.dz__rolling-current .dz__file-item-name');
        await expect(name).toHaveText('r1.txt');                         // file-info null → the row's name
        await setMode(page, info, 'false');
        await rerun(page, store, 'renderRollingFileInfoCallback');
        await expect(name).toBeHidden();
        await setMode(page, info, 'string');
        await rerun(page, store, 'renderRollingFileInfoCallback');
        await expect(name.locator(`.cb-${info}`)).toHaveText('INFO');
        await setMode(page, info, 'null');
        await rerun(page, store, 'renderRollingFileInfoCallback');
        await expect(name).toHaveText('r1.txt');                         // restored after a custom result
    });
}

test('indicator renderFileInfoCallback: string = HTML, false = hidden, null = the default glyph', async ({ page }) => {
    await addNamed(page, 'ind-store', ['i.txt']);
    const slot = page.locator('#ind').locator('.dz__indicator-file-info');
    await expect(slot.locator('.dz__indicator-file-info-icon')).toHaveCount(1);  // null → default
    await setMode(page, 'ind-info', 'string');
    await rerun(page, 'ind', 'renderFileInfoCallback');
    await expect(slot.locator('.cb-ind-info')).toHaveText('IND');
    await setMode(page, 'ind-info', 'false');
    await rerun(page, 'ind', 'renderFileInfoCallback');
    await expect(slot).toBeHidden();
    await setMode(page, 'ind-info', 'null');
    await rerun(page, 'ind', 'renderFileInfoCallback');
    await expect(slot).toBeVisible();
    await expect(slot.locator('.dz__indicator-file-info-icon')).toHaveCount(1);
});
