import { test, expect } from './fixtures';

/**
 * `highlight-on-page-drag` — the "armed" state: while FILES are dragged
 * anywhere over the page, every opted-in drop target gets the `armed`
 * attribute + `:state(armed)` and its card takes `--dz-dropzone-bg-armed`
 * (chains `--base-drop-target-bg`). Off by default.
 *
 * Fixture: test/armed.html. Drags are synthetic, dispatched on `#outside`
 * (not a drop target); `__startDrag()` also runs a `dragover` pulse, as a
 * live native drag does (the tracker's heartbeat ends a silent drag).
 */

const PAGE = '/test/armed.html';

const isArmed = (page: import('@playwright/test').Page, id: string) =>
    page.evaluate((id) => document.getElementById(id)!.hasAttribute('armed'), id);

const armedState = (page: import('@playwright/test').Page, id: string) =>
    page.evaluate((id) => (document.getElementById(id) as any).matches(':state(armed)'), id);

const managedPickerArmed = (page: import('@playwright/test').Page, id: string) =>
    page.evaluate((id) => document.getElementById(id)!.shadowRoot!.querySelector('web-dropzone-picker')!.hasAttribute('armed'), id);

const cardBg = (page: import('@playwright/test').Page, id: string) =>
    page.evaluate((id) => getComputedStyle((window as any).__card(id)).backgroundColor, id);

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => (window as any).__ready === true);
    await page.evaluate(() => {
        document.documentElement.style.setProperty('--base-drop-target-bg', 'rgb(7, 8, 9)');
    });
});

test.afterEach(async ({ page }) => {
    await page.evaluate(() => (window as any).__stopPulse?.());
});

test('off by default: a file drag over the page never arms a dropzone without the attribute', async ({ page }) => {
    expect(await page.evaluate(() => (document.getElementById('plain') as any).shouldHighlightOnPageDrag)).toBe(false);
    await page.evaluate(() => (window as any).__startDrag());
    await expect(page.locator('#bulk')).toHaveAttribute('armed', '');
    expect(await isArmed(page, 'plain')).toBe(false);
    expect(await page.evaluate(() => (document.getElementById('plain') as any).isArmed)).toBe(false);
    await expect.poll(() => cardBg(page, 'plain')).not.toBe('rgb(7, 8, 9)');
});

test('on: a file drag anywhere over the page arms every opted-in target (attribute, :state, isArmed, bg)', async ({ page }) => {
    for (const id of ['bulk', 'structural', 'picker']) expect(await isArmed(page, id)).toBe(false);

    await page.evaluate(() => (window as any).__startDrag());
    await expect(page.locator('#bulk')).toHaveAttribute('armed', '');
    await expect(page.locator('#structural')).toHaveAttribute('armed', '');
    await expect(page.locator('#picker')).toHaveAttribute('armed', '');
    expect(await armedState(page, 'bulk')).toBe(true);
    expect(await armedState(page, 'picker')).toBe(true);
    expect(await page.evaluate(() => (document.getElementById('bulk') as any).isArmed)).toBe(true);
    // Bulk mode: the managed picker inherits the store's setting and tints its card.
    expect(await managedPickerArmed(page, 'bulk')).toBe(true);
    await expect.poll(() => cardBg(page, 'bulk')).toBe('rgb(7, 8, 9)');
    await expect.poll(() => cardBg(page, 'structural')).toBe('rgb(7, 8, 9)');
    await expect.poll(() => cardBg(page, 'picker')).toBe('rgb(7, 8, 9)');
});

test('the card under the pointer keeps -bg-active over the armed tint', async ({ page }) => {
    await page.evaluate(() => {
        document.documentElement.style.setProperty('--base-drop-target-bg-active', 'rgb(1, 2, 3)');
        (window as any).__startDrag();
    });
    await expect(page.locator('#bulk')).toHaveAttribute('armed', '');
    await page.evaluate(() => {
        const card = (window as any).__card('bulk') as HTMLElement;
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array(8)], 'a.txt', { type: 'text/plain' }));
        card.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt }));
    });
    await expect.poll(() => cardBg(page, 'bulk')).toBe('rgb(1, 2, 3)');
    await expect.poll(() => cardBg(page, 'structural')).toBe('rgb(7, 8, 9)');
});

test('disabled targets never arm', async ({ page }) => {
    await page.evaluate(() => (window as any).__startDrag());
    await expect(page.locator('#bulk')).toHaveAttribute('armed', '');
    expect(await isArmed(page, 'disabled')).toBe(false);
    expect(await managedPickerArmed(page, 'disabled')).toBe(false);
});

for (const end of ['drop', 'dragleave', 'dragend', 'Escape'] as const) {
    test(`cleared on ${end}`, async ({ page }) => {
        await page.evaluate(() => (window as any).__startDrag());
        await expect(page.locator('#bulk')).toHaveAttribute('armed', '');
        // Synchronous: cleared by the event itself, not by the heartbeat.
        expect(await page.evaluate((t) => (window as any).__endDrag(t), end)).toBe(false);
        for (const id of ['structural', 'picker']) expect(await isArmed(page, id)).toBe(false);
        expect(await managedPickerArmed(page, 'bulk')).toBe(false);
        expect(await armedState(page, 'bulk')).toBe(false);
    });
}

test('enter/leave across elements is counted: only the leave out of the window disarms', async ({ page }) => {
    const armedAfter = await page.evaluate(() => {
        const w = window as any;
        w.__startDrag();
        const fire = (el: Element, type: string) => {
            const dt = new DataTransfer();
            dt.items.add(new File([new Uint8Array(8)], 'a.txt', { type: 'text/plain' }));
            el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, composed: true, dataTransfer: dt }));
        };
        const bulk = document.getElementById('bulk')!;
        fire(document.body, 'dragenter');             // pointer moves to <body> (depth 2)
        fire(document.getElementById('outside')!, 'dragleave'); // ... leaving #outside (depth 1)
        const midway = bulk.hasAttribute('armed');
        w.__stopPulse();
        fire(document.body, 'dragleave');              // out of the window (depth 0)
        return { midway, after: bulk.hasAttribute('armed') };
    });
    expect(armedAfter).toEqual({ midway: true, after: false });
});

test('a silent drag (no dragover pulse — Esc on an external drag) disarms via the heartbeat', async ({ page }) => {
    await page.evaluate(() => (window as any).__startDrag());
    await expect(page.locator('#bulk')).toHaveAttribute('armed', '');
    await page.evaluate(() => (window as any).__stopPulse());
    await expect(page.locator('#bulk')).not.toHaveAttribute('armed', '', { timeout: 2000 });
});

test('a text drag never arms', async ({ page }) => {
    await page.evaluate(() => (window as any).__startDrag('text'));
    await page.waitForTimeout(200);
    for (const id of ['bulk', 'structural', 'picker']) expect(await isArmed(page, id)).toBe(false);
});

test('disconnect clears the armed state; the other instances stay armed', async ({ page }) => {
    await page.evaluate(() => (window as any).__startDrag());
    await expect(page.locator('#bulk')).toHaveAttribute('armed', '');
    const result = await page.evaluate(() => {
        const bulk = document.getElementById('bulk')!;
        bulk.remove();
        return { bulk: bulk.hasAttribute('armed'), structural: document.getElementById('structural')!.hasAttribute('armed') };
    });
    expect(result).toEqual({ bulk: false, structural: true });
});

test('toggling the input live subscribes / unsubscribes (reactive)', async ({ page }) => {
    await page.evaluate(() => (window as any).__startDrag());
    await expect(page.locator('#structural')).toHaveAttribute('armed', '');
    await page.evaluate(() => document.getElementById('structural')!.removeAttribute('highlight-on-page-drag'));
    await expect(page.locator('#structural')).not.toHaveAttribute('armed', '');
    await page.evaluate(() => { (document.getElementById('plain') as any).shouldHighlightOnPageDrag = true; });
    await expect(page.locator('#plain')).toHaveAttribute('armed', '');
});

test('all instances share ONE page listener set (added once, removed with the last)', async ({ page }) => {
    // bulk + its managed picker, structural, disabled + its managed picker, standalone picker.
    expect(await page.evaluate(() => (window as any).__dragenterCaptureAdds)).toBe(1);
    expect(await page.evaluate(() => (window as any).__dragenterCaptureRemoves)).toBe(0);

    // Removing some of them keeps the shared set...
    await page.evaluate(() => {
        document.getElementById('bulk')!.remove();
        document.getElementById('structural')!.remove();
    });
    expect(await page.evaluate(() => (window as any).__dragenterCaptureRemoves)).toBe(0);
    await page.evaluate(() => (window as any).__startDrag());
    await expect(page.locator('#picker')).toHaveAttribute('armed', '');
    await page.evaluate(() => (window as any).__endDrag('drop'));

    // ...the last one out removes it; a new opt-in adds it again (once).
    await page.evaluate(() => {
        document.getElementById('disabled')!.remove();
        document.getElementById('picker')!.remove();
    });
    expect(await page.evaluate(() => (window as any).__dragenterCaptureRemoves)).toBe(1);
    await page.evaluate(() => { (document.getElementById('plain') as any).shouldHighlightOnPageDrag = true; });
    await expect.poll(() => page.evaluate(() => (window as any).__dragenterCaptureAdds)).toBe(2);
});
