/**
 * Helpers shared by ≥3 specs. Re-exported from `./fixtures`, so specs write
 * `import { test, expect, dz, addNamed } from './fixtures'`.
 *
 * They rely on per-fixture-page window hooks:
 *   - `__addNamed(id, names)`   — add 64-byte text files by name
 *   - `__pendingNames()`        — names parked in the synthetic upload pump
 *   - `__resolve(name, value)`  — settle a parked upload (omitted = page default, usually 'ok')
 *   - `__progress(name, pct)`   — report progress for a parked upload
 */
import type { Locator, Page } from '@playwright/test';

/** The dropzone (or any element) by id. */
export function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

/** The `#<id>-log` event log next to a fixture. */
export function log(page: Page, id: string): Locator {
    return page.locator(`#${id}-log`);
}

export async function addNamed(page: Page, id: string, names: string[]): Promise<void> {
    await page.evaluate(({ id, names }) => (window as any).__addNamed(id, names), { id, names });
}

export async function pendingNames(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as any).__pendingNames());
}

export async function resolveUpload(page: Page, name: string, outcome?: unknown): Promise<void> {
    await page.evaluate(({ name, outcome }) => (window as any).__resolve(name, outcome), { name, outcome });
}

export async function pumpProgress(page: Page, name: string, pct: number): Promise<void> {
    await page.evaluate(({ name, pct }) => (window as any).__progress(name, pct), { name, pct });
}

/**
 * Dispatch a synthetic file DragEvent (`dragenter` / `dragover` / `dragleave` /
 * `drop`) on `target`. Chromium lets a constructed DataTransfer carry real
 * File objects, so `dataTransfer.types` includes "Files" exactly like an OS
 * drag. Locators pierce shadow roots, so `target` can be an internal part.
 * Resolves to whether the event was cancelled (accepted as a drop target).
 */
export async function dragFiles(
    target: Locator,
    type: 'dragenter' | 'dragover' | 'dragleave' | 'drop',
    names: string[] = ['a.txt'],
): Promise<boolean> {
    return target.evaluate((el, { type, names }) => {
        const dt = new DataTransfer();
        for (const n of names) {
            dt.items.add(new File([new Uint8Array(64)], n, { type: n.endsWith('.png') ? 'image/png' : 'text/plain' }));
        }
        const ev = new DragEvent(type, { bubbles: true, cancelable: true, composed: true, dataTransfer: dt });
        return !el.dispatchEvent(ev);
    }, { type, names });
}

/** Lines of a `<pre data-testid="<area>-log">` event log. */
export async function logLines(page: Page, area: string): Promise<string[]> {
    const text = await page.getByTestId(`${area}-log`).textContent();
    return (text ?? '').split('\n').filter(Boolean);
}

/**
 * Count native file dialogs (`filechooser` events) for the rest of the test.
 * Call it BEFORE `page.goto` (e.g. in beforeEach): Playwright enables
 * file-chooser interception asynchronously when the first listener is added,
 * so a listener attached right before a click/keypress can miss the event.
 */
export function trackFileChoosers(page: Page): () => number {
    let n = 0;
    page.on('filechooser', () => { n++; });
    return () => n;
}
