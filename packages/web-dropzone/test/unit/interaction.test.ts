import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index'; // registers <web-dropzone> (core registerComponent)

/**
 * Interaction-model wiring on the element (SPEC §12.5): `el.controller` is the
 * one public facade (no `getStore()`), it answers with empty defaults before
 * the store is built and reaches the live store after; the `on*` twins
 * receive the event detail with `controller` / `element` attached
 * (non-enumerable); events are not composed. Behaviour in a real browser is
 * covered by `e2e/interaction-model.spec.ts`.
 */

let el: any;

afterEach(() => {
    el?.remove();
    el = undefined;
});

describe('<web-dropzone> interaction model', () => {
    it('exposes el.controller (not getStore) with defaults before the first build', async () => {
        el = document.createElement('web-dropzone');
        expect(el.getStore).toBeUndefined();
        const controller = el.controller;
        expect(controller.isReady).toBe(false);
        expect(controller.getFiles()).toEqual([]);
        expect(controller.getOverallProgress().percent).toBe(0);
        await expect(controller.addFiles([])).resolves.toBeUndefined();
        expect(el.controller).toBe(controller); // built once
    });

    it('fires ready with the context on connect (core: on the next microtask); the twin gets the same detail first', async () => {
        el = document.createElement('web-dropzone');
        const seen: string[] = [];
        let twinDetail: any;
        el.onReady = (detail: any) => { twinDetail = detail; seen.push('twin'); };
        el.addEventListener('ready', (e: CustomEvent) => {
            seen.push(`event composed=${e.composed} same=${e.detail === twinDetail}`);
        });
        document.body.appendChild(el);
        expect(seen).toEqual([]);
        await el.whenReady();
        expect(seen).toEqual(['twin', 'event composed=false same=true']);
        expect(twinDetail.controller).toBe(el.controller);
        expect(twinDetail.element).toBe(el);
        expect(Object.keys(twinDetail)).toEqual([]);
        expect(el.controller.isReady).toBe(true);
    });

    it('routes add / change through the twins with typed details', async () => {
        el = document.createElement('web-dropzone');
        document.body.appendChild(el);
        const names: string[] = [];
        el.onFileAdd = (d: any) => names.push(`add:${d.file.name}`);
        el.onChange = (d: any) => names.push(`change:${d.files.length}:${d.controller === el.controller}`);
        await el.controller.addFiles([new File(['x'], 'a.txt')]);
        expect(names).toEqual(['add:a.txt', 'change:1:true']);
    });
});
