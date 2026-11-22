import { test, expect, type Page, dz, log, addNamed } from './fixtures';

/**
 * `required` + the count rules through core validity (SPEC §6.6, rulebook C-CA-41).
 *
 * Fixture: test/required.html. Empty + required → `valueMissing` (`errors.required`);
 * 0 < files < min-file-count → `rangeUnderflow`; files > max-file-count (cap lowered after
 * the add) → `rangeOverflow`. Read-only / disabled → valid. `:state(required)` +
 * `aria-required` follow `required`.
 */

const PAGE = '/test/required.html';

type Validity = { valueMissing: boolean; rangeUnderflow: boolean; rangeOverflow: boolean; valid: boolean; message: string };

async function validity(page: Page, id: string): Promise<Validity> {
    return dz(page, id).evaluate(async (el: any) => {
        await el.whenSettled();
        const v = el.validity;
        return {
            valueMissing: v.valueMissing,
            rangeUnderflow: v.rangeUnderflow,
            rangeOverflow: v.rangeOverflow,
            valid: v.valid,
            message: el.validationMessage,
        };
    });
}

async function submit(page: Page, id: string): Promise<boolean> {
    await page.locator(`#${id}-submit`).click();
    const text = (await log(page, id).textContent()) ?? '';
    return text.includes('submitted');
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function');
    await dz(page, 'req').evaluate((el: any) => el.whenReady());
});

test.describe('required', () => {
    test('empty → valueMissing with errors.required, checkValidity() false, submit blocked', async ({ page }) => {
        const v = await validity(page, 'req');
        expect(v).toMatchObject({ valueMissing: true, rangeUnderflow: false, rangeOverflow: false, valid: false, message: 'Add a file.' });
        expect(await dz(page, 'req').evaluate((el: any) => el.checkValidity())).toBe(false);
        expect(await submit(page, 'req')).toBe(false);
    });

    test(':state(required), aria-required and the reflected attribute follow isRequired', async ({ page }) => {
        const el = dz(page, 'req');
        expect(await el.evaluate((e: any) => e.matches(':state(required)'))).toBe(true);
        expect(await el.evaluate((e: any) => e.isRequired)).toBe(true);
        expect(await el.evaluate((e: any) => e.internals?.ariaRequired)).toBe('true');
        await el.evaluate(async (e: any) => { e.isRequired = false; await e.whenSettled(); });
        expect(await el.evaluate((e: any) => e.matches(':state(required)'))).toBe(false);
        expect(await el.evaluate((e: any) => e.hasAttribute('required'))).toBe(false);
        expect((await validity(page, 'req')).valueMissing).toBe(false);
        // Back on through the attribute.
        await el.evaluate(async (e: any) => { e.setAttribute('required', ''); await e.whenSettled(); });
        expect(await el.evaluate((e: any) => e.matches(':state(required)'))).toBe(true);
        expect((await validity(page, 'req')).valueMissing).toBe(true);
    });

    test('a file clears valueMissing; removing it brings it back; form reset brings it back', async ({ page }) => {
        await addNamed(page, 'req', ['a.txt']);
        let v = await validity(page, 'req');
        expect(v.valueMissing).toBe(false);
        // One file under min-file-count="2" → rangeUnderflow instead.
        expect(v.rangeUnderflow).toBe(true);
        await dz(page, 'req').evaluate(async (el: any) => { await el.clear(); });
        expect((await validity(page, 'req')).valueMissing).toBe(true);
        await addNamed(page, 'req', ['a.txt', 'b.txt']);
        expect((await validity(page, 'req')).valid).toBe(true);
        await page.locator('#req-reset').click();
        await expect.poll(async () => (await validity(page, 'req')).valueMissing).toBe(true);
    });

    test('read-only → valid (never missing); disabled → valid', async ({ page }) => {
        const el = dz(page, 'req');
        await el.evaluate(async (e: any) => { e.isReadonly = true; await e.whenSettled(); });
        expect(await el.evaluate((e: any) => e.checkValidity())).toBe(true);
        expect((await validity(page, 'req')).valueMissing).toBe(false);
        await el.evaluate(async (e: any) => { e.isReadonly = false; e.isDisabled = true; await e.whenSettled(); });
        expect(await el.evaluate((e: any) => e.checkValidity())).toBe(true);
        expect((await validity(page, 'req')).valueMissing).toBe(false);
        await el.evaluate(async (e: any) => { e.isDisabled = false; await e.whenSettled(); });
        expect((await validity(page, 'req')).valueMissing).toBe(true);
    });

    test('a disabled <fieldset> → valid', async ({ page }) => {
        await page.evaluate(() => {
            const form = document.getElementById('req-form')!;
            const fs = document.createElement('fieldset');
            form.insertBefore(fs, form.firstChild);
            fs.appendChild(document.getElementById('req')!);
            fs.disabled = true;
        });
        await expect.poll(() => dz(page, 'req').evaluate((e: any) => e.checkValidity())).toBe(true);
    });

    test('reportValidity() anchors the bubble on the visible selector (button appearance)', async ({ page }) => {
        const v = await validity(page, 'btn');
        expect(v.valueMissing).toBe(true);
        // The anchor must be accepted (no "anchor rejected" warning) — reportValidity runs without throwing.
        const warnings: string[] = [];
        page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
        expect(await dz(page, 'btn').evaluate((el: any) => el.reportValidity())).toBe(false);
        expect(warnings.filter((w) => w.includes('anchor rejected'))).toEqual([]);
        expect(await submit(page, 'btn')).toBe(false);
        await addNamed(page, 'btn', ['one.txt']);
        expect(await submit(page, 'btn')).toBe(true);
        // Card appearance, after a re-render (add + clear): the anchor is the live card.
        await addNamed(page, 'req', ['a.txt']);
        await dz(page, 'req').evaluate(async (el: any) => { await el.clear(); await el.whenSettled(); });
        expect(await dz(page, 'req').evaluate((el: any) => el.reportValidity())).toBe(false);
        expect(warnings.filter((w) => w.includes('anchor rejected'))).toEqual([]);
    });
});

test.describe('min-file-count → rangeUnderflow', () => {
    test('empty and not required → valid, submit goes through', async ({ page }) => {
        expect((await validity(page, 'min')).valid).toBe(true);
        expect(await submit(page, 'min')).toBe(true);
    });

    test('1 of 2 → rangeUnderflow with errors.minFileCount, submit blocked; 2 → valid', async ({ page }) => {
        await addNamed(page, 'min', ['a.txt']);
        const v = await validity(page, 'min');
        expect(v).toMatchObject({ rangeUnderflow: true, valueMissing: false, valid: false, message: 'At least 2 files required' });
        expect(await submit(page, 'min')).toBe(false);
        await addNamed(page, 'min', ['b.txt']);
        expect((await validity(page, 'min')).valid).toBe(true);
        expect(await submit(page, 'min')).toBe(true);
    });

    test('raising / clearing min-file-count re-evaluates live', async ({ page }) => {
        await addNamed(page, 'min', ['a.txt', 'b.txt']);
        expect((await validity(page, 'min')).valid).toBe(true);
        await dz(page, 'min').evaluate((el: any) => el.setAttribute('min-file-count', '3'));
        expect((await validity(page, 'min')).rangeUnderflow).toBe(true);
        await dz(page, 'min').evaluate((el: any) => el.removeAttribute('min-file-count'));
        expect((await validity(page, 'min')).valid).toBe(true);
    });

    test('read-only → the count rule is not checked', async ({ page }) => {
        await addNamed(page, 'min', ['a.txt']);
        expect((await validity(page, 'min')).rangeUnderflow).toBe(true);
        await dz(page, 'min').evaluate(async (el: any) => { el.isReadonly = true; await el.whenSettled(); });
        expect((await validity(page, 'min')).valid).toBe(true);
    });
});

test.describe('max-file-count → rangeOverflow', () => {
    test('more files than a lowered cap → rangeOverflow with errors.maxFileCount; removing one clears it', async ({ page }) => {
        await addNamed(page, 'req', ['a.txt', 'b.txt', 'c.txt']);
        expect((await validity(page, 'req')).valid).toBe(true);
        await dz(page, 'req').evaluate((el: any) => { el.maxFileCount = 2; });
        const v = await validity(page, 'req');
        expect(v).toMatchObject({ rangeOverflow: true, rangeUnderflow: false, valueMissing: false, message: 'Maximum 2 files allowed' });
        expect(await submit(page, 'req')).toBe(false);
        await dz(page, 'req').evaluate(async (el: any) => { await el.removeFile(el.files[0].id); });
        expect((await validity(page, 'req')).valid).toBe(true);
    });

    test('flags are independent: under the min AND required-cleared keep their own state', async ({ page }) => {
        await addNamed(page, 'req', ['a.txt']);
        // rangeUnderflow set; then raising max / lowering it below 1 file doesn't touch it.
        await dz(page, 'req').evaluate((el: any) => { el.maxFileCount = 5; });
        const v = await validity(page, 'req');
        expect(v).toMatchObject({ rangeUnderflow: true, rangeOverflow: false, valueMissing: false });
    });
});
