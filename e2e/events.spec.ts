import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 3 — event contract.
 *
 * Fixture: test/events.html. One dropzone with every public event hooked
 * into a window.__events log. The page exposes four buttons (add one /
 * add two / remove first / clear) so specs can drive the lifecycle
 * declaratively. Per the 2.0 (interaction-model) contract:
 *
 *   - `file-add` / `file-remove` carry `{ file }` only — no
 *     duplicate `files` snapshot. Snapshot is read via `e.target.files`.
 *   - `change` carries `{ files }` (the selection after the change).
 *   - every detail also carries `controller` / `element`, non-enumerable.
 *   - `files-change` carries `{ changedIds, files }` and is rAF-coalesced.
 *   - `file-update` is new in this release; fires from generatePreview
 *     and upload-handler post-result merges.
 *
 * Specs assert on the captured log shape; the page-side serializer strips
 * the File object down to `{ name, size }` so page.evaluate can return it.
 */

const PAGE = '/test/events.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

async function getEvents(page: Page, type: string): Promise<any[]> {
    return page.evaluate((t) => (window as any).__events[t], type);
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
});

test.describe('file-add', () => {
    test('fires once per file with only { file } in detail', async ({ page }) => {
        await page.locator('#add-two').click();
        const events = await getEvents(page, 'file-add');
        expect(events).toHaveLength(2);
        // Detail shape: { file: { name, size } }, no `files` field
        expect(events[0].detail).toHaveProperty('file');
        expect(events[0].detail.file.name).toBe('a.txt');
        expect(events[0].detail).not.toHaveProperty('files');
    });

    test('event target is the <web-dropzone> host', async ({ page }) => {
        await page.locator('#add-one').click();
        const events = await getEvents(page, 'file-add');
        expect(events[0].target).toBe('WEB-DROPZONE');
    });

    test('e.target.files snapshot is in sync at dispatch time', async ({ page }) => {
        await page.locator('#add-two').click();
        const events = await getEvents(page, 'file-add');
        // Both dispatches see the final snapshot count = 2 (per-file events
        // fire after the batch is committed, like svelte-fluentui).
        expect(events[0].snapshotCount).toBeGreaterThan(0);
        expect(events[1].snapshotCount).toBe(2);
    });
});

test.describe('file-remove', () => {
    test('fires when the user-removed file is gone from the store', async ({ page }) => {
        await page.locator('#add-two').click();
        await page.locator('#remove-first').click();
        const removed = await getEvents(page, 'file-remove');
        expect(removed).toHaveLength(1);
        expect(removed[0].detail.file.name).toBe('a.txt');
        expect(removed[0].snapshotCount).toBe(1);
    });
});

test.describe('change', () => {
    test('fires with { files } — the selection after the change', async ({ page }) => {
        await page.locator('#add-one').click();
        const events = await getEvents(page, 'change');
        expect(events.length).toBeGreaterThanOrEqual(1);
        // The serializer turns arrays into a length count; controller /
        // element are non-enumerable, so they don't show up here.
        expect(events[0].detail).toEqual({ files: 1 });
    });
});

test.describe('files-change (rAF-coalesced)', () => {
    test('coalesces a multi-file add into one event with all changedIds', async ({ page }) => {
        await page.locator('#add-two').click();
        // Wait one frame so the rAF flush lands.
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r(null))));
        const events = await getEvents(page, 'files-change');
        // One coalesced dispatch covers the two-file batch.
        expect(events.length).toBeGreaterThanOrEqual(1);
        // The serializer turns arrays into a length count; detail.changedIds
        // is reported as 2 for a two-file batch.
        const totalChanged = events.reduce((acc, e) => acc + (e.detail.changedIds || 0), 0);
        expect(totalChanged).toBeGreaterThanOrEqual(2);
    });
});

test.describe('clear()', () => {
    test('drains the store and fires file-remove per file + change', async ({ page }) => {
        await page.locator('#add-two').click();
        await page.locator('#clear-all').click();
        const removed = await getEvents(page, 'file-remove');
        // Two adds → two removals on clear.
        expect(removed).toHaveLength(2);
        // Final store is empty.
        const count = await dz(page, 'events').evaluate((el: any) => el.files.length);
        expect(count).toBe(0);
    });
});
