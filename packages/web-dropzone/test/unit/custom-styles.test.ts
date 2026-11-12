import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index'; // registers <web-dropzone> + the satellites

/**
 * Custom CSS on store-mounted satellites (SPEC Q24, core `createCustomStyles({ getOwner })`):
 * a satellite the store mounts itself takes the store's page + instance layers between its own
 * (satellite page → store page → store instance → satellite instance); a `for=`-bound satellite
 * doesn't.
 */

let els: HTMLElement[] = [];

afterEach(() => {
    els.forEach((el) => el.remove());
    els = [];
    for (const tag of ['web-dropzone', 'web-dropzone-picker', 'web-dropzone-indicator', 'web-dropzone-list']) {
        const page = (window as any).components?.[tag];
        if (page) { page.customStyles = null; }
    }
});

/** `<class>: <css>` for every custom-styles slot in a root, in DOM order. */
const styles = (root: ShadowRoot): string[] =>
    [...root.querySelectorAll('style[class^="dz-custom-styles"]')]
        .filter((s) => s.textContent)
        .map((s) => `${s.className}: ${s.textContent}`);

const mount = async <T extends HTMLElement>(el: T): Promise<T> => {
    document.body.appendChild(el);
    els.push(el);
    await (el as any).whenReady();
    return el;
};

describe('satellite custom CSS (getOwner)', () => {
    it('a store-mounted satellite takes the store layers between its own', async () => {
        (window as any).components['web-dropzone'].customStyles = '.store-page {}';
        (window as any).components['web-dropzone-picker'].customStyles = '.picker-page {}';
        const dz: any = document.createElement('web-dropzone');
        dz.setAttribute('display-mode', 'list'); // bulk: the store mounts its satellites
        dz.customStyles = '.store-inst {}';
        await mount(dz);
        const picker: any = dz.shadowRoot.querySelector('web-dropzone-picker');
        expect(picker).toBeTruthy();
        picker.customStyles = '.picker-inst {}';
        await picker.whenSettled();
        expect(styles(picker.shadowRoot)).toEqual([
            'dz-custom-styles--page: .picker-page {}',
            'dz-custom-styles--owner-page: .store-page {}',
            'dz-custom-styles--owner: .store-inst {}',
            'dz-custom-styles: .picker-inst {}',
        ]);

        dz.customStyles = '.store-inst-2 {}';
        await dz.whenSettled();
        expect(styles(picker.shadowRoot)).toContain('dz-custom-styles--owner: .store-inst-2 {}');
    });

    it('a for=-bound satellite gets no store layers', async () => {
        const dz: any = document.createElement('web-dropzone');
        dz.id = 'dz-cs-store';
        dz.customStyles = '.store-inst {}';
        await mount(dz);
        const picker: any = document.createElement('web-dropzone-picker');
        picker.setAttribute('for', 'dz-cs-store');
        picker.customStyles = '.picker-inst {}';
        await mount(picker);
        expect(styles(picker.shadowRoot)).toEqual(['dz-custom-styles: .picker-inst {}']);
    });

    it('bindToStore() without an owner gets no store layers', async () => {
        const dz: any = document.createElement('web-dropzone');
        dz.customStyles = '.store-inst {}';
        await mount(dz);
        const picker: any = document.createElement('web-dropzone-picker');
        picker.bindToStore(dz);
        picker.customStyles = '.picker-inst {}';
        await mount(picker);
        expect(styles(picker.shadowRoot)).toEqual(['dz-custom-styles: .picker-inst {}']);
    });

    it("the indicator's drawer list takes the indicator's layers (not the store's)", async () => {
        const dz: any = document.createElement('web-dropzone');
        dz.id = 'dz-cs-ind';
        dz.customStyles = '.store-inst {}';
        await mount(dz);
        const indicator: any = document.createElement('web-dropzone-indicator');
        indicator.setAttribute('for', 'dz-cs-ind');
        indicator.setAttribute('drawer', 'auto');
        indicator.customStyles = '.ind-inst {}';
        await mount(indicator);
        const list: any = indicator.shadowRoot.querySelector('web-dropzone-list');
        expect(list).toBeTruthy();
        await list.whenReady();
        expect(styles(list.shadowRoot)).toEqual(['dz-custom-styles--owner: .ind-inst {}']);
    });
});
