import { test, expect, dz, addNamed, pendingNames, resolveUpload, dragFiles, logLines, type Page } from './fixtures';

/**
 * Lifecycle — a DOM move (re-parent / reorder) is `disconnect()` → `connect()`
 * in core's build-once + activate/deactivate model. Decision D1 (2026-10-24):
 * a move must KEEP the files and in-flight uploads, and must not rebuild
 * (`ready` fires once). Today `disconnect()` destroys the store — those tests
 * are `test.fail` until the component fix lands (NOTES.md #4).
 *
 * Fixture: test/lifecycle.html — `#lc` (pump, auto-upload="false"; the spec
 * calls uploadFile to start an upload), `#lc-ov` (overlay-target).
 * `window.__move(id, toId)` re-parents in one operation.
 */

const PAGE = '/test/lifecycle.html';

const move = (page: Page, id: string, to: string) =>
    page.evaluate(({ id, to }) => (window as any).__move(id, to), { id, to });
const files = (page: Page) =>
    dz(page, 'lc').evaluate((el: any) => el.files.map((f: any) => `${f.name}:${f.status}`));

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test.describe('re-parent keeps state (D1)', () => {
    test('queued files survive a move', async ({ page }) => {
        test.fail(true, 'NOTES.md #4');
        await addNamed(page, 'lc', ['a.txt', 'b.txt']);
        await move(page, 'lc', 'slot-b');
        await page.waitForTimeout(100);
        expect(await files(page)).toEqual(['a.txt:pending', 'b.txt:pending']);
        await expect(dz(page, 'lc').locator('.dz__file-item')).toHaveCount(2);
    });

    test('an in-flight upload survives a move and completes', async ({ page }) => {
        test.fail(true, 'NOTES.md #4');
        await addNamed(page, 'lc', ['up.txt']);
        await dz(page, 'lc').evaluate((el: any) => { void el.uploadFile(el.files[0].id); });
        await expect.poll(() => pendingNames(page)).toEqual(['up.txt']);
        await move(page, 'lc', 'slot-b');
        await page.waitForTimeout(100);
        // Not aborted: the handler's promise is still parked.
        expect(await pendingNames(page)).toEqual(['up.txt']);
        await resolveUpload(page, 'up.txt');
        await expect.poll(() => files(page)).toEqual(['up.txt:complete']);
    });

    test('a move does not rebuild — `ready` fires once', async ({ page }) => {
        test.fail(true, 'NOTES.md #4');
        await expect.poll(() => logLines(page, 'lc')).toEqual(['ready:']);
        await move(page, 'lc', 'slot-b');
        await move(page, 'lc', 'slot-a');
        await page.waitForTimeout(100);
        expect(await logLines(page, 'lc')).toEqual(['ready:']);
    });
});

test.describe('re-parent keeps the element working', () => {
    test('after a move the picker accepts drops and the controller is live', async ({ page }) => {
        await move(page, 'lc', 'slot-b');
        await expect(page.locator('#slot-b #lc')).toHaveCount(1);
        await dragFiles(dz(page, 'lc').locator('.dz__dropzone'), 'drop', ['after.txt']);
        await expect.poll(() => files(page)).toEqual(['after.txt:pending']);
        expect(await dz(page, 'lc').evaluate((el: any) => el.controller.getFiles().length)).toBe(1);
    });

    test('a moved overlay dropzone mounts exactly one overlay (document listeners not duplicated)', async ({ page }) => {
        await move(page, 'lc-ov', 'ov-away');
        await move(page, 'lc-ov', 'ov-home');
        await dragFiles(page.locator('body'), 'dragenter');
        await expect(page.locator('.dz__overlay')).toHaveCount(1);
        await page.waitForTimeout(100);
        await expect(page.locator('.dz__overlay')).toHaveCount(1);
    });

    test('a removed (not re-inserted) overlay dropzone stops reacting to drags', async ({ page }) => {
        await page.locator('#lc-ov').evaluate((el) => el.remove());
        await dragFiles(page.locator('body'), 'dragenter');
        await page.waitForTimeout(100);
        await expect(page.locator('.dz__overlay')).toHaveCount(0);
    });
});
