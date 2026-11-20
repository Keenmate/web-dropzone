import { describe, it, expect, afterEach } from 'vitest';
import { DEFAULT_CONFIG, DropzoneEngine } from '@keenmate/web-dropzone-core';
import '../../src/index'; // registers <web-dropzone> + the satellites

/**
 * One source of defaults (rulebook C-CA-37): `DEFAULT_CONFIG` in
 * `@keenmate/web-dropzone-core` is what a standalone `DropzoneEngine` merges
 * under its options AND what `<web-dropzone>`'s input rows (and the list
 * satellite's grid rows) seed. Detached elements — no store is built.
 */

let el: any;
afterEach(() => { el?.remove(); el = undefined; });

/** Keys the element seeds as `null` on purpose ("unset — the engine decides"). */
const UNSET_ON_ELEMENT = new Set(['accept', 'name', 'icon', 'overlayIcon', 'renderMode']);

describe('engine defaults = element defaults', () => {
    it('every <web-dropzone> input with an engine default seeds the same value', () => {
        el = document.createElement('web-dropzone');
        const checked: string[] = [];
        for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
            if (!(key in el) || UNSET_ON_ELEMENT.has(key)) continue;
            expect(el[key], key).toEqual(value);
            checked.push(key);
        }
        expect(checked.length).toBeGreaterThan(20);
    });

    it('the keys the element leaves unset still render with the engine default', () => {
        el = document.createElement('web-dropzone');
        for (const key of UNSET_ON_ELEMENT) expect(el[key] ?? null, key).toBeNull();
    });

    it('<web-dropzone-list> grid rows seed the engine defaults', () => {
        el = document.createElement('web-dropzone-list');
        expect(el.gridLayout).toBe(DEFAULT_CONFIG.gridLayout);
        expect(el.gridStatus).toBe(DEFAULT_CONFIG.gridStatus);
    });

    it('a standalone engine starts from the same defaults', () => {
        const engine = new DropzoneEngine(document.createElement('div'));
        const config = engine.getConfig();
        for (const [key, value] of Object.entries(DEFAULT_CONFIG)) expect(config[key as keyof typeof config], key).toEqual(value);
    });
});
