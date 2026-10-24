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
