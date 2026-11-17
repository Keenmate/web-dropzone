import { test, expect, dz, addNamed, pendingNames, resolveUpload, dragFiles, type Page } from './fixtures';

/**
 * Screen-reader announcements through core `announce()` (the page's one polite
 * `[data-km-announcer]` live region): ONE per drop / pick, rejections, a
 * finished upload batch, a user removal. Upload progress is NOT announced. A
 * label set to `''` stays silent.
 *
 * Fixture: test/announce.html — `#drop` (accept=".txt", no handler), `#up`
 * (fixture pump), `#silent` (every announce* label `''`).
 */

const PAGE = '/test/announce.html';

const region = (page: Page) => page.locator('[data-km-announcer="polite"]');
const said = (page: Page) => page.evaluate(() =>
    document.querySelector('[data-km-announcer="polite"]')?.textContent ?? '');

async function drop(page: Page, id: string, names: string[]): Promise<void> {
    const card = page.locator(`#${id} .dz__dropzone`);
    await dragFiles(card, 'dragenter', names);
    await dragFiles(card, 'dragover', names);
    await dragFiles(card, 'drop', names);
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
});

test('a drop of 3 files is ONE announcement: "3 files added"', async ({ page }) => {
    await drop(page, 'drop', ['a.txt', 'b.txt', 'c.txt']);
    await expect(region(page)).toHaveText('3 files added');
    await expect(region(page)).toHaveAttribute('role', 'status');
    expect(await dz(page, 'drop').evaluate((el: any) => el.files.length)).toBe(3);
});

test('one file uses the singular form', async ({ page }) => {
    await addNamed(page, 'drop', ['one.txt']);
    await expect(region(page)).toHaveText('1 file added');
});

test('a rejected file says its name and the reason', async ({ page }) => {
    await drop(page, 'drop', ['bad.png']);
    await expect(region(page)).toHaveText('bad.png was rejected: File type not accepted');
});

test('added + rejected in one drop are one message', async ({ page }) => {
    await drop(page, 'drop', ['ok.txt', 'bad.png']);
    await expect(region(page)).toHaveText('1 file added. bad.png was rejected: File type not accepted');
});

test('a finished upload batch: "Upload complete: 2 files"; with a failure: "1 uploaded, 1 failed"', async ({ page }) => {
    await addNamed(page, 'up', ['u1.txt', 'u2.txt']);
    await expect.poll(() => pendingNames(page)).toEqual(['u1.txt', 'u2.txt']);
    await resolveUpload(page, 'u1.txt', 'ok');
    await resolveUpload(page, 'u2.txt', 'ok');
    await expect(region(page)).toHaveText('Upload complete: 2 files');

    await addNamed(page, 'up', ['u3.txt', 'u4.txt']);
    await expect.poll(() => pendingNames(page)).toEqual(['u3.txt', 'u4.txt']);
    await resolveUpload(page, 'u3.txt', 'ok');
    await resolveUpload(page, 'u4.txt', 'fail');
    await expect(region(page)).toHaveText('1 uploaded, 1 failed');
});

test('a user removal (row ✕) says "<name> removed"; a programmatic removeFile does not', async ({ page }) => {
    await addNamed(page, 'drop', ['gone.txt', 'stay.txt']);
    await expect(region(page)).toHaveText('2 files added');
    await dz(page, 'drop').locator('.dz__file-item:has(.dz__file-item-name:text-is("gone.txt")) [data-dz-action="remove"]').click();
    await expect(region(page)).toHaveText('gone.txt removed');

    await dz(page, 'drop').evaluate((el: any) => el.removeFile(el.files[0].id));
    await page.waitForTimeout(150);
    expect(await said(page)).toBe('gone.txt removed');
});

test('numbers go to formatLabelCallback raw', async ({ page }) => {
    await page.evaluate(() => {
        ((window as any).components ??= {}).locale = {
            formatLabelCallback: ({ key, params }: any) =>
                key === 'announceAdded' ? `count:${typeof params.count}:${params.count}` : undefined
        };
    });
    await addNamed(page, 'drop', ['n1.txt', 'n2.txt']);
    await expect(region(page)).toHaveText('count:number:2');
});

test('a label set to "" stays silent', async ({ page }) => {
    await addNamed(page, 'silent', ['s1.txt', 's2.txt']);
    await drop(page, 'silent', ['bad.png']);
    await expect.poll(() => pendingNames(page)).toEqual(['s1.txt', 's2.txt']);
    await resolveUpload(page, 's1.txt', 'ok');
    await resolveUpload(page, 's2.txt', 'ok');
    await expect.poll(() => dz(page, 'silent').evaluate((el: any) => el.files.map((f: any) => f.status))).toEqual(['complete', 'complete']);
    await dz(page, 'silent').locator('.dz__file-item:has(.dz__file-item-name:text-is("s1.txt")) [data-dz-action="remove"]').click();
    await expect.poll(() => dz(page, 'silent').evaluate((el: any) => el.files.length)).toBe(1);
    await page.waitForTimeout(150);
    expect(await said(page)).toBe('');
});
